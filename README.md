# OATS — OpenCode Agent Token Stats

OATS is a minimal OpenCode v2 TUI plugin, intended to help explain token usage
and estimated costs across agents, subagents, and models.

**Current behavior:** a brief **OATS loaded** startup toast confirms that the
plugin loaded. Session data access supplies available historical and live
individual records for the displayed session and its descendants. Aggregated token
statistics, derived cost estimates, and reporting views remain planned.

## Try the local plugin

Prerequisites:

- OpenCode **v2.0.32**, the pinned host version;
  compatibility with other releases is not established.
- Node.js and npm for checkout development and verification. The exact Node.js
  release is specified in `.nvmrc` and CI, which pin the same version.
  Local verification with `npm test` has passed on Node.js **26.13.0**. For
  Node.js 22, the locked dependency tree requires **22.19.0 or later**, including
  a production transitive dependency of `@opencode/plugin@2.1.0`; it is not
  solely a test dependency requirement. The Cucumber.js test runner declares
  support for Node.js **22, 24, or 26 and later** (not 23 or 25); this declared
  range does not establish verification of every version in it. The root package
  does not currently declare an `engines` field to enforce these constraints.
  Official Node.js Linux binaries since Node.js 25 may require installing `libatomic`
  separately, depending on your distribution; see the
  [Node.js 26.13.0 release notes](https://nodejs.org/en/blog/release/v26.13.0).

From this checkout, install dependencies:

```bash
npm ci
opencode --version
```

For a one-off launch, replace the example path with this checkout's absolute
path:

```bash
OPENCODE_CLI_CONFIG_CONTENT='{"plugins":["/absolute/path/to/oats"]}' opencode --standalone
```

The inline setting does not edit your configuration file. It overrides the
configured CLI plugin list for this launch, rather than appending to it;
include any other plugins you want to keep active. Other global settings and
discovered project configuration still apply. `--standalone` uses a private
server instead of the shared background service; it does not isolate your
configuration.

For persistent loading, add the absolute checkout path to the existing
`plugins` array in `~/.config/opencode/cli.json`, or
`$XDG_CONFIG_HOME/opencode/cli.json` if `XDG_CONFIG_HOME` is set. Preserve all
other settings and existing plugin entries. A new file can look like this:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["/absolute/path/to/oats"]
}
```

Start `opencode --standalone` and look for **OATS loaded** shortly after startup.
OATS is TUI-only: configure it in the global `cli.json`, not `opencode.json`.
There is no project-local `cli.json`. See the official V2
[CLI plugin configuration](https://opencode.ai/v2/docs/cli/plugins) and
[TUI plugin API](https://opencode.ai/v2/docs/build/plugins/cli).

## Session data access

Session data access retains each record's recorded agent and model identities,
reported usage, and OpenCode-reported cost rather than attributing historical
work to current selections. Unknown usage or cost remains distinct from a
reported zero; reported cost is not proof of the provider's actual charge.

The dataset follows the displayed session subtree, is empty when no session is
displayed, and incorporates live record updates without duplicates. Missing
identity or usage is exposed as a gap, not replaced with an invented value or
record. Copied fork records are excluded, and uncertain provenance is flagged
rather than assumed to be new work. Without provenance distinguishing copies
from new execution, all historical records for a known fork may be withheld,
including possible post-fork work. Independently attributable descendants and
live-witnessed work may still be available, but do not make that history
complete.

Failed or unavailable session metadata withholds unproven history until lookup
recovery allows attribution; it is not treated as proof that a session is not
a fork. Partial loading failures preserve attributable records and indicate
incompleteness; refresh retries unavailable data where the host can supply it.

OpenCode v2.0.32 typically does not persist historical events. Some event-only
usage and retry attempts may be unreconstructible once those events are lost,
so available records are not a guarantee of complete history. Refresh cannot
recover data the host no longer has. This is a data-access capability only;
aggregation, pricing calculations, and statistics UI remain planned.

## Planned experience

- A compact sidebar overview of token usage and estimated costs.
- An expanded view with token and estimated-cost breakdowns per agent and
  subagent, and per model.

Usage reporting and cost estimates will depend on the data available from
OpenCode and model providers. Estimates are informational, not billing
guarantees, and may differ from provider invoices.

## Specification-driven development

The project uses an agent-assisted, specification-driven workflow:

1. Define the goals and audience in [Vision.md](Vision.md).
2. Describe components and interfaces in [Architecture.md](Architecture.md).
3. Refine requirements into EARS (Easy Approach to Requirements Syntax) rules
   and Gherkin specifications in [features/](features/), with executable step
   definitions.
4. Implement behavior against those specifications, then verify and audit it.

Feature specifications follow the conventions in
[features/AGENTS.md](features/AGENTS.md). The reporting experience above remains
planned; the startup toast remains the current visible bootstrap behavior.

## Development and verification

The bootstrap is a JavaScript package with a TUI entrypoint; no build step is
needed to load the local checkout. Run `npm ci` after dependency changes.

The package exports `./tui` as `src/tui.js`. A root-level `tui.js` forwards to
that entrypoint because the v2.0.32 host's local-directory resolver needs the
root file even with the package export present. Keep this shim when changing
the plugin entrypoint.

Acceptance tests use Cucumber.js with JavaScript ES modules; unit tests use
Node.js's built-in test runner. Install the locked dependencies with
`npm ci`, then run verification commands from the repository root.

The real-host smoke harness needs a native PTY dependency. If installation
builds it from source, Linux requires Python, `make`, and a C/C++ build toolchain;
macOS requires Python and the Xcode command-line build tools. Python may also
be used by unrelated repository tooling; it is not the acceptance-test runner.

Run the unit suite, including smoke-harness, migration, workflow scheduling,
workflow-gate, real-linter boundary, and session-data tests, without launching
OpenCode. First complete the [CI verification setup](#local-ci-verification)
below; the unit suite requires the lint tools as well as Bash on `PATH`:

```bash
npm run test:unit
```

The unit suite does not launch a real OpenCode host. The separate
[`session-data-access.real-host.test.js`](features/real-host-tests/session-data-access.real-host.test.js)
launches a real OpenCode **v2.0.32** server. It checks the
HTTP/SDK contract and session data access using imported synthetic sessions
and messages, without model calls. Live settlement and event deduplication
remain covered by fake-host tests, not this real-host contract test.

Run this contract separately with the absolute path to the pinned host:

```bash
npm ci --prefix .github/tooling/opencode-host
OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" \
  npm run test:real-host
```

The command fails rather than skips on Windows, an absent or wrong-version
host, or system configuration that exists or cannot be inspected. It never
falls back to another host. CI installs the pinned host and runs this command
separately from the unit and feature suites. `npm test` does not include it.

The server runs on loopback with temporary home, XDG, and project directories
and a minimal child environment. Project configuration discovery, automatic
updates, and model metadata fetching are disabled using the same controls
described for the TUI smoke harness below. These controls do not guarantee
network isolation or offline operation. The contract test does not launch a
TUI or require a pseudo-terminal.

Run the real-host TUI smoke scenarios:

```bash
npm run test:features -- --tags '@component:plugin-ui'
```

These scenarios require a POSIX host with pseudo-terminal and Unix-domain socket
support, plus an OpenCode **v2.0.32** executable on `PATH`. Process inspection
requires `/proc` on Linux or `ps` on other supported POSIX hosts. Windows is
unsupported. Set
`OATS_OPENCODE=/absolute/path/to/opencode` to select that host explicitly.
The harness starts a real standalone TUI with temporary home and XDG
directories and a minimal child environment. It checks for the rendered
startup toast and runs a no-plugin control that must not show it. No model
interaction is required. These are host smoke tests, not token-reporting tests.

Cleanup covers only the supervisor's process group. Descendants can escape into
other process groups or sessions; supervisor failure may leave cleanup
unconfirmed. The harness does not guarantee termination of every descendant.

For v2.0.32, the harness sets `OPENCODE_DISABLE_PROJECT_CONFIG=1`,
`OPENCODE_DISABLE_AUTOUPDATE=1`, and `OPENCODE_DISABLE_MODELS_FETCH=1` to
suppress project and ancestor configuration discovery, automatic updates, and
model metadata fetching. System configuration is independent of these controls,
so the harness refuses to run if a system configuration source exists or cannot
be inspected: `/etc/opencode` on non-macOS hosts, or the OpenCode system and
managed-preference locations on macOS. Use a host without those sources rather
than removing system configuration to run a test. These controls do not
guarantee network isolation or offline operation.

To use the same locked OpenCode host as CI without a global installation:

```bash
npm ci --prefix .github/tooling/opencode-host
OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" \
  npm run test:features -- --tags '@component:plugin-ui'
```

Run all feature scenarios, including the host smoke tests:

```bash
npm run test:features
```

Run unit tests and all feature scenarios together:

```bash
npm test
```

The full suite requires both the smoke-test host prerequisites and the
[CI verification setup](#local-ci-verification).
Pass Cucumber options with `npm run test:features -- ...`, not `npm test`;
tag expressions include the `@` prefix.

### Runner-contract disk limits

Every process launched through `runProcess` in
`features/tests/migration-process.js` runs behind a POSIX per-file write
ceiling of **8 MiB** (at most 8 MiB + 512 bytes, depending on the shell's
`ulimit -f` block size). The affected callers are the acceptance-step support
in `features/tests/migration-step-support.js` (including the disk-limit fixture
steps in `features/steps/disk-limit-support.js`),
`features/tests/migration-contract.test.js`,
`features/tests/runner-file-limit.test.js`,
`features/tests/workflow-gate-property.test.js`, and any future code that calls
`runProcess`. It is not a limit on `npm test` itself, the TUI smoke helper
(which does not use `runProcess`), or commands run outside the helper.

A launch establishes the ceiling like this:

1. A Node probe runs under `ulimit -f 1` and installs a no-op `SIGXFSZ` handler
   so an over-limit write can report `EFBIG` instead of terminating the probe.
   It writes one byte at a time until the kernel reports `EFBIG`, then prints
   the resulting file size. Writing single bytes makes the measurement
   independent of whether an oversized write is rejected outright or partially
   written up to the limit.
2. The wrapper computes the smallest `ulimit -f` block count whose product is
   at least 8 MiB, and refuses the launch if that product exceeds 8 MiB + 512
   bytes or if the probe could not observe a ceiling within its 8192-byte
   budget.
3. It sets **both** the soft and hard limits to that block count, reads both
   back with `ulimit -S -f` and `ulimit -H -f`, and exits 125 before `exec` if
   any step fails. The feature runner therefore never starts when the ceiling
   cannot be established.

The hard/soft equality matters: a process may lower its soft limit and raise
it again, but it can only raise it up to the inherited hard limit. Because the
wrapper sets both to the ceiling, neither the process nor its descendants can
raise the ceiling without OS privilege (`CAP_SYS_RESOURCE` or equivalent). A
process that was already running before the launch, or one that another
same-user process asks to perform the write, does not inherit the limit.

Behavior verified on this Linux host with a measured 512-byte `ulimit -f`
block size:

- A write cannot extend a file past the ceiling: it may write partially up to
  the ceiling, or fail with `EFBIG` (or terminate a writer with the default
  `SIGXFSZ` disposition). The ceiling also applies to `write(2)` with a seek
  offset past the ceiling, `truncate`/`ftruncate`, `fallocate`, and
  `copyFile`/`copy_file_range`. A write that reaches exactly the ceiling succeeds.
- Writes at offsets at or past the ceiling fail even when the file already
  existed and was larger; the limit is checked against the write offset, not
  just the resulting size. Overwriting the first 8 MiB of such a file,
  shrinking it, or deleting it is not prevented.
- Page-fault writes through an `mmap` of an already larger file are not
  checked against the ceiling. On this host, an `mmap` write far past EOF
  faults instead of extending the file.
- Data written to non-regular files is not limited: a 4 MiB pipe write
  succeeded under a 1 MiB ceiling, and the reader can store it anywhere.
- The ceiling is per file, not aggregate: 12 files of 1 MiB each succeeded
  under a 1 MiB ceiling. File count, total bytes across files, inodes, memory,
  CPU, and process count remain bounded only by host capacity, not by this
  limit.

The existing bounded reads remain separate: JSON reports are limited to
**8 MiB**, and probe logs to **64 KiB**. A read limit protects the parent from
loading oversized output; it does not stop a child from filling disk before
that read. The write ceiling also covers other regular files written by the
limited process and descendants that inherit it, not just reports or probe
logs. A partial report is not evidence of a successful run.

Portability: the wrapper needs `/bin/sh` with `ulimit -f`, `ulimit -S -f`, and
`ulimit -H -f`. It fails closed when the shell cannot express a ceiling in the
allowed range, when its block size exceeds the 8192-byte probe budget, or when
the Node runtime cannot install the probe's `SIGXFSZ` handler. The probe does
not depend on Node's default signal disposition; failure to observe `EFBIG`
also refuses the launch. Windows is unsupported; the helper throws.

This is a resource guardrail, **not a security sandbox**. In addition to the
limitations above, it imposes no destination-path restriction (a limited
process can write anywhere the user can), and it cannot stop a process from
delegating writes to a same-user process that does not inherit the limit.
Process-group cleanup cannot guarantee termination of descendants that escape
into other groups or sessions; changing groups alone does not remove an
inherited file-size limit. Run untrusted code only in stronger isolation.

Alternatives have different trade-offs. Streaming reports with a byte-counted
consumer can stop oversized report output earlier, but requires runner plumbing
changes and does not bound arbitrary child-created files. Watching directory
sizes is racy and misses writes elsewhere. Filesystem quotas or a bounded
filesystem can enforce an aggregate budget, but require host provisioning,
mount/OS support, or privileges; a directory quota alone does not cover writes
outside that directory. A container or VM with restricted writable storage and
appropriate process isolation is a stronger option for hostile workloads, not
a portable assumption for these local contributor checks.

## Repository infrastructure

Existing specifications in [features/repo-infrastructure/](features/repo-infrastructure/)
cover CI, linting, Renovate dependency management, and Mergify merge queue
automation.

Renovate groups Node.js version updates for `.nvmrc` and GitHub Actions CI into
one pull request when both updates are available. Both files must pin the same
exact Node.js version; CI rejects mismatched versions. Grouping alone does
not guarantee an exact match: the datasources can offer different target
versions or publish updates at different times, so Renovate can update one
source ahead of the other. Such a pull request remains blocked by the exact
equality check until both pins match.

### Local CI verification

The repository infrastructure suite executes the actual linters and workflow
gate, and evaluates scheduling from the checked-in workflow. Use a POSIX host
with Bash, Git, Go, Python 3 (with `venv`), and ShellCheck on `PATH`, plus the
Node.js/npm and native dependency build prerequisites described above.
The setup script needs network access to download its tools and dependencies.

From the repository root, install the locked Node dependencies (including
markdownlint-cli2), then install actionlint **1.7.11** and yamllint **1.37.1**
locally and add them to the current shell's `PATH`:

```bash
npm ci
bash scripts/setup-ci-linters.sh
export PATH="$PWD/.ci-linters/bin:$PWD/.ci-linters/venv/bin:$PATH"
```

The script installs into the ignored `.ci-linters/` directory; it does not
install ShellCheck. Supply ShellCheck separately (CI uses the runner's version).
The Python requirements are fully pinned and hash-verified, so `pip` refuses
packages that do not match the recorded hashes. Repeat the `export` in each new
shell used for verification.

The `package.json` `overrides` entry pins the transitive `re2js` dependency of
`markdownlint` to **2.9.1**. `markdownlint` 0.42.0 depends on 2.8.6, which is
affected by [GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
(CVE-2026-116795); 2.9.1 is a compatible patch release. Remove the override once
`markdownlint` depends on 2.8.7 or later.

Run each linter through the same entrypoint used by CI:

```bash
node scripts/ci-lint.js markdownlint
node scripts/ci-lint.js yamllint
node scripts/ci-lint.js actionlint
node scripts/ci-lint.js shellcheck
```

The runner selects matching Git-tracked and non-ignored untracked files, so
local edits are included. Each discovered path is passed as a literal file, so
characters such as a leading `!`, `#`, or `-` cannot exclude it or turn it into
a flag. An empty or failed discovery is a verification failure, and missing
tools fail rather than being skipped. With explicitly empty input, the runner
still invokes the tool's version check.

Run the infrastructure acceptance scenarios without launching OpenCode:

```bash
npm run test:features -- --tags '@component:repo-infrastructure'
```

For focused scheduler and aggregate-gate unit checks:

```bash
node --test features/tests/ci-scheduling.test.js features/tests/workflow-gate*.test.js
```

Scheduling verification is a local model, not a GitHub Actions run. It covers
pull requests targeting `main` (opened, synchronized, or reopened), pushes to
`main`, and manual dispatch. It supports literal branch filters, pull-request
event types, job dependencies, and job conditions `true`, `false`, and
`always()`. Unsupported filters, expressions, matrices, or reusable-workflow
jobs fail rather than being assumed scheduled. Jobs that do not run directly on
an Ubuntu runner, or that set a container, shell, environment, or defaults
override, are rejected because the local executors assume GitHub's implicit
Linux Bash shell. Required checks are taken from the `Successful CI` job's
`needs` list; every other job must be listed there,
so a renamed or added check cannot escape scheduling verification. A required
job disabled with `if: false` is not reported as scheduled. The gate checks
evaluate the workflow's expression and execute its Bash script locally,
including failure, cancellation, and skipped-job cases. These checks do not
execute workflow actions or establish that GitHub-hosted jobs will run
successfully.
