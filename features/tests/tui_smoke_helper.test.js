/**
 * Regression tests for smoke-harness preconditions, observation bounds, and
 * supervisor-based cleanup.
 *
 * Fake PTYs/IPC drive deterministic lifecycle and timing paths. Tests marked
 * with real node-pty exercise the persistent group-leader supervisor and the
 * descendants that ignore TERM/HUP; the Cucumber scenarios still run the real
 * OpenCode host.
 *
 * Run with: node --test features/tests/*.test.js
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  assertNoSystemConfig,
  connectSupervisor,
  createOutputCapture,
  runTui,
  SUPERVISOR_PATH,
} from "../steps/tui_smoke_helper.js";

const HOME_FRAME = "\x1b[2;1Hctrl+p help";
const TOAST_FRAME = "\x1b[3;1H\x1b[32mOATS loaded";
const FAKE_TOKEN = "f".repeat(64);
const OUTPUT_WHITELIST = [
  "HOME",
  "LC_ALL",
  "OPENCODE_CLI_CONFIG_CONTENT",
  "OPENCODE_DISABLE_AUTOUPDATE",
  "OPENCODE_DISABLE_MODELS_FETCH",
  "OPENCODE_DISABLE_PROJECT_CONFIG",
  "PATH",
  "TERM",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
];

let nodePty = null;
try {
  const module = await import("node-pty");
  nodePty = module.default ?? module;
} catch {
  nodePty = null;
}

const originalOpenCode = process.env.OATS_OPENCODE;

afterEach(() => {
  if (originalOpenCode === undefined) {
    delete process.env.OATS_OPENCODE;
  } else {
    process.env.OATS_OPENCODE = originalOpenCode;
  }
});

function withTempDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oats-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fakeOpenCode(directory, version) {
  const executable = path.join(directory, "opencode");
  const marker = path.join(directory, "started");
  fs.writeFileSync(
    executable,
    '#!/bin/sh\n' +
      'if [ "$1" = "--version" ]; then\n' +
      `  echo "${version}"\n` +
      "else\n" +
      `  touch "${marker}"\n` +
      "fi\n",
    { mode: 0o755 },
  );
  return { executable, marker };
}

function installFakeHost(t) {
  const { executable } = fakeOpenCode(withTempDir(t), "opencode v2.0.32");
  process.env.OATS_OPENCODE = executable;
  return executable;
}

/**
 * Minimal node-pty stand-in plus a fake supervisor IPC. The behaviour runs
 * after both handlers are registered, so emits behave like node-pty events.
 */
function createFakeHarness(
  behaviour,
  { onSpawn, onShutdown, readyPid = 424242 } = {},
) {
  const calls = { spawn: null, shutdown: [], kill: [], close: 0 };
  let dataHandler;
  let exitHandler;
  let exited = false;

  const emitData = (chunk) => dataHandler?.(chunk);
  const exit = (code = 0, signal = undefined) => {
    if (exited) {
      return;
    }
    exited = true;
    exitHandler?.({ exitCode: code, signal });
  };

  const handlers = new Set();
  const history = [
    { type: "ready", protocol: 2, pid: readyPid, token: FAKE_TOKEN },
  ];
  const emitMessage = (message) => {
    history.push(message);
    for (const handler of handlers) {
      handler(message);
    }
  };
  const ipc = {
    send(message) {
      if (message.type === "start") {
        if (message.token !== FAKE_TOKEN) {
          emitMessage({ type: "error", message: "unauthorized request" });
          return;
        }
        emitMessage({ type: "target-start", pid: 424242 });
        return;
      }
      if (message.type !== "shutdown") {
        return;
      }
      if (message.token !== FAKE_TOKEN) {
        emitMessage({ type: "error", message: "unauthorized request" });
        return;
      }
      calls.shutdown.push(message);
      if (onShutdown) {
        onShutdown({ emitData, emitMessage, exit, message });
        return;
      }
      emitMessage({ type: "clean" });
      exit(0);
    },
    onMessage(handler) {
      for (const message of history) {
        handler(message);
      }
      handlers.add(handler);
    },
    close() {
      calls.close += 1;
      if (!exited) {
        emitMessage({ type: "clean" });
        exit(0);
      }
    },
    closed: Promise.resolve(),
  };

  const pty = {
    spawn(file, args, options) {
      calls.spawn = { file, args, options };
      onSpawn?.(calls.spawn);
      return {
        pid: 424242,
        onData(handler) {
          dataHandler = handler;
          start();
        },
        onExit(handler) {
          exitHandler = handler;
          start();
        },
        kill(signal) {
          calls.kill.push(signal);
          exit(0, signal);
        },
      };
    },
  };

  const start = () => {
    if (!dataHandler || !exitHandler) {
      return;
    }
    setImmediate(() =>
      behaviour({
        emitData,
        emitExit: exit,
        emitMessage,
      }),
    );
  };

  return {
    pty,
    ipc,
    calls,
    harness(overrides = {}) {
      return {
        spawnPty: pty.spawn,
        connectIpc: async () => ipc,
        pollIntervalMs: 5,
        controlObservationMs: 50,
        cleanupGraceMs: 50,
        ...overrides,
      };
    },
  };
}

test("wrong host versions are rejected before TUI startup", async (t) => {
  for (const version of [
    "opencode v1.2.0",
    "opencode v2.0.320",
    "opencode v2.0.32-rc1",
  ]) {
    await t.test(version, async (t) => {
      const directory = withTempDir(t);
      const { executable, marker } = fakeOpenCode(directory, version);
      process.env.OATS_OPENCODE = executable;
      await assert.rejects(
        runTui({ configureOats: false }),
        /Expected OpenCode v2\.0\.32/,
      );
      assert.equal(fs.existsSync(marker), false, "unsupported host reached TUI startup");
    });
  }
});

test("missing host executable is reported before TUI startup", async (t) => {
  const directory = withTempDir(t);
  process.env.OATS_OPENCODE = path.join(directory, "absent-opencode");
  await assert.rejects(
    runTui({ configureOats: false }),
    /OpenCode executable not found/,
  );
});

test("system configuration source fails closed", (t) => {
  const directory = withTempDir(t);
  const source = path.join(directory, "opencode");
  assert.doesNotThrow(() => assertNoSystemConfig([source]));
  fs.mkdirSync(source);
  assert.throws(
    () => assertNoSystemConfig([source]),
    /Cannot isolate OpenCode/,
  );
});

test("a dangling system-configuration symlink fails closed", (t) => {
  const directory = withTempDir(t);
  const link = path.join(directory, "opencode");
  fs.symlinkSync(path.join(directory, "missing-target"), link);
  assert.throws(() => assertNoSystemConfig([link]), /Cannot isolate OpenCode/);
});

test("non-ENOENT configuration inspection errors are actionable", (t) => {
  const directory = withTempDir(t);
  const file = path.join(directory, "not-a-directory");
  fs.writeFileSync(file, "x");
  assert.throws(
    () => assertNoSystemConfig([path.join(file, "child")]),
    (error) => {
      assert.match(error.message, /Cannot inspect OpenCode system source/);
      assert.ok(error.cause, "original inspection error should be preserved");
      return true;
    },
  );
});

test("output capture enforces a strict retained-byte bound", () => {
  const capture = createOutputCapture(10);
  capture.append("12345");
  capture.append("67890");
  assert.equal(capture.overflow, false);
  assert.equal(capture.bytes, 10);
  capture.append("X");
  assert.equal(capture.overflow, true);
  assert.equal(capture.bytes, 10);
  assert.equal(capture.text, "1234567890");
  capture.append("more");
  assert.equal(capture.text, "1234567890", "overflow must stop all retention");

  const multibyte = createOutputCapture(3);
  multibyte.append("éé");
  assert.equal(multibyte.overflow, true);
  assert.equal(multibyte.bytes, 0, "a crossing chunk is dropped whole");
});

test("early PTY exit resolves without a ready host and cleans up", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(({ emitData, emitMessage }) => {
    emitData("\x1b[2;1Hloading");
    emitMessage({ type: "target-exit", exitCode: 1 });
  });
  const result = await runTui({
    configureOats: false,
    harness: fake.harness(),
  });

  assert.equal(result.hostReady, false);
  assert.equal(result.toastVisible, false);
  assert.equal(result.controlCompleted, false);
  assert.match(result.diagnostic, /process_status=1/);
  assert.equal(fake.calls.shutdown.length, 1);
});

test("a rendered toast ends observation before the absence window", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(({ emitData }) => {
    emitData(HOME_FRAME);
    emitData(TOAST_FRAME);
  });
  const started = Date.now();
  const result = await runTui({
    configureOats: false,
    harness: fake.harness({ controlObservationMs: 1000 }),
  });

  assert.equal(result.hostReady, true);
  assert.equal(result.toastVisible, true);
  assert.equal(result.controlCompleted, false);
  assert.ok(Date.now() - started < 900, "toast should short-circuit the window");
  assert.equal(fake.calls.shutdown.length, 1);
});

test("absence control completes only on a live ready host", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(({ emitData }) => {
    emitData(HOME_FRAME);
  });
  const started = Date.now();
  const result = await runTui({
    configureOats: false,
    harness: fake.harness({ controlObservationMs: 120 }),
  });

  assert.equal(result.hostReady, true);
  assert.equal(result.toastVisible, false);
  assert.equal(result.controlCompleted, true);
  assert.ok(Date.now() - started >= 100, "control window must elapse");
  assert.equal(fake.calls.shutdown.length, 1);
});

test("absence control does not complete when the target exits mid-window", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(({ emitData, emitMessage }) => {
    emitData(HOME_FRAME);
    setTimeout(
      () => emitMessage({ type: "target-exit", exitCode: 0 }),
      20,
    );
  });
  const started = Date.now();
  const result = await runTui({
    configureOats: false,
    harness: fake.harness({ controlObservationMs: 1000 }),
  });

  assert.equal(result.hostReady, true);
  assert.equal(result.controlCompleted, false);
  assert.match(result.diagnostic, /process_status=0/);
  assert.ok(Date.now() - started < 500, "target exit should end observation early");
  assert.equal(fake.calls.shutdown.length, 1);
});

test("observation timeout resolves without a ready host", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(() => {});
  const started = Date.now();
  const result = await runTui({
    configureOats: false,
    harness: fake.harness({ timeoutMs: 120 }),
  });

  assert.equal(result.hostReady, false);
  assert.equal(result.toastVisible, false);
  assert.equal(result.controlCompleted, false);
  assert.ok(Date.now() - started >= 100, "timeout must elapse");
  assert.ok(Date.now() - started < 2000, "timeout must not hang");
  assert.equal(fake.calls.shutdown.length, 1);
});

test("exceeding the output limit rejects and still cleans up", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(({ emitData }) => {
    emitData("x".repeat(33));
  });
  await assert.rejects(
    runTui({
      configureOats: false,
      harness: fake.harness({ maxOutput: 32 }),
    }),
    /exceeded the output limit/,
  );
  assert.equal(fake.calls.shutdown.length, 1);
});

test("late output during cleanup still fails the run", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onShutdown({ emitData, emitMessage, exit }) {
        emitData("x".repeat(64));
        emitMessage({ type: "clean" });
        exit(0);
      },
    },
  );
  await assert.rejects(
    runTui({
      configureOats: false,
      harness: fake.harness({ maxOutput: 32 }),
    }),
    /exceeded the output limit/,
  );
});

test("a cleanup failure rejects the run", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onShutdown() {
        throw new Error("cleanup failed");
      },
    },
  );
  await assert.rejects(
    runTui({ configureOats: false, harness: fake.harness() }),
    /shutdown request failed: cleanup failed/,
  );
  assert.equal(fake.calls.close, 1);
});

test("a supervisor SIGKILL without cleanup confirmation is a failure", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onShutdown({ exit }) {
        exit(0, "SIGKILL");
      },
    },
  );
  await assert.rejects(
    runTui({ configureOats: false, harness: fake.harness() }),
    /exited without confirming descendant cleanup/,
  );
});

test("SIGKILL escalation is reported as unconfirmed cleanup", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onShutdown({ emitMessage, exit }) {
        emitMessage({ type: "killing" });
        exit(0, "SIGKILL");
      },
    },
  );
  await assert.rejects(
    runTui({ configureOats: false, harness: fake.harness() }),
    /escalated to SIGKILL; group termination cannot be confirmed/,
  );
});

test("a ready message from an unexpected PID is rejected", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    { readyPid: 999 },
  );
  await assert.rejects(
    runTui({ configureOats: false, harness: fake.harness() }),
    /handshake was invalid or came from an unexpected process/,
  );
});

test("clean cleanup requires a successful supervisor exit", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onShutdown({ emitMessage, exit }) {
        emitMessage({ type: "clean" });
        exit(1);
      },
    },
  );
  await assert.rejects(
    runTui({ configureOats: false, harness: fake.harness() }),
    /reported clean cleanup but exited with code 1/,
  );
});

test("TUI runs with an isolated whitelist, expected argv, and bounded tree", async (t) => {
  const executable = installFakeHost(t);
  process.env.OATS_SENTINEL_SECRET = "must-not-leak";
  t.after(() => delete process.env.OATS_SENTINEL_SECRET);
  let observed;
  const fake = createFakeHarness(
    ({ emitData }) => {
      emitData(HOME_FRAME);
      emitData(TOAST_FRAME);
    },
    {
      onSpawn(spawnCall) {
        observed = {
          ...spawnCall,
          root: path.dirname(spawnCall.options.cwd),
          envKeys: Object.keys(spawnCall.options.env).sort(),
          config: JSON.parse(spawnCall.options.env.OPENCODE_CLI_CONFIG_CONTENT),
        };
      },
    },
  );

  await runTui({
    configureOats: true,
    pluginPath: "/opt/oats-plugin",
    harness: fake.harness(),
  });

  assert.equal(observed.file, process.execPath);
  assert.equal(observed.args[0], SUPERVISOR_PATH);
  assert.match(path.basename(observed.args[1]), /^supervisor\.sock$/);
  assert.deepEqual(observed.args.slice(2), [
    executable,
    "--standalone",
    observed.options.cwd,
  ]);
  assert.equal(observed.options.cwd, path.join(observed.root, "project"));
  assert.equal(observed.options.name, "xterm-256color");
  assert.equal(observed.options.cols, 120);
  assert.equal(observed.options.rows, 40);
  assert.deepEqual(observed.envKeys, OUTPUT_WHITELIST);
  assert.equal(observed.options.env.HOME, observed.root);
  assert.equal(observed.options.env.TERM, "xterm-256color");
  assert.equal(observed.options.env.OPENCODE_DISABLE_PROJECT_CONFIG, "1");
  assert.equal(Object.hasOwn(observed.options.env, "OATS_SENTINEL_SECRET"), false);
  for (const key of [
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
    "XDG_STATE_HOME",
  ]) {
    assert.ok(
      observed.options.env[key].startsWith(`${observed.root}${path.sep}`),
      `${key} must stay inside the isolated root`,
    );
  }
  assert.deepEqual(observed.config, {
    plugins: ["/opt/oats-plugin"],
    highlights: false,
  });
  assert.equal(fs.existsSync(observed.root), false, "temp root must be removed");
});

test("hostile fixture stays outside the project and loads only explicitly", async (t) => {
  installFakeHost(t);
  let snapshot;
  const snapshotSpawn = (spawnCall) => {
    const root = path.dirname(spawnCall.options.cwd);
    const ambient = path.join(root, ".opencode", "plugins", "ambient");
    snapshot = {
      plugins: JSON.parse(spawnCall.options.env.OPENCODE_CLI_CONFIG_CONTENT)
        .plugins,
      ambient,
      index: fs.readFileSync(path.join(ambient, "index.ts"), "utf8"),
      tui: fs.readFileSync(path.join(ambient, "tui.ts"), "utf8"),
    };
  };
  const behaviour = ({ emitData }) => {
    emitData(HOME_FRAME);
    emitData(TOAST_FRAME);
  };

  const configured = createFakeHarness(behaviour, { onSpawn: snapshotSpawn });
  await runTui({
    configureOats: true,
    pluginPath: "/opt/oats-plugin",
    hostileAncestor: true,
    loadHostileAsCli: true,
    harness: configured.harness(),
  });
  assert.deepEqual(snapshot.plugins, ["/opt/oats-plugin", snapshot.ambient]);
  assert.match(snapshot.index, /ambient\.server/);
  assert.match(snapshot.tui, /OATS loaded/);

  // The ancestor fixture exists but must not be loaded unless requested.
  const unconfigured = createFakeHarness(behaviour, { onSpawn: snapshotSpawn });
  await runTui({
    configureOats: false,
    hostileAncestor: true,
    harness: unconfigured.harness(),
  });
  assert.deepEqual(snapshot.plugins, []);
});

test("hostile CLI loading requires the ancestor fixture", async (t) => {
  installFakeHost(t);
  const fake = createFakeHarness(() => {});
  await assert.rejects(
    runTui({
      configureOats: false,
      loadHostileAsCli: true,
      harness: fake.harness(),
    }),
    /requires the hostile ancestor fixture/,
  );
  assert.equal(fake.calls.spawn, null);
});

function waitFor(predicate, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (predicate()) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error(message));
      } else {
        setTimeout(poll, 20);
      }
    };
    poll();
  });
}

function withTestTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function waitForExit(pty, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("PTY supervisor did not exit")),
      timeoutMs,
    );
    pty.onExit((status) => {
      clearTimeout(timer);
      resolve(status);
    });
  });
}

function matchPid(output, label) {
  const match = new RegExp(`${label}:(\\d+)`).exec(output);
  return match ? Number(match[1]) : null;
}

/**
 * Spawn the real supervisor on a real PTY. Cleanup closes the authenticated
 * control channel first; a direct kill is only a guarded last resort after
 * the supervisor failed to exit.
 */
function spawnSupervised(t, script) {
  const directory = withTempDir(t);
  const socketPath = path.join(directory, "supervisor.sock");
  const term = nodePty.spawn(
    process.execPath,
    [SUPERVISOR_PATH, socketPath, "/bin/sh", "-c", script],
    {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: directory,
      env: { PATH: process.env.PATH, HOME: directory, TERM: "xterm-256color" },
    },
  );
  let output = "";
  term.onData((chunk) => {
    output += chunk;
  });
  const exitStatus = waitForExit(term, 10_000);
  let exited = false;
  void exitStatus.then(
    () => {
      exited = true;
    },
    () => {},
  );
  const control = { ipc: null, targetPid: null };
  t.after(async () => {
    try {
      control.ipc?.close?.();
    } catch {
      // Control channel already gone.
    }
    await Promise.race([exitStatus.catch(() => {}), delay(1500)]);
    if (!exited) {
      term.kill("SIGKILL");
    }
    if (control.targetPid && processExists(control.targetPid)) {
      try {
        process.kill(control.targetPid, "SIGKILL");
      } catch {
        // Target already gone.
      }
    }
  });
  return {
    directory,
    socketPath,
    term,
    exitStatus,
    control,
    output: () => output,
  };
}

async function connectReady(socketPath) {
  const ipc = await connectSupervisor(socketPath);
  const messages = [];
  let resolveReady;
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });
  ipc.onMessage((message) => {
    messages.push(message);
    if (message.type === "ready") {
      resolveReady(message);
    }
  });
  const ready = await withTestTimeout(
    readyPromise,
    5000,
    "supervisor did not become ready",
  );
  assert.equal(ready.protocol, 2);
  assert.equal(typeof ready.token, "string");
  assert.ok(ready.token.length >= 32, "ready token must be unguessable");
  return { ipc, messages, ready };
}

async function startTarget(ipc, ready, messages) {
  ipc.send({ type: "start", token: ready.token });
  await waitFor(
    () => messages.some((message) => message.type === "target-start"),
    5000,
    "supervisor did not start the target",
  );
}

test(
  "real supervisor kills a TERM/HUP-ignoring descendant after target exit",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(
      t,
      'trap "" TERM HUP; sleep 60 & echo "DESCENDANT:$!"; exit 0',
    );
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;
    await startTarget(ipc, ready, messages);
    await waitFor(
      () => matchPid(setup.output(), "DESCENDANT") !== null,
      5000,
      "descendant pid was not emitted",
    );
    const descendant = matchPid(setup.output(), "DESCENDANT");
    setup.control.targetPid = descendant;
    await waitFor(
      () => processExists(descendant),
      1000,
      "descendant did not start",
    );

    await waitFor(
      () => messages.some((message) => message.type === "target-exit"),
      5000,
      "target exit was not reported",
    );

    ipc.send({ type: "shutdown", token: ready.token, graceMs: 200 });
    await waitFor(
      () => messages.some((message) => message.type === "killing"),
      5000,
      "supervisor did not report SIGKILL escalation",
    );
    await setup.exitStatus;
    await waitFor(
      () => !processExists(descendant),
      3000,
      "TERM/HUP-ignoring descendant survived cleanup",
    );
  },
);

test(
  "real supervisor reports clean cleanup after target early exit",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(t, "exit 0");
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;
    assert.equal(fs.existsSync(setup.socketPath), false, "socket must be unlinked");
    await startTarget(ipc, ready, messages);
    await waitFor(
      () => messages.some((message) => message.type === "target-exit"),
      5000,
      "target exit was not reported",
    );

    ipc.send({ type: "shutdown", token: ready.token, graceMs: 200 });
    await waitFor(
      () => messages.some((message) => message.type === "clean"),
      5000,
      "supervisor did not report clean cleanup",
    );
    const status = await setup.exitStatus;
    assert.equal(status.exitCode, 0);
  },
);

test(
  "authorized shutdown before start does not spawn the target",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(t, 'echo "SHOULD_NOT_RUN"');
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;

    ipc.send({ type: "shutdown", token: ready.token, graceMs: 200 });
    await waitFor(
      () => messages.some((message) => message.type === "clean"),
      5000,
      "supervisor did not report clean cleanup before start",
    );
    const status = await setup.exitStatus;
    assert.equal(status.exitCode, 0);
    assert.equal(
      messages.some(
        (message) =>
          message.type === "target-start" || message.type === "target-exit",
      ),
      false,
      "shutdown before start must not spawn the target",
    );
    assert.equal(setup.output().includes("SHOULD_NOT_RUN"), false);
  },
);

test(
  "past start deadline is rejected without spawning the target",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(t, 'echo "SHOULD_NOT_RUN"');
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;

    ipc.send({
      type: "start",
      token: ready.token,
      deadlineMonotonicNs: "0",
    });
    await waitFor(
      () =>
        messages.some(
          (message) =>
            message.type === "error" &&
            /already expired/.test(message.message),
        ),
      5000,
      "expired deadline was not rejected",
    );
    await waitFor(
      () => messages.some((message) => message.type === "clean"),
      5000,
      "supervisor did not clean up after rejecting the start",
    );
    const status = await setup.exitStatus;
    assert.equal(status.exitCode, 0);
    assert.equal(
      messages.some(
        (message) =>
          message.type === "target-start" || message.type === "target-exit",
      ),
      false,
      "expired start must not spawn the target",
    );
    assert.equal(setup.output().includes("SHOULD_NOT_RUN"), false);
  },
);

test(
  "malformed start deadline fails closed without spawning the target",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(t, 'echo "SHOULD_NOT_RUN"');
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;

    ipc.send({
      type: "start",
      token: ready.token,
      deadlineMonotonicNs: "not-a-deadline",
    });
    await waitFor(
      () =>
        messages.some(
          (message) =>
            message.type === "error" &&
            /invalid start deadline/.test(message.message),
        ),
      5000,
      "malformed deadline was not rejected",
    );
    await waitFor(
      () => messages.some((message) => message.type === "clean"),
      5000,
      "supervisor did not clean up after rejecting the start",
    );
    const status = await setup.exitStatus;
    assert.equal(status.exitCode, 0);
    assert.equal(
      messages.some(
        (message) =>
          message.type === "target-start" || message.type === "target-exit",
      ),
      false,
      "malformed deadline must not spawn the target",
    );
    assert.equal(setup.output().includes("SHOULD_NOT_RUN"), false);
  },
);

test(
  "hostile target killing the supervisor cannot produce a success report",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(
      t,
      'trap "" HUP; trap "kill -KILL $PPID" TERM; echo "TARGET:$$"; while :; do sleep 1; done',
    );
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;
    await startTarget(ipc, ready, messages);
    await waitFor(
      () => matchPid(setup.output(), "TARGET") !== null,
      5000,
      "target pid was not emitted",
    );
    const targetPid = matchPid(setup.output(), "TARGET");
    setup.control.targetPid = targetPid;

    ipc.send({ type: "shutdown", token: ready.token, graceMs: 500 });
    await withTestTimeout(ipc.closed, 5000, "supervisor control channel stayed open");
    await delay(100);

    assert.equal(
      messages.some(
        (message) => message.type === "clean" || message.type === "killing",
      ),
      false,
      "supervisor death must not be reported as cleanup success",
    );
    assert.ok(processExists(targetPid), "hostile target survived supervisor death");

    // Let the test tear down the surviving target so the PTY can close.
    process.kill(targetPid, "SIGKILL");
    const status = await setup.exitStatus;
    assert.ok(
      status.signal === "SIGKILL" || status.signal === 9,
      `supervisor should have died by SIGKILL, got ${status.signal}`,
    );
  },
);

test(
  "forged control commands are rejected and the token is not exposed",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(t, "sleep 60");
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;
    assert.equal(fs.existsSync(setup.socketPath), false, "socket must be unlinked");

    ipc.send({ type: "start", token: "0".repeat(64) });
    await waitFor(
      () => messages.some((message) => message.type === "error"),
      5000,
      "forged start was not rejected",
    );
    assert.equal(
      messages.some((message) => message.type === "target-start"),
      false,
      "forged start launched the target",
    );

    await startTarget(ipc, ready, messages);
    const targetStart = messages.find((message) => message.type === "target-start");
    setup.control.targetPid = targetStart.pid;

    if (process.platform === "linux") {
      const supervisorCmdline = fs.readFileSync(`/proc/${ready.pid}/cmdline`, "utf8");
      const supervisorEnv = fs.readFileSync(`/proc/${ready.pid}/environ`, "utf8");
      const targetEnv = fs.readFileSync(`/proc/${targetStart.pid}/environ`, "utf8");
      assert.equal(supervisorCmdline.includes(ready.token), false, "token leaked via argv");
      assert.equal(supervisorEnv.includes(ready.token), false, "token leaked via supervisor env");
      assert.equal(targetEnv.includes(ready.token), false, "token leaked via target env");
    }

    ipc.send({ type: "shutdown", token: "0".repeat(64), graceMs: 200 });
    await waitFor(
      () => messages.some((message) => message.type === "error"),
      5000,
      "forged request was not rejected",
    );
    assert.match(
      messages.find((message) => message.type === "error").message,
      /unauthorized/,
    );

    let closed = false;
    void ipc.closed.then(() => {
      closed = true;
    });
    await delay(300);
    assert.equal(closed, false, "forged request shut the supervisor down");
    await assert.rejects(
      connectSupervisor(setup.socketPath, { timeoutMs: 200 }),
      /IPC unavailable/,
    );

    ipc.send({ type: "shutdown", token: ready.token, graceMs: 200 });
    await waitFor(
      () =>
        messages.some(
          (message) => message.type === "clean" || message.type === "killing",
        ),
      5000,
      "authorized shutdown was not processed",
    );
    await setup.exitStatus;
  },
);

test(
  "supervisor bounds client-requested grace to its own maximum",
  { skip: nodePty === null },
  async (t) => {
    const setup = spawnSupervised(
      t,
      'trap "" TERM; echo "TARGET:$$"; while :; do sleep 1; done',
    );
    const { ipc, messages, ready } = await connectReady(setup.socketPath);
    setup.control.ipc = ipc;
    await startTarget(ipc, ready, messages);
    await waitFor(
      () => matchPid(setup.output(), "TARGET") !== null,
      5000,
      "target pid was not emitted",
    );
    setup.control.targetPid = matchPid(setup.output(), "TARGET");

    const started = Date.now();
    ipc.send({ type: "shutdown", token: ready.token, graceMs: 600_000 });
    await waitFor(
      () => messages.some((message) => message.type === "killing"),
      8000,
      "supervisor trusted an unbounded client grace",
    );
    assert.ok(
      Date.now() - started < 8000,
      "cleanup must be bounded by the supervisor's own timeout",
    );
    await setup.exitStatus;
  },
);
