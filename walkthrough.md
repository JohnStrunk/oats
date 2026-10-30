# Walkthrough: Agent and Model Usage Details Modal

**

Recorded on 2026-10-30T22:05:30Z by Showboat 0.6.1.
<!-- showboat-id: 0dc59aef-0a1e-4f57-9bcb-c2a4dbe52448 -->

## Why

Issue #35 requests a details pane for agent and model token usage, accessible directly from the Agent stats sidebar section in OpenCode TUI. Previously, OATS only aggregated reported costs by agent name in the sidebar overview; detailed breakdowns across agent/model combinations, token dimensions (input, output, cache write, cache read), model prices per million tokens, and category cost estimates were missing.

## What Changed

1. **Sidebar Title and Trigger (`src/agent-stats.js`)**:
   - Updated the sidebar section title to `Agent stats (details)`.
   - Made `(details)` an independent click target that activates the usage details modal without toggling the collapsible section.

2. **Usage Details Modal Dialog (`src/usage-details.js`)**:
   - Rendered using OpenCode's dialog API (`context.ui.dialog.show` and `context.ui.dialog.set({ size: 'large' })`).
   - Integrated OpenTUI `scrollbox` enabling keyboard navigation (`PageDown`, `PageUp`, `Down`/`j`, `Up`/`k`, `Escape`) to scroll through any number of agent/model tables.
   - Connected reactively to the displayed session subtree, updating live as usage settles at step boundaries or when switching sessions.

3. **Pricing Attribution & Accounting Engine (`src/pricing-attribution.js`)**:
   - Grouped usage records by recorded agent and provider/model pair (preserving `Unattributed` buckets for records missing identity).
   - Formatted pair headings as `<agent> - <model>  $XX.XX` using exact decimal ceiling-to-cents arithmetic and directional bounds.
   - Structured usage tables with columns **input**, **output**, **cache write**, and **cache read**, and rows **Price**, **Tokens**, and **Cost**.
   - Input reflects non-cached input; Output combines visible output and reasoning tokens (`output + reasoning`).
   - Evaluated current model prices using per-call context window size (`input + cache.read + cache.write`) with strict `> tier.size` threshold matching upstream host semantics.
   - Displayed uniform rate or `mixed` if calls spanned different pricing tiers.
   - Calculated estimated category costs as `(tokens * rate) / 1,000,000`, marked with `e`.
   - Displayed unknown prices and counts as em-dash (`—`), preserving distinction from zero.
   - Neutralized terminal escape codes and control characters to prevent terminal injection.

## Evidence & Verification

### 1. Unit & Property-Based Tests

The unit and property-based test suites verify identity grouping, strict tier thresholds, reasoning token inclusion, and order invariance with randomized fast-check properties.

```bash
PATH=/tmp/opencode/node26bin:$PATH node --test features/tests/pricing-attribution*.test.js | sed -E "s/\([0-9.]+m?s\)//g; s/duration_ms [0-9.]+/duration_ms normalized/g"
```

```output
✔ property: sanitizeText never contains control, line breaking, or invisible characters 
✔ property: extractCallTokens output always equals output + reasoning when both are non-negative integers 
✔ property: tier rate evaluation strictly requires context > tier.size 
✔ property: aggregateUsageDetails order invariance: shuffling records preserves pair count and identities 
✔ sanitizeText strips control and formatting characters 
✔ findModel resolves matching provider and model entries 
✔ extractCallTokens extracts non-cached input, output + reasoning, and cache tokens 
✔ extractCallTokens handles missing, null, or partial tokens cleanly 
✔ evaluateCallTierRate respects strict context > tier.size threshold 
✔ aggregateUsageDetails groups records and sorts by agent then model 
✔ aggregateUsageDetails formats reported cost with ceiling-to-cents and incomplete e 
✔ aggregateUsageDetails shows mixed rates and estimates category costs 
✔ renderPairTable outputs proper heading and 4-column layout 
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms normalized
```

### 2. Gherkin Acceptance Scenarios

Nineteen Cucumber.js acceptance scenarios specify and verify modal invocation, scrollability, column/row ordering, live settlement updates, session changes, and unknown/zero handling against the TUI.

```bash
PATH="$PWD/.ci-linters/bin:$PWD/.ci-linters/venv/bin:/tmp/opencode/node26bin:$PATH" OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" npm run test:features -- --tags "@details-issue-35" | sed -E "s/[0-9]+m [0-9.]+s/normalized duration/g"
```

```output

> opencode-oats@0.1.0 test:features
> cucumber-js --tags @details-issue-35

......................................................................................................................................................................................................................................................................................................

1 hook (1 passed)
19 scenarios (19 passed)
293 steps (293 passed)
normalized duration (normalized duration executing your code)
```

### 3. Live Pinned OpenCode TUI Verification (Real Host)

Executing the real pinned OpenCode 2.0.32 TUI host and OATS plugin with synthetic sessions on an isolated local server. The driver opens the session sidebar, verifies `Agent stats (details)`, clicks `(details)`, and captures the rendered modal dialog.

```bash
PATH="$PWD/.ci-linters/bin:$PWD/.ci-linters/venv/bin:/tmp/opencode/node26bin:$PATH" OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node scripts/demo-walkthrough.js
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

## How to Reproduce

1. Install dependencies and build host linters:

   ```bash
   npm ci
   bash scripts/setup-ci-linters.sh
   npm ci --prefix .github/tooling/opencode-host
   ```

2. Run unit & property tests:

   ```bash
   node --test features/tests/pricing-attribution*.test.js
   ```

3. Run acceptance test scenarios for the usage details modal:

   ```bash
   npm run test:features -- --tags '@details-issue-35'
   ```

4. Run real-host smoke demo:

   ```bash
   OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node scripts/demo-walkthrough.js
   ```

