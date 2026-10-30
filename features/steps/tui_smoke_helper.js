/**
 * Exercise the real OpenCode TUI in an isolated POSIX pseudo-terminal.
 *
 * The host process is started on a real PTY (through node-pty) under a small
 * persistent group-leader supervisor (`tui_supervisor.js`). The supervisor
 * stays alive after the TUI exits, anchors the PGID, and performs TERM/KILL
 * cleanup over a private Unix socket, so the harness never signals a group
 * whose leader may have been reaped and whose PGID may have been reused.
 * Cleanup is group-scoped: descendants that leave the supervisor's process
 * group or session are not signaled and can survive. If the supervisor
 * crashes or cannot confirm cleanup, `runTui` rejects instead of reporting
 * success. The supervisor is started separately: the harness authenticates a
 * pre-established control channel, sends an explicit `start` command before
 * the TUI is spawned, and later sends an authenticated `shutdown`.
 *
 * HOME, XDG directories, and the project live in a disposable tree. A hostile
 * ancestor plugin fixture and an entrypoint-removal control keep the toast
 * assertion honest.
 *
 * Usage from a Cucumber step:
 *
 *   import { runTui } from "./tui_smoke_helper.js";
 *
 *   const result = await runTui({
 *     configureOats: true,
 *     hostileAncestor: false,
 *     pluginPath: REPO_ROOT,
 *     observeAbsence: false,
 *     loadHostileAsCli: false,
 *   });
 *   // result: { hostReady, toastVisible, controlCompleted, diagnostic }
 *
 * `runTui` rejects if the host executable is missing, is not the tested
 * version, the host exposes system configuration, retained output exceeds
 * MAX_OUTPUT, or supervisor cleanup cannot be confirmed. PTY closure is
 * awaited before settling. node-pty normally emits exit after the PTY socket
 * closes, but force-destroys the socket 200ms after the direct child exits if
 * it has not closed; output still pending after that forced close can be
 * dropped rather than observed. The retained-byte cap still bounds memory, but
 * the harness does not claim to observe every byte written after exit.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { configuredHostVersion } from "./host_pin_helper.js";

const execFileAsync = promisify(execFile);

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const SUPERVISOR_PATH = fileURLToPath(
  new URL("./tui_supervisor.js", import.meta.url),
);
export const TIMEOUT_SECONDS = 30;
export const CONTROL_OBSERVATION_SECONDS = 3;
export const MAX_OUTPUT = 4 * 1024 * 1024;
export const OUTPUT_LIMIT_MESSAGE = "OpenCode TUI exceeded the output limit";

const TERMINAL_COLUMNS = 120;
const TERMINAL_ROWS = 40;
const TERMINATION_GRACE_MS = 5000;
const POLL_INTERVAL_MS = 100;
const SUPERVISOR_CONNECT_TIMEOUT_MS = 5000;
const SUPERVISOR_START_TIMEOUT_MS = 5000;
const SUPERVISOR_CLEANUP_TIMEOUT_MS = 5000;
const SUPERVISOR_MAX_GRACE_MS = 5000;
const SUPERVISOR_PROTOCOL = 2;
const SUPERVISOR_TOKEN_MIN_LENGTH = 32;
const PTY_CLOSE_TIMEOUT_MS = 10_000;
const IPC_DRAIN_MS = 200;

// OpenTUI emits cursor-positioned text. Requiring a rendered screen update,
// rather than a bare substring, avoids confusing diagnostics with a toast.
const RENDERED_TOAST =
  /\x1b\[\d+;\d+H(?:\x1b\[[0-9;]*m)*OATS loaded/;
const RENDERED_HOME = /\x1b\[\d+;\d+H(?:\x1b\[[0-9;]*m)*ctrl\+p /;

/**
 * Retain at most `maxOutput` bytes of PTY output. A chunk that would cross the
 * limit is dropped whole and marks the capture as overflowing, so retained
 * text and memory cannot grow after the bound is reached.
 */
export function createOutputCapture(maxOutput = MAX_OUTPUT) {
  let text = "";
  let bytes = 0;
  let overflow = false;
  return {
    append(chunk) {
      if (overflow) {
        return;
      }
      const chunkBytes = Buffer.byteLength(chunk, "utf8");
      if (bytes + chunkBytes > maxOutput) {
        overflow = true;
        return;
      }
      text += chunk;
      bytes += chunkBytes;
    },
    get text() {
      return text;
    },
    get bytes() {
      return bytes;
    },
    get overflow() {
      return overflow;
    },
  };
}

/**
 * System configuration locations that V2 reads independently of HOME and
 * project discovery.
 */
export function systemSources({ platform = process.platform, username } = {}) {
  if (platform !== "darwin") {
    return ["/etc/opencode"];
  }
  return [
    "/Library/Application Support/opencode",
    path.join(
      "/Library/Managed Preferences",
      username ?? os.userInfo().username,
      "ai.opencode.managed.plist",
    ),
    "/Library/Managed Preferences/ai.opencode.managed.plist",
  ];
}

/**
 * Fail closed if any system configuration source exists. A test cannot claim
 * isolation while an impersonating plugin may be supplied outside HOME.
 */
export function assertNoSystemConfig(sources) {
  for (const source of sources) {
    try {
      fs.lstatSync(source);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw new Error(
        `Cannot inspect OpenCode system source ${source}: ${error.message}`,
        { cause: error },
      );
    }
    throw new Error(
      `Cannot isolate OpenCode from system configuration at ${source}; ` +
        "run this smoke test on a host without that system source",
    );
  }
}

export function findExecutable(name, pathEnv = process.env.PATH) {
  const searchPath = pathEnv ?? "/bin:/usr/bin";
  if (name.includes(path.sep)) {
    return isExecutableFile(name) ? name : null;
  }
  for (const directory of searchPath.split(path.delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = path.join(directory, name);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isExecutableFile(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

async function supportedHostVersion(executable) {
  const expected = configuredHostVersion();
  if (!findExecutable(executable)) {
    throw new Error(`OpenCode executable not found: ${executable}`);
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync(executable, ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
    }));
  } catch (error) {
    throw new Error(`OpenCode --version failed: ${error.message}`, {
      cause: error,
    });
  }
  const version = stdout.trim();
  const parsed = /^(?:opencode\s+)?v?(\d+\.\d+\.\d+)$/.exec(version);
  if (!parsed || parsed[1] !== expected) {
    throw new Error(`Expected OpenCode v${expected}, got: ${version}`);
  }
  return version;
}

/**
 * Run the real TUI under an isolated PTY and observe its rendered output.
 *
 * @param {object} options
 * @param {boolean} options.configureOats - Locally configure this checkout.
 * @param {boolean} [options.hostileAncestor] - Plant an impersonating plugin
 *   in a parent directory of the project.
 * @param {string} [options.pluginPath] - Plugin package to configure.
 * @param {boolean} [options.observeAbsence] - Wait out the control window even
 *   when OATS is configured (used for the missing-entrypoint control).
 * @param {boolean} [options.loadHostileAsCli] - Explicitly add the hostile
 *   fixture to the CLI plugin list (requires hostileAncestor).
 * @param {object} [options.harness] - Test seams for deterministic PTY
 *   lifecycle and timing tests. Production callers must omit this; the
 *   defaults preserve the real supervisor, real PTY, and fixed timeouts.
 * @returns {Promise<{hostReady: boolean, toastVisible: boolean,
 *   controlCompleted: boolean, diagnostic: string}>}
 */
export async function runTui({
  configureOats,
  hostileAncestor = false,
  pluginPath = REPO_ROOT,
  observeAbsence = false,
  loadHostileAsCli = false,
  harness = {},
}) {
  const {
    spawnPty = spawnRealPty,
    connectIpc = connectSupervisor,
    timeoutMs = TIMEOUT_SECONDS * 1000,
    controlObservationMs = CONTROL_OBSERVATION_SECONDS * 1000,
    maxOutput = MAX_OUTPUT,
    pollIntervalMs = POLL_INTERVAL_MS,
    cleanupGraceMs = TERMINATION_GRACE_MS,
  } = harness;
  const executable = process.env.OATS_OPENCODE ?? "opencode";
  const version = await supportedHostVersion(executable);
  assertNoSystemConfig(systemSources());
  if (loadHostileAsCli && !hostileAncestor) {
    throw new Error("Hostile CLI loading requires the hostile ancestor fixture");
  }

  // A new home and working directory prevent ambient configuration, credentials,
  // discovered project plugins, and the user's shared server from affecting the test.
  const preferredTempRoot = "/tmp/opencode";
  const tempRoot =
    fs.existsSync(preferredTempRoot) && fs.statSync(preferredTempRoot).isDirectory()
      ? preferredTempRoot
      : os.tmpdir();
  const root = await fs.promises.mkdtemp(path.join(tempRoot, "oats-tui-"));
  try {
    return await runInIsolatedRoot({
      root,
      executable,
      version,
      configureOats,
      hostileAncestor,
      pluginPath,
      observeAbsence,
      loadHostileAsCli,
      spawnPty,
      connectIpc,
      timeoutMs,
      controlObservationMs,
      maxOutput,
      pollIntervalMs,
      cleanupGraceMs,
    });
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

async function runInIsolatedRoot({
  root,
  executable,
  version,
  configureOats,
  hostileAncestor,
  pluginPath,
  observeAbsence,
  loadHostileAsCli,
  spawnPty,
  connectIpc,
  timeoutMs,
  controlObservationMs,
  maxOutput,
  pollIntervalMs,
  cleanupGraceMs,
}) {
  const project = path.join(root, "project");
  await fs.promises.mkdir(project);
  let ambient;
  if (hostileAncestor) {
    // This deliberately mimics the OATS toast, so it can expose a false
    // positive if the host discovers plugins in a parent directory.
    ambient = path.join(root, ".opencode", "plugins", "ambient");
    await fs.promises.mkdir(ambient, { recursive: true });
    await fs.promises.writeFile(
      path.join(ambient, "index.ts"),
      'import { Plugin } from "@opencode/plugin"\n' +
        'export default Plugin.define({ id: "ambient.server", setup() {} })\n',
    );
    await fs.promises.writeFile(
      path.join(ambient, "tui.ts"),
      'import { Plugin } from "@opencode/plugin/tui"\n' +
        'export default Plugin.define({ id: "ambient.impersonator", ' +
        'setup(ctx) { ctx.ui.toast.show({ message: "OATS loaded" }) } })\n',
    );
  }
  const configuredPlugins = configureOats ? [pluginPath] : [];
  if (loadHostileAsCli) {
    configuredPlugins.push(ambient);
  }
  const env = isolatedEnvironment(root, configuredPlugins);
  const socketPath = path.join(root, "supervisor.sock");

  const terminal = await spawnPty(
    process.execPath,
    [SUPERVISOR_PATH, socketPath, executable, "--standalone", project],
    {
      name: "xterm-256color",
      cols: TERMINAL_COLUMNS,
      rows: TERMINAL_ROWS,
      cwd: project,
      env,
    },
  );
  // onExit follows socket close in normal operation, but node-pty force-closes
  // the socket 200ms after the direct child exits if it has not closed; see the
  // observation limitation in the module doc.
  const ptyExit = new Promise((resolve) => {
    terminal.onExit((status) => resolve(status ?? {}));
  });
  let supervisorExited = false;
  void ptyExit.then(() => {
    supervisorExited = true;
  });
  const captured = createOutputCapture(maxOutput);
  terminal.onData((chunk) => {
    captured.append(chunk);
  });

  const state = {
    targetExited: false,
    targetExitCode: null,
    started: false,
    startedSignal: deferred(),
    token: null,
    ready: null,
    readySignal: deferred(),
    error: null,
    errorSignal: deferred(),
    cleanup: null,
    cleanupSignal: deferred(),
  };
  let ipc = null;
  let failure = null;
  let result = null;
  try {
    ipc = await connectIpc(socketPath, {
      timeoutMs: Math.min(timeoutMs, SUPERVISOR_CONNECT_TIMEOUT_MS),
    });
    ipc.onMessage((message) => {
      if (message?.type === "ready") {
        state.ready = message;
        state.readySignal.resolve();
      } else if (message?.type === "target-start") {
        state.started = true;
        state.startedSignal.resolve();
      } else if (message?.type === "target-exit") {
        state.targetExited = true;
        state.targetExitCode = message.exitCode ?? null;
      } else if (message?.type === "error") {
        state.error = message.message ?? "unspecified supervisor error";
        state.errorSignal.resolve();
      } else if (message?.type === "clean" || message?.type === "killing") {
        state.cleanup = message.type;
        state.cleanupSignal.resolve();
      }
    });
    const ready = await withTimeout(
      state.readySignal.promise.then(() => state.ready),
      SUPERVISOR_CONNECT_TIMEOUT_MS,
      "OpenCode TUI supervisor did not complete its control handshake",
    );
    if (
      ready?.protocol !== SUPERVISOR_PROTOCOL ||
      ready.pid !== terminal.pid ||
      typeof ready.token !== "string" ||
      ready.token.length < SUPERVISOR_TOKEN_MIN_LENGTH
    ) {
      throw new Error(
        "OpenCode TUI supervisor control handshake was invalid or came from an unexpected process",
      );
    }
    state.token = ready.token;
    ipc.send({ type: "start", token: state.token });
    await withTimeout(
      Promise.race([
        state.startedSignal.promise,
        state.errorSignal.promise.then(() => {
          throw new Error(
            `OpenCode TUI supervisor rejected start: ${state.error}`,
          );
        }),
      ]),
      SUPERVISOR_START_TIMEOUT_MS,
      "OpenCode TUI supervisor did not start the target",
    );
    const { controlCompleted } = await observeTui({
      captured,
      exited: () => state.targetExited || supervisorExited,
      configureOats,
      observeAbsence,
      timeoutMs,
      controlObservationMs,
      pollIntervalMs,
    });
    assertNoOverflow(captured);
    const hostReady = RENDERED_HOME.test(captured.text);
    const toastVisible = RENDERED_TOAST.test(captured.text);
    const processStatus = state.targetExited
      ? (state.targetExitCode ?? "signaled")
      : supervisorExited
        ? "supervisor-exited"
        : "running";
    result = {
      hostReady,
      toastVisible,
      controlCompleted,
      diagnostic:
        `host=${version}, configured=${configureOats}, ` +
        `process_status=${processStatus}, ` +
        `captured_bytes=${captured.bytes}, control_completed=${controlCompleted}, ` +
        `hostile_ancestor=${hostileAncestor}, load_hostile_as_cli=${loadHostileAsCli}`,
    };
  } catch (error) {
    failure = error;
  } finally {
    let cleanupError;
    try {
      await cleanupSupervisor({
        ipc,
        ptyExit,
        state,
        graceMs: boundedGrace(cleanupGraceMs),
      });
    } catch (error) {
      cleanupError = error;
    }
    await withTimeout(
      ptyExit,
      PTY_CLOSE_TIMEOUT_MS,
      "PTY supervisor did not close after cleanup",
    ).catch((error) => {
      cleanupError ??= error;
    });
    // node-pty normally emits exit after the PTY socket closes, so this turn
    // drains the IPC tail and gives queued output a chance to reach the cap.
    // node-pty force-destroys the socket 200ms after the direct child exits if
    // it has not closed, so output after that point can be dropped.
    await delay(0);
    assertNoOverflow(captured);
    if (failure) {
      if (cleanupError && !failure.cause) {
        failure.cause = cleanupError;
      }
      throw failure;
    }
    if (cleanupError) {
      throw cleanupError;
    }
  }
  return result;
}

async function cleanupSupervisor({ ipc, ptyExit, state, graceMs }) {
  try {
    await performSupervisorCleanup({ ipc, ptyExit, state, graceMs });
  } catch (error) {
    // Closing the private IPC makes a live supervisor clean its own group.
    // The harness never signals a possibly-reused PID or PGID after failure.
    if (ipc?.close) {
      ipc.close();
    }
    const waitMs = ipc ? graceMs + SUPERVISOR_CLEANUP_TIMEOUT_MS : 20_000;
    await withTimeout(
      ptyExit,
      waitMs,
      "PTY supervisor did not close after IPC failure",
    ).catch((closeError) => {
      if (!error.cause) {
        error.cause = closeError;
      }
    });
    throw error;
  }
}

async function performSupervisorCleanup({ ipc, ptyExit, state, graceMs }) {
  if (!ipc || typeof state.token !== "string") {
    throw new Error(
      "OpenCode TUI supervisor control channel unavailable; cleanup cannot be confirmed",
    );
  }

  try {
    ipc.send({ type: "shutdown", token: state.token, graceMs });
  } catch (error) {
    throw new Error(
      `OpenCode TUI supervisor shutdown request failed: ${error.message}`,
      { cause: error },
    );
  }

  const outcome = await Promise.race([
    state.cleanupSignal.promise.then(() => "reported"),
    state.errorSignal.promise.then(() => "error"),
    ptyExit.then(() => "pty-exit"),
    delay(graceMs + SUPERVISOR_CLEANUP_TIMEOUT_MS).then(() => "timeout"),
  ]);
  if (state.error) {
    throw new Error(
      `OpenCode TUI supervisor rejected control request: ${state.error}`,
    );
  }
  if (outcome === "timeout") {
    throw new Error(
      "OpenCode TUI supervisor did not confirm cleanup before timeout",
    );
  }

  const status = await withTimeout(
    ptyExit,
    PTY_CLOSE_TIMEOUT_MS,
    "PTY supervisor did not close after cleanup",
  );

  if (state.cleanup === "clean") {
    if (status?.exitCode !== 0 || status?.signal) {
      throw new Error(
        `OpenCode TUI supervisor reported clean cleanup but exited with code ${status?.exitCode} signal ${status?.signal}`,
      );
    }
    return;
  }

  // The IPC message and PTY socket close can race on the kernel side. Give a
  // short drain turn before treating an unreported exit as failure.
  if (state.cleanup === null) {
    await Promise.race([
      state.cleanupSignal.promise,
      state.errorSignal.promise,
      delay(IPC_DRAIN_MS),
    ]);
  }
  if (state.error) {
    throw new Error(
      `OpenCode TUI supervisor rejected control request: ${state.error}`,
    );
  }
  if (state.cleanup === "killing") {
    // A supervisor that had to SIGKILL its own group dies with it and cannot
    // prove the group is gone. Never report that as confirmed success, even
    // though SIGKILL was requested.
    throw new Error(
      "OpenCode TUI cleanup escalated to SIGKILL; group termination cannot be confirmed",
    );
  }
  if (state.cleanup === "clean") {
    if (status?.exitCode !== 0 || status?.signal) {
      throw new Error(
        `OpenCode TUI supervisor reported clean cleanup but exited with code ${status?.exitCode} signal ${status?.signal}`,
      );
    }
    return;
  }
  throw new Error(
    `OpenCode TUI supervisor exited without confirming descendant cleanup`,
  );
}

/**
 * Connect to the supervisor's private Unix socket, retrying until the
 * supervisor has created it.
 */
export async function connectSupervisor(
  socketPath,
  { timeoutMs = SUPERVISOR_CONNECT_TIMEOUT_MS } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await connectOnce(socketPath);
    } catch (error) {
      if (
        (error.code !== "ENOENT" && error.code !== "ECONNREFUSED") ||
        Date.now() >= deadline
      ) {
        throw new Error(
          `OpenCode TUI supervisor IPC unavailable at ${socketPath}: ${error.message}`,
          { cause: error },
        );
      }
      await delay(20);
    }
  }
}

function connectOnce(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath);
    const onError = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      socket.on("error", () => {});
      resolve(createIpc(socket));
    });
  });
}

function createIpc(socket) {
  const listeners = new Set();
  const history = [];
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      history.push(message);
      for (const listener of listeners) {
        listener(message);
      }
    }
  });
  return {
    send(message) {
      socket.write(`${JSON.stringify(message)}\n`);
    },
    onMessage(listener) {
      for (const message of history) {
        listener(message);
      }
      listeners.add(listener);
    },
    close() {
      socket.destroy();
    },
    closed: new Promise((resolve) => socket.once("close", resolve)),
  };
}

async function spawnRealPty(file, args, options) {
  const nodePty = await import("node-pty");
  const pty = nodePty.default ?? nodePty;
  return pty.spawn(file, args, options);
}

function isolatedEnvironment(root, configuredPlugins) {
  return {
    PATH: process.env.PATH ?? "/bin:/usr/bin",
    LC_ALL: "C.UTF-8",
    HOME: root,
    XDG_CONFIG_HOME: path.join(root, "config"),
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_STATE_HOME: path.join(root, "state"),
    TERM: "xterm-256color",
    OPENCODE_DISABLE_PROJECT_CONFIG: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({
      plugins: configuredPlugins,
      highlights: false,
    }),
  };
}

async function observeTui({
  captured,
  exited,
  configureOats,
  observeAbsence,
  timeoutMs,
  controlObservationMs,
  pollIntervalMs,
}) {
  const deadline = Date.now() + timeoutMs;
  let controlDeadline = null;
  let controlCompleted = false;
  while (Date.now() < deadline) {
    assertNoOverflow(captured);
    const ready = RENDERED_HOME.test(captured.text);
    const toast = RENDERED_TOAST.test(captured.text);
    if (ready && toast) {
      break;
    }
    if (ready && (!configureOats || observeAbsence)) {
      controlDeadline ??= Date.now() + controlObservationMs;
      if (Date.now() >= controlDeadline && !exited()) {
        controlCompleted = true;
        break;
      }
    }
    if (exited()) {
      break;
    }
    await delay(pollIntervalMs);
  }
  assertNoOverflow(captured);
  return { controlCompleted };
}

function assertNoOverflow(captured) {
  if (captured.overflow) {
    throw new Error(OUTPUT_LIMIT_MESSAGE);
  }
}

function boundedGrace(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) {
    return SUPERVISOR_MAX_GRACE_MS;
  }
  return Math.min(Math.max(requested, 0), SUPERVISOR_MAX_GRACE_MS);
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
