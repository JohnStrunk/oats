# OATS — OpenCode Agent Token Stats

OATS is a minimal OpenCode v2 TUI plugin, intended to help explain token usage
and estimated costs across agents, subagents, and models.

**Current behavior:** a brief **OATS loaded** startup toast confirms that the
plugin loaded. Token statistics, cost estimates, and reporting views are not
implemented yet.

## Try the local plugin

Prerequisites:

- OpenCode v2. The host version used for development and testing is **v2.0.32**;
  compatibility with other releases is not established.
- Node.js and npm for checkout development and verification. Local verification
  has used Node.js **22.23.4** (the version in `.nvmrc`); CI uses **26**. For
  Node.js 22, the locked dependency tree requires **22.19.0 or later**, including
  a production transitive dependency of `@opencode/plugin@2.0.32`; it is not
  solely a test dependency requirement. The Cucumber.js test runner declares
  support for Node.js **22, 24, or 26 and later** (not 23 or 25); this declared
  range does not establish verification of every version in it. The root package
  does not currently declare an `engines` field to enforce these constraints.

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
planned; the startup toast is the current bootstrap behavior.

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

Run the unit tests, including smoke-harness, migration, workflow scheduling,
workflow-gate, and real-linter boundary tests, without launching OpenCode.
First complete the [CI verification setup](#local-ci-verification) below; the
unit suite requires the lint tools as well as Bash on `PATH`:

```bash
npm run test:unit
```

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

## Repository infrastructure

Existing specifications in [features/repo-infrastructure/](features/repo-infrastructure/)
cover CI, linting, Renovate dependency management, and Mergify merge queue
automation.

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
