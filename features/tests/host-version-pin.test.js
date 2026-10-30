/**
 * Independent regression coverage for issue #25: the exact OpenCode host pin
 * in .github/tooling/opencode-host/package.json is the single source of truth.
 *
 * These tests exercise the real-host prerequisite and TUI smoke harnesses as
 * black boxes against disposable checkouts with different manifest pins. They
 * would fail if either harness kept a version literal, ignored the manifest,
 * or accepted historical version references as the pin.
 *
 * Run with: node --test features/tests/host-version-pin.test.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const hostManifestPath = join(
  repositoryRoot,
  ".github/tooling/opencode-host/package.json",
);
// Independent oracle for the checked-in pin: exact npm semver requires
// canonical numeric components no larger than Number.MAX_SAFE_INTEGER.
const exactRelease = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const MAX_SAFE_COMPONENT = 9007199254740991n;

function isExactNpmRelease(value) {
  if (typeof value !== "string" || !exactRelease.test(value)) {
    return false;
  }
  return value.split(".").every(component => BigInt(component) <= MAX_SAFE_COMPONENT);
}

const originalOpenCode = process.env.OATS_OPENCODE;

afterEach(() => {
  if (originalOpenCode === undefined) {
    delete process.env.OATS_OPENCODE;
  } else {
    process.env.OATS_OPENCODE = originalOpenCode;
  }
});

function temporaryDirectory(t) {
  const preferred = existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir();
  const directory = mkdtempSync(join(preferred, "oats-host-pin-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeFile(directory, relativePath, contents) {
  const target = join(directory, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

// A disposable checkout keeps the harness modules at their normal depth so
// they resolve the fixture manifest, never the checked-in one.
function prepareCheckout(t, manifest) {
  const directory = temporaryDirectory(t);
  cpSync(join(repositoryRoot, "features/steps"), join(directory, "features/steps"), {
    recursive: true,
  });
  cpSync(
    join(repositoryRoot, "features/real-host-tests"),
    join(directory, "features/real-host-tests"),
    { recursive: true },
  );
  if (manifest !== undefined) {
    writeFile(
      directory,
      ".github/tooling/opencode-host/package.json",
      typeof manifest === "string" ? manifest : `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
  return directory;
}

function manifestFor(pin) {
  return { name: "oats-ci-opencode-host", version: "1.0.0", dependencies: { "@opencode/cli": pin } };
}

const TUI_HARNESS = "features/steps/tui_smoke_helper.js";
const REAL_HOST_HARNESS = "features/real-host-tests/prerequisites.js";

// A failure while loading a harness must still be about the configured pin,
// not an unrelated import error that happens to be thrown.
const PIN_ERROR = /host pin|@opencode\/cli.*pin|exact release/i;

let importSequence = 0;

// Import each checkout afresh so one fixture's pin cannot leak into another.
async function importHarness(directory, relativePath) {
  importSequence += 1;
  return import(
    `${pathToFileURL(join(directory, relativePath)).href}?fixture=${importSequence}`
  );
}

async function importHarnesses(directory) {
  return {
    tui: await importHarness(directory, TUI_HARNESS),
    prerequisites: await importHarness(directory, REAL_HOST_HARNESS),
  };
}

// POSIX single-quote escaping: close the quote, emit an escaped quote, reopen.
function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function fakeHost(directory, reportedVersion) {
  const executable = join(directory, "opencode");
  const startedMarker = join(directory, "invoked-without-version");
  const probeMarker = join(directory, "version-probed");
  writeFileSync(
    executable,
    '#!/bin/sh\n' +
      'if [ "$1" = "--version" ]; then\n' +
      `  : > ${shellQuote(probeMarker)}\n` +
      `  printf '%s\\n' ${shellQuote(reportedVersion)}\n` +
      "else\n" +
      `  : > ${shellQuote(startedMarker)}\n` +
      "fi\n",
    { mode: 0o755 },
  );
  return { executable, startedMarker, probeMarker };
}

function requireHost(prerequisites, executable) {
  return prerequisites.requireRealHost(executable, { platform: "linux", sources: [] });
}

// The TUI harness validates the host before spawning the real PTY. A throwing
// spawn is both a marker that validation passed and a safe stand-in for the
// real host process.
async function tuiAcceptsHost(tui, executable) {
  process.env.OATS_OPENCODE = executable;
  const outcome = { spawnReached: false, error: null };
  try {
    await tui.runTui({
      configureOats: false,
      harness: {
        spawnPty() {
          outcome.spawnReached = true;
          throw new Error("SPAWN_REACHED");
        },
      },
    });
  } catch (error) {
    outcome.error = error;
  }
  return outcome;
}

function assertTuiRejectsPin(tui, executable, errorPattern) {
  return tuiAcceptsHost(tui, executable).then(({ spawnReached, error }) => {
    assert.ok(error, "an invalid or mismatched host pin must reject");
    if (errorPattern) {
      assert.match(error.message, errorPattern, `TUI rejected for a non-pin reason: ${error.message}`);
    }
    assert.equal(spawnReached, false, "an invalid or mismatched host reached TUI startup");
  });
}

function assertHostNotProbed({ startedMarker, probeMarker }) {
  assert.equal(existsSync(probeMarker), false, "an invalid pin probed the host version");
  assert.equal(existsSync(startedMarker), false, "an invalid pin started the host");
}

function assertPinImportError(error) {
  assert.ok(error instanceof Error, "a harness import must fail with an Error");
  assert.match(error.message, PIN_ERROR, `harness import failed for a non-pin reason: ${error.message}`);
}

// Exercise each harness independently so one import failure cannot stand in
// for verification of the other.
async function assertRealHostRejectsPin(directory, markers) {
  let prerequisites;
  try {
    prerequisites = await importHarness(directory, REAL_HOST_HARNESS);
  } catch (error) {
    assertPinImportError(error);
    assertHostNotProbed(markers);
    return;
  }
  assert.throws(() => requireHost(prerequisites, markers.executable), PIN_ERROR);
  assertHostNotProbed(markers);
}

async function assertTuiHarnessRejectsPin(directory, markers) {
  let tui;
  try {
    tui = await importHarness(directory, TUI_HARNESS);
  } catch (error) {
    assertPinImportError(error);
    assertHostNotProbed(markers);
    return;
  }
  await assertTuiRejectsPin(tui, markers.executable, PIN_ERROR);
  assertHostNotProbed(markers);
}

test("the checked-in host pin is an exact release", () => {
  const manifest = JSON.parse(readFileSync(hostManifestPath, "utf8"));
  const pin = manifest.dependencies?.["@opencode/cli"];
  assert.match(pin ?? "", exactRelease, `Expected an exact @opencode/cli pin, got ${pin}`);
  assert.equal(
    isExactNpmRelease(pin),
    true,
    `Expected an npm-exact @opencode/cli pin with safe components, got ${pin}`,
  );
});

test("fake host quoting preserves marker paths and reported versions with quotes", (t) => {
  const root = temporaryDirectory(t);
  const directory = join(root, "tmp'quoted");
  mkdirSync(directory, { recursive: true });
  const reported = "opencode v9.8.7'quoted";
  const markers = fakeHost(directory, reported);

  const probe = spawnSync(markers.executable, ["--version"], { encoding: "utf8" });
  assert.ifError(probe.error);
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout, `${reported}\n`);
  assert.equal(existsSync(markers.probeMarker), true, "version probe marker was not written");
  assert.equal(existsSync(markers.startedMarker), false, "version probe started the host");

  const start = spawnSync(markers.executable, [], { encoding: "utf8" });
  assert.ifError(start.error);
  assert.equal(start.status, 0, start.stderr);
  assert.equal(existsSync(markers.startedMarker), true, "start marker was not written");
});

test("both harnesses derive the expected version from a different manifest pin", async (t) => {
  for (const pin of ["9.8.7", "2.1.0"]) {
    await t.test(pin, async (t) => {
      const directory = prepareCheckout(t, manifestFor(pin));
      const { tui, prerequisites } = await importHarnesses(directory);
      const markers = fakeHost(directory, pin);

      assert.deepEqual(requireHost(prerequisites, markers.executable), { executable: markers.executable });
      const outcome = await tuiAcceptsHost(tui, markers.executable);
      assert.equal(outcome.spawnReached, true, `TUI rejected manifest pin ${pin}: ${outcome.error}`);
      assert.equal(existsSync(markers.probeMarker), true, "the selected version must be probed");
      assert.equal(existsSync(markers.startedMarker), false, "version probing must not start the host");
    });
  }
});

test("a host version that matches an old hardcoded literal is rejected for another pin", async (t) => {
  const directory = prepareCheckout(t, manifestFor("9.8.7"));
  const { tui, prerequisites } = await importHarnesses(directory);
  const markers = fakeHost(directory, "opencode v2.0.32");

  assert.throws(() => requireHost(prerequisites, markers.executable), /9\.8\.7/);
  await assertTuiRejectsPin(tui, markers.executable);
  assert.equal(existsSync(markers.startedMarker), false, "legacy host literal reached startup");
});

test("a mismatched host version fails closed in both harnesses", async (t) => {
  const directory = prepareCheckout(t, manifestFor("9.8.7"));
  const { tui, prerequisites } = await importHarnesses(directory);

  for (const version of ["opencode v9.8.6", "opencode v9.8.70", "opencode v9.8.7-rc.1", "9.8"]) {
    await t.test(version, async (t) => {
      const markers = fakeHost(temporaryDirectory(t), version);
      assert.throws(() => requireHost(prerequisites, markers.executable), /OpenCode/);
      await assertTuiRejectsPin(tui, markers.executable);
      assert.equal(existsSync(markers.startedMarker), false, "unsupported host reached startup");
    });
  }
});

test("an invalid or missing pin fails closed even when the host reports a supported release", async (t) => {
  const invalidManifests = {
    "missing manifest": undefined,
    "malformed manifest": "{ not json",
    "missing dependency": { dependencies: {} },
    "absent dependencies": { name: "oats-ci-opencode-host" },
    "range pin": manifestFor("^9.8.7"),
    "tilde pin": manifestFor("~9.8.7"),
    "minor pin": manifestFor("9.8"),
    "latest pin": manifestFor("latest"),
    "wildcard pin": manifestFor("*"),
    "prerelease pin": manifestFor("9.8.7-rc.1"),
    "compound range": manifestFor("9.8.7 || 9.8.8"),
  };

  for (const [name, manifest] of Object.entries(invalidManifests)) {
    await t.test(name, async (t) => {
      const directory = prepareCheckout(t, manifest);
      // The legacy literal must not make an invalid pin look acceptable.
      const markers = fakeHost(directory, "opencode v2.0.32");
      await assertRealHostRejectsPin(directory, markers);
      await assertTuiHarnessRejectsPin(directory, markers);
    });
  }
});

test("malformed pin values fail closed before the host is probed", async (t) => {
  // The fake host reports the pin value verbatim. Only pin validation can
  // reject these cases; a version comparison would otherwise match.
  const malformedPins = {
    "leading-zero major": { pin: "01.2.3", reported: "opencode v01.2.3" },
    "leading-zero minor": { pin: "1.02.3", reported: "opencode v1.02.3" },
    "leading-zero patch": { pin: "1.2.03", reported: "opencode v1.2.03" },
    "oversized major": {
      pin: "9007199254740992.0.0",
      reported: "opencode v9007199254740992.0.0",
    },
    "oversized minor": {
      pin: "0.9007199254740992.0",
      reported: "opencode v0.9007199254740992.0",
    },
    "oversized patch": {
      pin: "0.0.9007199254740992",
      reported: "opencode v0.0.9007199254740992",
    },
    "surrounding spaces": { pin: " 9.8.7 ", reported: "opencode v 9.8.7 " },
    "empty pin": { pin: "", reported: "" },
    "whitespace-only pin": { pin: "   ", reported: "   " },
    "numeric pin": { pin: 12345, reported: "12345" },
    "null pin": { pin: null, reported: "null" },
    "array pin": { pin: ["9.8.7"], reported: "opencode v9.8.7" },
    "object pin": { pin: { version: "9.8.7" }, reported: "opencode v9.8.7" },
  };

  for (const [name, { pin, reported }] of Object.entries(malformedPins)) {
    await t.test(name, async (t) => {
      const directory = prepareCheckout(t, manifestFor(pin));
      const markers = fakeHost(directory, reported);
      await assertRealHostRejectsPin(directory, markers);
      await assertTuiHarnessRejectsPin(directory, markers);
    });
  }
});

test("maximum safe numeric components are accepted by both harnesses", async (t) => {
  const boundaryPins = [
    "9007199254740991.0.0",
    "0.9007199254740991.0",
    "0.0.9007199254740991",
  ];

  for (const pin of boundaryPins) {
    await t.test(pin, async (t) => {
      const directory = prepareCheckout(t, manifestFor(pin));
      const { tui, prerequisites } = await importHarnesses(directory);
      const markers = fakeHost(directory, `opencode v${pin}`);

      assert.deepEqual(requireHost(prerequisites, markers.executable), { executable: markers.executable });
      const outcome = await tuiAcceptsHost(tui, markers.executable);
      assert.equal(outcome.spawnReached, true, `TUI rejected boundary pin ${pin}: ${outcome.error}`);
      assert.equal(existsSync(markers.probeMarker), true, "the selected version must be probed");
      assert.equal(existsSync(markers.startedMarker), false, "version probing must not start the host");
    });
  }
});

test("historical version fixtures are not mistaken for the pin", async (t) => {
  const directory = prepareCheckout(t, manifestFor("9.8.7"));
  // Version references remain legitimate in historical fixtures, comments,
  // and old lockfile entries. Only the manifest pin selects the host.
  writeFile(
    directory,
    "features/tests/fixtures/opencode-2.0.32.fixture.json",
    '{"host":"opencode","version":"2.0.32"}\n',
  );
  writeFile(
    directory,
    ".github/tooling/opencode-host/legacy-2.0.32.json",
    '{"version":"2.0.32"}\n',
  );
  const { tui, prerequisites } = await importHarnesses(directory);
  const markers = fakeHost(directory, "9.8.7");

  assert.deepEqual(requireHost(prerequisites, markers.executable), { executable: markers.executable });
  const outcome = await tuiAcceptsHost(tui, markers.executable);
  assert.equal(outcome.spawnReached, true, `historical fixture was treated as the pin: ${outcome.error}`);
});

test("the checked-in host executable pin resolves through the repository manifest", (t) => {
  const pin = JSON.parse(readFileSync(hostManifestPath, "utf8")).dependencies["@opencode/cli"];
  const directory = prepareCheckout(t, manifestFor(pin));
  const { executable } = fakeHost(directory, `opencode v${pin}`);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import(${JSON.stringify(pathToFileURL(join(directory, "features/real-host-tests/prerequisites.js")).href)})` +
        `.then(({ requireRealHost }) => requireRealHost(${JSON.stringify(executable)}, { platform: "linux", sources: [] }))` +
        ".then(() => process.exit(0), error => { console.error(error.message); process.exit(1); })",
    ],
    { encoding: "utf8", timeout: 30_000, env: { ...process.env, OATS_OPENCODE: executable } },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Checked-in pin ${pin} was rejected: ${result.stderr}`);
});
