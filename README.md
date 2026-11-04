# OATS — OpenCode Agent Token Stats

OATS is a minimal OpenCode v2 TUI plugin, intended to help explain token usage
and estimated costs across agents, subagents, and models.

**Current behavior:** a brief **OATS loaded** startup toast confirms that the
plugin loaded. The session sidebar has sibling, independently collapsible
**Agent stats** and **Model stats** sections. Agent stats shows known
OpenCode-reported costs by recorded agent name; Model stats groups known
reported costs by recorded model ID, combining the same ID across providers and
agents. Both sections cover the displayed session and its descendants. Work
without a usable recorded model ID remains **Unattributed**. Model stats uses
each record's model ID for grouping, not the currently selected model;
catalogue-only and currently selected models do not create or replace rows.
Each row label uses the catalogue `name` for its usage provider. If an ID
appears in usage from multiple providers with different catalogue names, use the
`name` for the provider on the earliest recorded usage for that ID; if that
matching `name` is missing or empty, the recorded ID remains the label. Model
stats shows reported costs rather than price estimates. The **(details)** link
in Agent stats opens a live breakdown by agent and model, with token counts and
estimated category costs at current model prices.

## Try the local plugin

Prerequisites:

- OpenCode at the exact `@opencode/cli` version pinned in
  [the host package manifest](.github/tooling/opencode-host/package.json).
  The documented supported host version follows this pin; compatibility with
  other releases is not established. A pin update must pass verification before
  support for the new release is established.
- Node.js and npm for checkout development and verification. The exact Node.js
  release is specified in `.nvmrc` and CI, which pin the same version.
  Local verification with `npm test` has passed on Node.js **26.13.0**. For
  Node.js 22, the locked dependency tree requires **22.19.0 or later**, including
  a production transitive dependency of `@opencode/plugin`; it is not
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

### Try Agent stats

1. Open a session with available history and show the session sidebar.
2. Find **Agent stats**, which starts expanded. Each named agent has one row
   showing its total known reported cost, including nested delegated work.
   Repeated invocations of the same agent are combined, even across models.
   Costs are right-aligned in a shared column.
3. Click the **Agent stats** title to collapse or expand only that section. For
   keyboard interaction, open OpenCode's command palette and select
   **Toggle Agent stats**; this command affects Agent stats only. The heading
   uses the host's disclosure indicators: `▼` when expanded and `▶` when
   collapsed.
4. Switch sessions to see costs for the newly displayed session subtree. The
   Agent stats expansion choice is shared across sessions for this application
   lifetime, independently of Model stats; restarting the application defaults
   it to expanded.

Available history appears when the session opens, and costs update as OpenCode
settles usage at step boundaries, not for every streamed token. Both sections
distinguish loading, confirmed-empty history, and unavailable history. A
complete-looking row is not proof that history is complete. Summary-level
history gaps without any row-level `e` marker are not separately indicated in
either section. Collapsing a section does not leave stale data when it is
reopened. Unrelated sessions and the previously displayed session subtree are
not included in the new scope.

Observed behavior in OpenCode 2.0.32 is that historical events are typically
not persisted; this is a version-specific observation, not established for
later releases. Some event-only usage and retry attempts may therefore be
unreconstructible after an event is lost. Persisted records do not guarantee a
complete execution history, and refreshing cannot recover data the host no
longer has.

Work without a recorded agent name remains unattributed rather than silently
dropped or assigned to another agent in Agent stats. **Unattributed** rows use
the same alignment and completeness formatting as named-agent rows.

Known incomplete Agent stats row totals remain visible with a lowercase `e`
marker. When at least one Agent stats row has `e`, that section displays the
legend `e = estimated` exactly once; it omits the legend when no Agent stats
row has `e`. Unknown totals display as `unavailable`, without an `e` marker.

Each agent row uses its own available label width. Safe names are shown in full
when they fit and ellipsized only when needed. Labels are disambiguated only
when their fitted forms collide; disambiguation does not change attribution to
the original recorded names.

**Reported costs only:** both sidebar sections show informational
OpenCode-reported costs, not estimates derived from token rates or billing
guarantees. A reported zero does not prove that the provider charged nothing.
Missing history and uncertain provenance can limit totals; see
[Session data access](#session-data-access).
Reported numeric costs are added with accurate decimal arithmetic before
display rounding: `$0.10 + $0.20` displays as `$0.30`, not `$0.31` from a binary
floating-point addition artifact. For each finite normalized host `Number`,
the exact decimal value used is its shortest round-trip decimal representation
(the shortest decimal text that converts back to the same `Number`). This does
not preserve the original JSON or provider decimal text and cannot recover
precision already lost by the provider or host.

**Agent stats** and **Model stats** order rows by descending exact reported-cost
totals before display rounding. Known incomplete rows sort by their known total.
Finite totals outside the `$9999.99` display bound still sort by exact value.
The **Unattributed** row sorts by its own total.

Rows with unknown totals, including sums that overflow the host `Number` range,
appear last. Unknown named rows retain insertion order, defined as the order in
which each named identity first appeared. Tied known named rows also retain
insertion order. When totals tie, the **Unattributed** row follows named rows.

Displayed totals are rounded up toward positive infinity to the next cent;
amounts already at an exact cent remain unchanged. Any positive amount below
one cent displays as `$0.01`. For example, `$1.231` displays as `$1.24`.
Negative amounts also round toward positive infinity: `-$0.011` displays as
`$-0.01`, not `$-0.02`. This is display rounding of the aggregated total, not
rounding of individual records or billing-exact accounting.
The maximum displayable magnitude is `$9999.99`. Rounded totals above that
range display as `>$9999.99`; those below `-$9999.99` display as `<-$9999.99`,
rather than an exact clipped cap. The completeness marker is preserved even
when a total is outside the display range.
The compact sidebar shows reported costs; token breakdowns and current-price
estimates are available in the details modal below. Base-versus-total
comparisons remain planned.

### Try Model stats

1. Open the session sidebar for a session with available history. Find
   **Model stats** beside **Agent stats**; it starts expanded.
2. Each row shows the total known OpenCode-reported cost for one recorded model
   ID in the displayed session subtree, including nested delegated work.
   Matching IDs combine into one row across providers and agents. Grouping uses
   the ID on each usage record, not the currently selected model. Catalogue-only
   and currently selected models do not create or replace rows. Each row label
   uses the catalogue `name` for its usage provider. If an ID appears in usage
   from multiple providers with different catalogue names, use the `name` for
   the provider on the earliest recorded usage for that ID; if that matching
   `name` is missing or empty, the recorded model ID remains the label. Labels
   retain the existing truncation and collision-disambiguation behavior: they
   stay full when they fit and shorten only when width or a collision requires
   it. Work without a usable recorded model ID remains in an **Unattributed**
   row rather than being dropped or assigned to another ID.
   Model stats reports recorded costs only; it does not calculate price
   estimates.
3. Click the **Model stats** title to collapse or expand this section without
   changing Agent stats. For keyboard interaction, open OpenCode's command
   palette and select **Toggle Model stats**. The heading uses the host's
   disclosure indicators: `▼` when expanded and `▶` when collapsed.
4. Switch sessions to see costs for the new session subtree. Model stats has
   its own expansion choice, independent of Agent stats and shared across
   sessions for this application lifetime; restarting the application defaults
   it to expanded.

Known incomplete Model stats row totals remain visible with a lowercase `e`
marker. Model stats displays its own `e = estimated` legend exactly once when
at least one model row has `e`; it omits the legend when no model row has `e`.
Unknown totals display as `unavailable`, without an `e` marker.

### Usage details

Click **(details)** in **Agent stats (details)** to open the details modal
without collapsing or expanding the sidebar section. Use the host's standard
modal scrolling controls to browse the tables. The details modal has a visible
border and is titled **Agent cost details**. Click the on-screen `esc` control,
press the **Escape** key, or click outside the modal to dismiss it.

The modal groups available usage by recorded agent and model, sorted by agent,
then model. Models from different providers remain separate, and work without
a recorded agent is grouped as unattributed. Each heading shows the pair's
OpenCode-reported cost, not the sum of its estimated category costs. Each table
has **input**, **output**, **cache write**, and **cache read** columns:

- **Price** shows the current model price per million tokens, or `mixed` when
  calls use different pricing tiers rather than implying one shared rate.
- **Tokens** shows available token counts. **Output** includes host-reported
  reasoning tokens, priced at the output rate.
- **Cost** sums per-call category estimates, each calculated as the applicable
  current-tier price × that call's tokens ÷ 1,000,000. Pricing tiers are selected
  per call, not from the combined token count.

`e` identifies estimates and partial or incomplete values. Unknown usage,
prices, and costs are not treated as zero; partial results retain the known
portion rather than implying a complete total. If a call's applicable tier
cannot be determined, its estimate remains unknown and the combined result
remains partial or unknown. A reported zero price or cost does not prove the
provider charged nothing.

**Current-price estimates are not historical charges:** available model prices
may differ from those in effect when the work ran or from your provider's
billing terms. Estimated category costs can therefore differ from the reported
heading and sidebar costs or your invoice. Provider usage accounting and missing
prices or token counts can also limit the breakdown. OATS is not a billing
ledger.

The open modal follows the currently displayed session and its descendants,
updating as session data changes and usage settles at step boundaries, not for
every streamed token. Available records do not guarantee complete history;
the existing [session-data limitations](#session-data-access), including missing
events and uncertain fork provenance, also apply to these details.

### Host-provided UI runtime

The supported host supplies the shared Solid and OpenTUI runtime used by the
plugin. OATS does not install OpenTUI as a production dependency. Installing a
packed OATS package in a fresh npm consumer was verified against the pinned
2.0.32 TUI, including rendering and the Agent stats palette toggle;
`npm audit --omit=dev`
reported no vulnerabilities for that consumer dependency tree. This does not
audit the host executable or establish compatibility with other host releases.
The OpenTUI packages in this checkout are development-only test dependencies;
their Solid peer is overridden locally and that override does not apply to
npm consumers. Do not install these OpenTUI packages as consumer dependencies
merely to load OATS: their strict Solid peer can pull an affected older release.

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

OpenCode v2.0.32 typically does not persist historical events; this observation
is version-specific, not established for later releases. Some event-only
usage and retry attempts may be unreconstructible once those events are lost,
so available records are not a guarantee of complete history. Refresh cannot
recover data the host no longer has.

## Reported cost aggregation

Internal aggregation produces one reported-cost summary per recorded agent name
for the displayed session and its descendants, including nested delegated work.
Repeated invocations and work across models combine under the same name. Each
individual reported cost is counted once under the agent that performed the
work, without adding delegated tree totals again.

Model stats groups reported costs by recorded model ID in the same session
subtree, combining matching IDs across providers and agents in one row per
usable ID. The grouping uses the ID on each usage record rather than the
currently selected model; catalogue-only and currently selected models do not
create or replace rows. Row-label selection follows the provider/name
precedence described in [Try Model stats](#try-model-stats). Work without a
usable recorded model ID remains in an **Unattributed** row, preserving its
known reported cost instead of assigning it to another model ID or dropping it.
Model stats does not derive provider-price estimates.

Summaries retain known totals and indicate incompleteness. Missing or ambiguous
cost is not treated as zero; an agent or model group with no known cost has no
known total. In Agent stats, work without a recorded agent name remains
unattributed, preserving its known cost rather than assigning it to another
agent or dropping it. Any such unattributed work makes the Agent stats summary
incomplete, even when its cost is known. Unknown session-wide data-access gaps
mark only the overall Agent stats summary incomplete; each agent's
incompleteness flag reflects only that agent's available records. An unset
agent flag therefore does not guarantee that all of the agent's work is present
when the overall summary is incomplete.

Aggregation runs on demand from each latest scoped session-data snapshot; it
does not itself subscribe to updates or maintain reactive summaries. The sidebar
requests summaries as its scoped data changes. Invoking aggregation again
with the latest snapshot reflects record additions and updates without duplicate
contributions or retained contributions from earlier snapshots. The supplied
scope covers the displayed session subtree, excluding unrelated sessions and
the previously displayed subtree. No displayed session means no sidebar summaries.

For internal consumers, `createUsageAggregation(sessionData).getSummary()` reads
the latest snapshot on each call; this facade is not a public package API.

Both sidebar sections use this internal capability to sum reported costs, not
estimates derived from token rates. They do not guarantee billing accuracy. A
reported zero does not prove that the provider charged nothing.

## Planned experience

- Token usage and model-price-derived estimates in the sidebar.
- Base-versus-total cost comparisons, once their meaning is defined.

Usage reporting and cost estimates depend on the data available from
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
[features/AGENTS.md](features/AGENTS.md). Agent stats and Model stats present
reported costs; the details modal adds token breakdowns and current-price
estimates. The items under Planned experience remain future work.

## Development and verification

The bootstrap is a JavaScript package with a TUI entrypoint; no build step is
needed to load the local checkout. Run `npm ci` after dependency changes.

The package exports `./tui` as `src/tui.js`. A root-level `tui.js` forwards to
that entrypoint because the v2.0.32 host's local-directory resolver needs the
root file even with the package export present. This is a version-specific
observation, not a verified limitation of later releases. Keep this shim when
changing the plugin entrypoint.

Host tests derive their expected executable version from the exact
`@opencode/cli` pin in `.github/tooling/opencode-host/package.json`, rather than
maintaining separate version literals. The corresponding lockfile supplies the
reproducible installation. Both the TUI smoke harness and the session-data
contract test require an exact version match; an arbitrary V2 release is not
accepted. Updating the pin does not demonstrate compatibility or preservation
of isolation controls: the upgrade must pass the tests.

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

Sidebar UI unit tests render the real plugin with OpenTUI, so they need Node 26
with Solid client conditions and the `--experimental-ffi` flag. They self-skip
inside the portable unit command. CI runs them as a required no-skip step:

```bash
OATS_REQUIRE_SIDEBAR_UI=1 npm run test:unit:sidebar-ui
```

Use the Node version in [`.nvmrc`](.nvmrc); the repository pin is 26.13.0.

Run the reported-cost aggregation acceptance scenarios without launching
OpenCode:

```bash
npm run test:features -- --tags '@component:usage-aggregation'
```

The specifications in [features/usage-aggregation/](features/usage-aggregation/)
cover attribution, incomplete data, session isolation, updates, and aggregation
invariants, including property-based coverage.

The unit suite does not launch a real OpenCode host. The separate
[`session-data-access.real-host.test.js`](features/real-host-tests/session-data-access.real-host.test.js)
launches a real OpenCode server at the pinned host version. It checks the
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

Run the plugin UI scenarios, including the real-host TUI smoke scenarios:

```bash
npm run test:features -- --tags '@component:plugin-ui'
```

The real-host scenarios require a POSIX host with pseudo-terminal and Unix-domain socket
support, plus an OpenCode executable matching the exact host pin on `PATH`.
Process inspection requires `/proc` on Linux or `ps` on other supported POSIX
hosts. Windows is unsupported. Set
`OATS_OPENCODE=/absolute/path/to/opencode` to select that host explicitly.
The harness starts a real standalone TUI with temporary home and XDG
directories and a minimal child environment. It checks for the rendered
startup toast and runs a no-plugin control that must not show it. No model
interaction is required. These are host smoke tests, not token-reporting tests.

Cleanup covers only the supervisor's process group. Descendants can escape into
other process groups or sessions; supervisor failure may leave cleanup
unconfirmed. The harness does not guarantee termination of every descendant.

The harness sets `OPENCODE_DISABLE_PROJECT_CONFIG=1`,
`OPENCODE_DISABLE_AUTOUPDATE=1`, and `OPENCODE_DISABLE_MODELS_FETCH=1` to
suppress project and ancestor configuration discovery, automatic updates, and
model metadata fetching. These controls were established for v2.0.32; their
effectiveness must be verified when upgrading the host, not assumed for later
releases. System configuration is independent of these controls,
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

CI runs the complete feature suite with two Cucumber workers:
`npm run test:features -- --parallel 2`. The local command above remains serial
by default. Scenarios and assertions are unchanged, and each scenario uses its
own temporary resources.

Run unit tests and all feature scenarios together:

```bash
npm test
```

The full suite requires both the smoke-test host prerequisites and the
[CI verification setup](#local-ci-verification).
Pass Cucumber options with `npm run test:features -- ...`, not `npm test`;
tag expressions include the `@` prefix.

### On-demand feature-suite profile

From the repository root, run the opt-in profiler:

```bash
node scripts/profile-features.js
```

The report includes per-scenario elapsed time, component totals, each scenario's
combined Gherkin-step time and scenario-hook time, full-suite elapsed time, and
residual setup/framework overhead. Runtime context covers Cucumber.js, Node.js,
OS release, CPU architecture, and detected CI metadata. `BeforeStep` and
`AfterStep` hook time is included in the Gherkin-step time; scenario hooks are
reported separately. The runner image/label is not reported; read it from the
CI job logs.

The profiler is opt-in and leaves the normal `npm run test:features` command and
routine CI unchanged. The full-suite prerequisites stated above still apply,
including the real-host smoke-test requirements and
[CI verification setup](#local-ci-verification).

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
