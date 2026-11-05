# Testing and CI

This guide covers contributor verification, real-host prerequisites, continuous
integration, and the runner's resource guardrails. Commands assume the
repository root unless stated otherwise. For checkout setup and project
workflow, see the [development guide](development.md).

## Runtime and host prerequisites

### OpenCode host

The documented supported OpenCode host version follows the exact
`@opencode/cli` version pinned in
[the host package manifest](../.github/tooling/opencode-host/package.json).
Compatibility with other releases is not established. A pin update must pass
verification before support for the new release is established. The host
smoke tests and session-data contract test require an exact version match; an
arbitrary V2 release is not accepted.

### Node.js, npm, and native dependencies

Use Node.js and npm for checkout development and verification. The exact Node.js
release is specified in [`.nvmrc`](../.nvmrc) and CI, which pin the same version.
Local verification with `npm test` has passed on Node.js **26.13.0**. For
Node.js 22, the locked dependency tree requires **22.19.0 or later**, including a
production transitive dependency of `@opencode/plugin`; this is not solely a
test dependency requirement. The Cucumber.js test runner declares support for
Node.js **22, 24, or 26 and later** (not 23 or 25); this declared range does not
establish verification of every version in it. The root package does not
currently declare an `engines` field to enforce these constraints. Official
Node.js Linux binaries since Node.js 25 may require installing `libatomic`
separately, depending on your distribution; see the
[Node.js 26.13.0 release notes](https://nodejs.org/en/blog/release/v26.13.0).

For checkout development and verification, install the locked dependencies from
the repository root:

```bash
npm ci
```

The real-host smoke harness needs a native PTY dependency. If installation
builds it from source, Linux requires Python, `make`, and a C/C++ build toolchain;
macOS requires Python and the Xcode command-line build tools. Python may also be
used by unrelated repository tooling; it is not the acceptance-test runner.

## Unit and sidebar UI tests

Run the unit suite without launching OpenCode:

```bash
npm run test:unit
```

The suite includes smoke-harness, migration, workflow scheduling, workflow-gate,
real-linter boundary, and session-data tests. First complete the
[local CI verification setup](#local-ci-verification) below; the unit suite
requires the lint tools as well as Bash on `PATH`.

Sidebar UI unit tests render the real plugin with OpenTUI, so they need Node.js 26
with Solid client conditions and the `--experimental-ffi` flag. They self-skip
inside the portable unit command. CI runs them as a required no-skip step:

```bash
OATS_REQUIRE_SIDEBAR_UI=1 npm run test:unit:sidebar-ui
```

Use the Node version in [`.nvmrc`](../.nvmrc); the repository pin is 26.13.0.

## Acceptance tests

Acceptance tests use Cucumber.js with JavaScript ES modules; unit tests use
Node.js's built-in test runner.

Run the reported-cost aggregation acceptance scenarios without launching
OpenCode:

```bash
npm run test:features -- --tags '@component:usage-aggregation'
```

The specifications in
[`features/usage-aggregation/`](../features/usage-aggregation/) cover
attribution, incomplete data, session isolation, updates, and aggregation
invariants, including property-based coverage.

Run all feature scenarios with the default serial local runner:

```bash
npm run test:features
```

CI runs the complete feature suite with two Cucumber workers:
`npm run test:features -- --parallel 2`. The local command above remains serial
by default. Scenarios and assertions are unchanged, and each scenario uses its
own temporary resources.

Run unit tests and all feature scenarios together:

```bash
npm test
```

The full suite requires both the host prerequisites for the TUI smoke tests
below and the [local CI verification setup](#local-ci-verification). Pass
Cucumber options with `npm run test:features -- ...`, not `npm test`; tag
expressions include the `@` prefix.

## Real-host session-data contract test

The separate
[`session-data-access.real-host.test.js`](../features/real-host-tests/session-data-access.real-host.test.js)
launches a real OpenCode server at the pinned host version. It checks the
HTTP/SDK contract and session data access using imported synthetic sessions and
messages, without model calls. Live settlement and event deduplication remain
covered by fake-host tests, not this real-host contract test.

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
updates, and model metadata fetching are disabled using the same controls as the
[TUI smoke harness](#real-host-tui-smoke-tests). These controls do not guarantee
network isolation or offline operation. The contract test does not launch a TUI
or require a pseudo-terminal.

## Real-host TUI smoke tests

Run the plugin UI scenarios, including the real-host TUI smoke scenarios:

```bash
npm run test:features -- --tags '@component:plugin-ui'
```

The real-host scenarios require a POSIX host with pseudo-terminal and
Unix-domain socket support, plus an OpenCode executable matching the exact host
pin on `PATH`. Process inspection requires `/proc` on Linux or `ps` on other
supported POSIX hosts. Windows is unsupported. Set
`OATS_OPENCODE=/absolute/path/to/opencode` to select that host explicitly.

The harness starts a real standalone TUI with temporary home and XDG
directories and a minimal child environment. It checks for the rendered
startup toast and runs a no-plugin control that must not show it. No model
interaction is required. These are host smoke tests, not token-reporting tests.

Cleanup covers only the supervisor's process group. Descendants can escape into
other process groups or sessions; supervisor failure may leave cleanup
unconfirmed. The harness does not guarantee termination of every descendant.

The harness sets `OPENCODE_DISABLE_PROJECT_CONFIG=1`,
`OPENCODE_DISABLE_AUTOUPDATE=1`, and `OPENCODE_DISABLE_MODELS_FETCH=1` to suppress
project and ancestor configuration discovery, automatic updates, and model
metadata fetching. These controls were established for v2.0.32; their
effectiveness must be verified when upgrading the host, not assumed for later
releases. System configuration is independent of these controls, so the
harness refuses to run if a system configuration source exists or cannot be
inspected: `/etc/opencode` on non-macOS hosts, or the OpenCode system and
managed-preference locations on macOS. Use a host without those sources rather
than removing system configuration to run a test. These controls do not
guarantee network isolation or offline operation.

To use the same locked OpenCode host as CI without a global installation:

```bash
npm ci --prefix .github/tooling/opencode-host
OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" \
  npm run test:features -- --tags '@component:plugin-ui'
```

## On-demand feature-suite profile

From the repository root, run the opt-in profiler:

```bash
node scripts/profile-features.js
```

The report includes per-scenario elapsed time, component totals, each scenario's
combined Gherkin-step time and scenario-hook time, full-suite elapsed time, and
residual setup/framework overhead. Runtime context covers Cucumber.js, Node.js,
OS release, CPU architecture, and detected CI metadata. `BeforeStep` and
`AfterStep` hook time is included in Gherkin-step time; scenario hooks are
reported separately. The runner image/label is not reported; read it from the
CI job logs.

The profiler is opt-in and leaves the normal `npm run test:features` command and
routine CI unchanged. The full-suite prerequisites above still apply, including
the real-host smoke-test requirements and
[local CI verification setup](#local-ci-verification).

## Runner-contract disk limits

Every process launched through `runProcess` in
`features/tests/migration-process.js` runs behind a POSIX per-file write ceiling
of **8 MiB** (at most 8 MiB + 512 bytes, depending on the shell's `ulimit -f`
block size). The affected callers are the acceptance-step support in
`features/tests/migration-step-support.js` (including the disk-limit fixture
steps in `features/steps/disk-limit-support.js`),
`features/tests/migration-contract.test.js`,
`features/tests/runner-file-limit.test.js`,
`features/tests/workflow-gate-property.test.js`, and any future code that calls
`runProcess`. It is not a limit on `npm test` itself, the TUI smoke helper (which
does not use `runProcess`), or commands run outside the helper.

A launch establishes the ceiling like this:

1. A Node probe runs under `ulimit -f 1` and installs a no-op `SIGXFSZ` handler
   so an over-limit write can report `EFBIG` instead of terminating the probe.
   It writes one byte at a time until the kernel reports `EFBIG`, then prints the
   resulting file size. Writing single bytes makes the measurement independent
   of whether an oversized write is rejected outright or partially written up
   to the limit.
2. The wrapper computes the smallest `ulimit -f` block count whose product is at
   least 8 MiB, and refuses the launch if that product exceeds 8 MiB + 512 bytes
   or if the probe could not observe a ceiling within its 8192-byte budget.
3. It sets **both** the soft and hard limits to that block count, reads both
   back with `ulimit -S -f` and `ulimit -H -f`, and exits 125 before `exec` if
   any step fails. The feature runner therefore never starts when the ceiling
   cannot be established.

The hard/soft equality matters: a process may lower its soft limit and raise it
again, but it can only raise it up to the inherited hard limit. Because the
wrapper sets both to the ceiling, neither the process nor its descendants can
raise the ceiling without OS privilege (`CAP_SYS_RESOURCE` or equivalent). A
process that was already running before the launch, or one that another
same-user process asks to perform the write, does not inherit the limit.

Behavior verified on this Linux host with a measured 512-byte `ulimit -f` block
size:

- A write cannot extend a file past the ceiling: it may write partially up to
  the ceiling, or fail with `EFBIG` (or terminate a writer with the default
  `SIGXFSZ` disposition). The ceiling also applies to `write(2)` with a seek
  offset past the ceiling, `truncate`/`ftruncate`, `fallocate`, and
  `copyFile`/`copy_file_range`. A write that reaches exactly the ceiling
  succeeds.
- Writes at offsets at or past the ceiling fail even when the file already
  existed and was larger; the limit is checked against the write offset, not
  just the resulting size. Overwriting the first 8 MiB of such a file, shrinking
  it, or deleting it is not prevented.
- Page-fault writes through an `mmap` of an already larger file are not checked
  against the ceiling. On this host, an `mmap` write far past EOF faults instead
  of extending the file.
- Data written to non-regular files is not limited: a 4 MiB pipe write succeeded
  under a 1 MiB ceiling, and the reader can store it anywhere.
- The ceiling is per file, not aggregate: 12 files of 1 MiB each succeeded under
  a 1 MiB ceiling. File count, total bytes across files, inodes, memory, CPU, and
  process count remain bounded only by host capacity, not by this limit.

The existing bounded reads remain separate: JSON reports are limited to **8
MiB**, and probe logs to **64 KiB**. A read limit protects the parent from
loading oversized output; it does not stop a child from filling disk before
that read. The write ceiling also covers other regular files written by the
limited process and descendants that inherit it, not just reports or probe
logs. A partial report is not evidence of a successful run.

Portability: the wrapper needs `/bin/sh` with `ulimit -f`, `ulimit -S -f`, and
`ulimit -H -f`. It fails closed when the shell cannot express a ceiling in the
allowed range, when its block size exceeds the 8192-byte probe budget, or when
the Node runtime cannot install the probe's `SIGXFSZ` handler. The probe does
not depend on Node's default signal disposition; failure to observe `EFBIG` also
refuses the launch. Windows is unsupported; the helper throws.

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

Existing specifications in
[`features/repo-infrastructure/`](../features/repo-infrastructure/) cover CI,
linting, Renovate dependency management, and Mergify merge queue automation.

Renovate groups Node.js version updates for `.nvmrc` and GitHub Actions CI into
one pull request when both updates are available. Both files must pin the same
exact Node.js version; CI rejects mismatched versions. Grouping alone does not
guarantee an exact match: the datasources can offer different target versions or
publish updates at different times, so Renovate can update one source ahead of
the other. Such a pull request remains blocked by the exact equality check until
both pins match.

### Local CI verification

The repository infrastructure suite executes the actual linters and workflow
gate, and evaluates scheduling from the checked-in workflow. Use a POSIX host
with Bash, Git, Go, Python 3 (with `venv`), and ShellCheck on `PATH`, plus the
Node.js/npm and native dependency build prerequisites described above. The setup
script needs network access to download its tools and dependencies.

From the repository root, install the locked Node dependencies (including
markdownlint-cli2), then install actionlint **1.7.11** and yamllint **1.38.0**
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
affected by
[GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
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
`needs` list; every other job must be listed there, so a renamed or added check
cannot escape scheduling verification. A required job disabled with `if: false`
is not reported as scheduled. The gate checks evaluate the workflow's
expression and execute its Bash script locally, including failure, cancellation,
and skipped-job cases. These checks do not execute workflow actions or establish
that GitHub-hosted jobs will run successfully.
