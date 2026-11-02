# Walkthrough: Issue #43 — Details modal scrollbar layout

Recorded on 2026-11-02T20:28:49Z by Showboat 0.6.1.
<!-- showboat-id: 93edd417-9ddb-4a08-ba95-33ed463815a8 -->

## Why

Issue #43 reports that the overflow scrollbar in the usage-details modal was detached from the visible table content.

## What changed

The modal now uses OpenTUI’s default side-by-side ScrollBox layout and sizes its content box to the widest rendered line using the host renderer’s actual terminal-width method, plus one cell for the vertical scrollbar. The existing max-width constraint still keeps it within the dialog. A real-host feature checks both ASCII and mixed narrow/wide Unicode headings.

## Demo setup

The command below starts the pinned OpenCode 2.1.4 TUI and the real OATS plugin with a synthetic session containing 25 agent/model tables. The first heading mixes narrow and wide Unicode characters so the capture also exercises renderer-accurate width measurement. No model call or production data is used.

## Reproduce

Run `npm ci` and `npm ci --prefix .github/tooling/opencode-host` to install the dependencies and pinned host, then execute `OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node scripts/demo-issue-43.js`.

```bash
OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node scripts/demo-issue-43.js
```

```output
OpenCode 2.1.4 TUI — synthetic mixed-width overflow fixture
The 25-table modal scrolls; the scrollbar is shown beside the mixed-width heading and table.
                                                                                                                        ▼ Agent stats (details)              █
                                                                                                                            éééé…:                     $1.00 █
                                    0éééééééééééééééé代代代代代代代代 - fixture-provider/fixture-model  $1.00█              t-01:                      $1.00 ▀
                                            input          output         cache write     cache read         █              t-02:                      $1.00
                                    Price   $5.00          $2.00          $6.00           $7.00              █              t-03:                      $1.00
                                    Tokens  400,000        500,000        250,000         500,000            █              t-04:                      $1.00
                                    Cost    $2.00e         $1.00e         $1.50e          $3.50e             █              t-05:                      $1.00
                                                                                                             █              t-06:                      $1.00
```

## Verification

Full test suite: 406 unit tests (393 passing, 13 skipped), and 294 acceptance scenarios with 4,341 steps, all passing. The skipped unit cases are the Solid client tests that require Node 26; CI runs Node 26.13.

Complete plugin-ui acceptance run: 96 scenarios, 1,496 steps.

Focused issue #35 and #43 acceptance run: 21 scenarios, 323 steps.

The live demo above was re-run with the pinned OpenCode 2.1.4 and reproduced the captured output. Markdown lint passes.
