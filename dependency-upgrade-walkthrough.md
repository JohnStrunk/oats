# OpenCode Plugin 2.1.4 Dependency Upgrade

Recorded on 2026-11-02T17:25:15Z by Showboat 0.6.1.
<!-- showboat-id: 5eb6dde8-2b89-42ca-af51-0037f20fe8e0 -->

## Why this replacement exists

PR #44 has merged into `main` as merge commit `56773fe`; its OpenTUI 0.6.8 peer update and empty-state test fix are now in `main`. This replacement supersedes PR #38, whose original artifact failed the OpenTUI peer-version floor and carried a stale lockfile. This PR branch is rebased onto updated `main` and changes only `@opencode/plugin` from `2.0.32` to `2.1.4`, plus the regenerated `package-lock.json`.

## Manifest, lockfile, and pinned host

The following read-only Node check compares the root manifest and lockfile pins for the plugin and OpenTUI packages, plus the pinned host manifest and lockfile for the CLI. It exits unsuccessfully if any version differs from the expected pin.

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const read = path => JSON.parse(readFileSync(path, "utf8"));
const manifest = read("package.json");
const lock = read("package-lock.json");
const hostManifest = read(".github/tooling/opencode-host/package.json");
const hostLock = read(".github/tooling/opencode-host/package-lock.json");
const checks = [
  ["@opencode/plugin", manifest.dependencies?.["@opencode/plugin"], lock.packages?.["node_modules/@opencode/plugin"]?.version, "2.1.4"],
  ["@opentui/core", manifest.devDependencies?.["@opentui/core"], lock.packages?.["node_modules/@opentui/core"]?.version, "0.6.8"],
  ["@opentui/solid", manifest.devDependencies?.["@opentui/solid"], lock.packages?.["node_modules/@opentui/solid"]?.version, "0.6.8"],
  ["@opencode/cli", hostManifest.dependencies?.["@opencode/cli"], hostLock.packages?.["node_modules/@opencode/cli"]?.version, "2.1.4"],
];
const failures = checks.filter(([, manifestVersion, lockVersion, expected]) => manifestVersion !== expected || lockVersion !== expected);
if (failures.length) {
  for (const [name, manifestVersion, lockVersion, expected] of failures) {
    console.error(`${name}: expected ${expected}; manifest=${manifestVersion ?? "missing"}; lock=${lockVersion ?? "missing"}`);
  }
  process.exitCode = 1;
} else {
  for (const [name, manifestVersion] of checks) console.log(`${name}: ${manifestVersion} (manifest and lock)`);
  console.log("All four dependency pins match.");
}
'

```

```output
@opencode/plugin: 2.1.4 (manifest and lock)
@opentui/core: 0.6.8 (manifest and lock)
@opentui/solid: 0.6.8 (manifest and lock)
@opencode/cli: 2.1.4 (manifest and lock)
All four dependency pins match.
```

## Real pinned-host TUI demo

This runs the repository's synthetic sidebar demo against the pinned OpenCode host. The transcript below is captured from the live local TUI and its temporary demo server; it is not mocked.

```bash
PATH=/tmp/opencode/node26bin/bin:$PATH OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node scripts/demo-walkthrough.js
```

```output
=== Step 1: Sidebar with Agent stats (details) ===
   OATS Demo session             +
                                                                                                                                          ┃                  ┃
                                                                                                                        OATS Demo session ┃  OATS loaded  x  ┃
                                                                                                                                          ┃                  ┃
                                                                                                                        Context
                                                                                                                        3 tokens

                                                                                                                        ▼ Agent stats (details)
                                                                                                                        alpha:                         $3.00
                                                                                                                        beta:                          $2.00e
                                                                                                                        gamma:                   unavailable
                                                                                                                        zero:                          $0.00
                                                                                                                        Unattributed:                  $1.00e
                                                                                                                        e = incomplete total
                                                                                                                        Summary incomplete

                                                                                                                          ⬖ Getting started                ✕

                                                                                                                            OpenCode includes free models so
                                                                                                                            you can start immediately.

                                                                                                                            Connect from 75+ providers to
                                                                                                                            use other models, including
  ┃                                                                                                                         Claude, GPT, Gemini etc
  ┃
  ┃                                                                                                                         Connect provider        /connect
  ┃  Build · probe-model (unavailable) oats-sidebar-probe
  ╹
  /tmp/opencode/isolated-demo-project                                             3  ctrl+p commands    /…/isolated-demo-project


=== Step 2: Clicking (details) link ===
Clicked (details) at row 8, column 135

=== Step 3: Usage Details Modal Rendered ===
   OATS Demo session             +
                                                                                                                                          ┃                  ┃
                                                                                                                        OATS Demo session ┃  OATS loaded  x  ┃
                                                                                                                                          ┃                  ┃
                                                                                                                        Context
                                                                                                                        3 tokens

                                                                                                                            ent stats (details)
                                    alpha - oats-sidebar-probe/alpha-model  $3.00                                           a:                         $3.00
                                            input          output         cache write     cache read                        :                          $2.00e
                                    Price   —              —              —               —                                 a:                   unavailable
                                    Tokens  2              4              0               0                                 :                          $0.00
                                    Cost    —              —              —               —                                 tributed:                  $1.00e
                                                                                                                            incomplete total
                                    beta - oats-sidebar-probe/beta-model  $2.00e                                            ary incomplete
                                            input          output         cache write     cache read
                                    Price   —              —              —               —
                                    Tokens  2              4              0               0
                                    Cost    —              —              —               —

                                    gamma - oats-sidebar-probe/gamma-model  unavailablee
                                            input          output         cache write     cache read
                                    Price   —              —              —               —

                                                                                                                            Getting started                ✕

                                                                                                                            OpenCode includes free models so
                                                                                                                            you can start immediately.

                                                                                                                            Connect from 75+ providers to
                                                                                                                            use other models, including
  ┃                                                                                                                         Claude, GPT, Gemini etc
  ┃
  ┃                                                                                                                         Connect provider        /connect
  ┃  Build · probe-model (unavailable) oats-sidebar-probe
  ╹
  /tmp/opencode/isolated-demo-project                                             3  ctrl+p commands    /…/isolated-demo-project


Demo successfully verified against live OpenCode TUI.
```

## Verification results

Observed results from this worktree (test suites were not rerun while preparing this walkthrough):

- `npm ci` — exited 0.
- `npm run test:unit` — 390 passed, 0 failed, 13 skipped.
- `OATS_REQUIRE_SIDEBAR_UI=1 npm run test:unit:sidebar-ui` — 13 passed.
- `npm run test:real-host` — 7 `PASS` lines.
- `npm run test:features` — 292 scenarios and 4,311 steps passed.
