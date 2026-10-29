/**
 * Persistent PTY group-leader supervisor for the OpenCode TUI smoke harness.
 *
 * node-pty starts this process as the session and process-group leader. It
 * spawns the real TUI in that same group and deliberately stays alive after
 * the TUI exits. The harness talks to it over a private Unix socket and asks
 * it to shut down. Because the supervisor is alive whenever a group signal is
 * sent, its PGID cannot have been reused by an unrelated process.
 *
 * Shutdown is group-scoped: it sends SIGTERM to its own process group, waits
 * `graceMs` for every other live member of that group to exit, then sends
 * SIGKILL to the same group (which also kills the supervisor). Descendants
 * that stay in the group but ignore TERM/HUP are removed; descendants that
 * leave the group or session (for example with setsid) are not signaled and
 * can survive. It reports "clean" only when the group emptied gracefully and
 * "killing" before escalating, so the harness can surface missing or failed
 * cleanup. If the supervisor crashes or cannot report, cleanup is
 * unconfirmed; the harness treats that as an error, never as success.
 *
 * Usage: node tui_supervisor.js <socketPath> <command> [args...]
 *
 * Control flow: the first connection (accepted before the target exists)
 * receives `ready {protocol, pid, token}`; the harness must then send
 * `{type:"start", token}` to spawn the TUI and `{type:"shutdown", token,
 * graceMs}` to clean up. Requests without the capability are rejected. Once
 * the first connection is accepted the listener is closed and the socket path
 * is unlinked, so the target cannot open its own control connection. The token
 * is generated in memory and is never placed in argv, the environment, or
 * files. If `start` never arrives, a supervisor-owned deadline shuts down
 * without spawning the target. Client-supplied grace is clamped to
 * MAX_GRACE_MS. An optional `deadlineMonotonicNs` decimal string (from
 * `process.hrtime.bigint()`) on `start` is validated and checked immediately
 * before spawning; malformed or already-expired deadlines are rejected and
 * cleaned up without launching the target.
 */

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [socketPath, command, ...commandArgs] = process.argv.slice(2);
const POLL_INTERVAL_MS = 50;
const DEFAULT_GRACE_MS = 5000;
const MAX_GRACE_MS = 5000;
const IPC_WAIT_MS = 10_000;
const START_WAIT_MS = 10_000;

if (!socketPath || !command) {
  process.exit(64);
}

// Catch the TERM sent to the supervisor's own group so it can keep anchoring
// the PGID while descendants exit. The TUI is execed after this handler is
// installed; exec resets caught dispositions to their defaults.
process.on("SIGTERM", () => {});
process.on("SIGINT", () => {});
process.on("SIGHUP", () => {
  if (!shutdownStarted) {
    shutdownStarted = true;
    void shutdown(null, DEFAULT_GRACE_MS);
  }
});

let child = null;
let childStatus = null;
let childStarted = false;
let shutdownStarted = false;
let sawConnection = false;
let controlToken = null;
let controlConnection = null;
let startTimer = null;
const connections = new Set();

const server = net.createServer((connection) => {
  if (controlConnection !== null) {
    connection.destroy();
    return;
  }
  // The target is not spawned until this first connection has been
  // authenticated. Closing the listener and unlinking the path afterwards
  // leaves the target no way to open a control connection of its own.
  sawConnection = true;
  clearTimeout(watchdog);
  controlConnection = connection;
  controlToken = crypto.randomBytes(32).toString("hex");
  server.close();
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // The listener is already closed; a leftover path is harmless.
  }
  connections.add(connection);
  connection.on("close", () => {
    connections.delete(connection);
    // The harness owns the only IPC connection. If it disappears without
    // requesting shutdown (for example after a crash), clean up the group from
    // the still-live group leader instead of leaving descendants behind.
    if (connections.size === 0 && !shutdownStarted) {
      shutdownStarted = true;
      void shutdown(null, DEFAULT_GRACE_MS);
    }
  });
  connection.setEncoding("utf8");
  let buffer = "";
  connection.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        send(connection, { type: "error", message: "invalid request" });
        continue;
      }
      handleRequest(connection, request);
    }
  });
  connection.on("error", () => {});
  send(connection, {
    type: "ready",
    protocol: 2,
    pid: process.pid,
    token: controlToken,
  });
  startTimer = setTimeout(() => {
    if (!childStarted && !shutdownStarted) {
      shutdownStarted = true;
      void shutdown(connection, DEFAULT_GRACE_MS);
    }
  }, START_WAIT_MS);
  startTimer.unref();
});

server.on("error", () => {
  process.exit(70);
});

const watchdog = setTimeout(() => {
  if (!sawConnection && !shutdownStarted) {
    shutdownStarted = true;
    void shutdown(null, DEFAULT_GRACE_MS);
  }
}, IPC_WAIT_MS);
watchdog.unref();

server.listen(socketPath, () => {
  try {
    fs.chmodSync(socketPath, 0o600);
  } catch {
    // The enclosing isolated directory is already private.
  }
});

function startTarget() {
  clearTimeout(startTimer);
  childStarted = true;
  child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.on("error", (error) => {
    childStatus = { exitCode: null, signal: null, error: error.message };
    broadcast({ type: "target-exit", ...childStatus });
  });
  child.on("exit", (exitCode, signal) => {
    childStatus = { exitCode, signal };
    broadcast({ type: "target-exit", ...childStatus });
  });
  broadcast({ type: "target-start", pid: child.pid ?? null });
}

function send(connection, message) {
  if (!connection || connection.destroyed) {
    return;
  }
  connection.write(`${JSON.stringify(message)}\n`);
}

function broadcast(message) {
  for (const connection of connections) {
    send(connection, message);
  }
}

function handleRequest(connection, request) {
  if (!authorized(request)) {
    send(connection, { type: "error", message: "unauthorized request" });
    return;
  }
  if (request?.type === "start") {
    if (childStarted || shutdownStarted) {
      send(connection, { type: "error", message: "start is not available" });
      return;
    }
    const deadline = parseStartDeadline(request);
    if (deadline.error) {
      rejectStart(connection, deadline.error);
      return;
    }
    // Check as late as possible before spawning so a queued start cannot
    // launch after the caller's deadline has already passed.
    if (
      deadline.value !== null &&
      process.hrtime.bigint() >= deadline.value
    ) {
      rejectStart(connection, "start deadline has already expired");
      return;
    }
    startTarget();
    return;
  }
  if (request?.type !== "shutdown") {
    send(connection, { type: "error", message: "unknown request" });
    return;
  }
  clearTimeout(startTimer);
  if (shutdownStarted) {
    return;
  }
  shutdownStarted = true;
  void shutdown(connection, boundedGrace(request.graceMs));
}

function authorized(request) {
  if (typeof request?.token !== "string" || controlToken === null) {
    return false;
  }
  const expected = Buffer.from(controlToken, "utf8");
  const supplied = Buffer.from(request.token, "utf8");
  return (
    supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
  );
}

function boundedGrace(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) {
    return MAX_GRACE_MS;
  }
  return Math.min(Math.max(requested, 0), MAX_GRACE_MS);
}

function parseStartDeadline(request) {
  if (!Object.hasOwn(request, "deadlineMonotonicNs")) {
    return { value: null };
  }
  const raw = request.deadlineMonotonicNs;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return { error: "invalid start deadline" };
  }
  try {
    return { value: BigInt(raw) };
  } catch {
    return { error: "invalid start deadline" };
  }
}

function rejectStart(connection, message) {
  send(connection, { type: "error", message });
  clearTimeout(startTimer);
  if (!shutdownStarted) {
    shutdownStarted = true;
    void shutdown(connection, 0);
  }
}

async function shutdown(connection, graceMs) {
  try {
    process.kill(-process.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      send(connection, { type: "error", message: `SIGTERM failed: ${error.message}` });
      process.exit(70);
      return;
    }
  }

  const deadline = Date.now() + graceMs;
  while (true) {
    const members = await otherGroupMembers();
    if (members !== null && members.length === 0) {
      // Confirm across one poll interval so a descendant that forks just as
      // the group appears empty cannot be missed.
      await delay(POLL_INTERVAL_MS);
      const confirmed = await otherGroupMembers();
      if (confirmed !== null && confirmed.length === 0) {
        sendAndExit(connection, { type: "clean" }, 0);
        return;
      }
      continue;
    }
    if (Date.now() >= deadline) {
      break;
    }
    await delay(POLL_INTERVAL_MS);
  }

  // SIGKILL to our own live group also kills the supervisor. Write and flush
  // "killing" first so the harness can distinguish escalation from a crash.
  await sendAndFlush(connection, { type: "killing" });
  try {
    process.kill(-process.pid, "SIGKILL");
  } catch {
    process.exit(70);
  }
  // The signal normally terminates this process immediately. If delivery is
  // delayed, do not outlive the group-kill request.
  setTimeout(() => process.exit(70), 1000).unref();
}

/**
 * Other live (non-zombie) members of this process group. Returns null when the
 * platform cannot enumerate them, which makes cleanup escalate to SIGKILL
 * instead of claiming a clean exit.
 */
async function otherGroupMembers() {
  try {
    if (process.platform === "linux") {
      return linuxGroupMembers();
    }
    return await psGroupMembers();
  } catch {
    return null;
  }
}

function linuxGroupMembers() {
  const members = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    const pid = Number(entry);
    if (pid === process.pid) {
      continue;
    }
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
      const state = fields[0];
      const group = Number(fields[2]);
      if (group === process.pid && state !== "Z") {
        members.push(pid);
      }
    } catch (error) {
      // Only a process that exited between readdir and read is ignorable.
      // Permission, I/O, or malformed-data errors make membership unprovable;
      // propagate so cleanup escalates instead of reporting a false clean.
      if (error.code === "ENOENT" || error.code === "ESRCH") {
        continue;
      }
      throw error;
    }
  }
  return members;
}

async function psGroupMembers() {
  // detached starts ps in its own session/group so it cannot count itself as
  // a member of the supervisor's group while it inspects that group.
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,pgid=,stat="], {
    timeout: 5000,
    detached: true,
  });
  const members = [];
  for (const line of stdout.split("\n")) {
    const [pidText, groupText, state] = line.trim().split(/\s+/);
    const pid = Number(pidText);
    const group = Number(groupText);
    if (
      !Number.isInteger(pid) ||
      !Number.isInteger(group) ||
      !state ||
      pid === process.pid
    ) {
      continue;
    }
    if (group === process.pid && !state.startsWith("Z")) {
      members.push(pid);
    }
  }
  return members;
}

function sendAndFlush(connection, message) {
  if (!connection || connection.destroyed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    connection.write(`${JSON.stringify(message)}\n`, resolve);
  });
}

function sendAndExit(connection, message, code) {
  if (!connection || connection.destroyed) {
    server.close();
    process.exit(code);
    return;
  }
  connection.write(`${JSON.stringify(message)}\n`, () => {
    server.close();
    process.exit(code);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
