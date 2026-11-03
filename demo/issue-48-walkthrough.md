# Issue 48: Model cost summary

Generated: 2026-11-03T21:18:14Z by Showboat 0.6.1
<!-- showboat-id: 88d550c4-60c0-4c3b-8e8a-2a0f07cd581a -->

The session sidebar previously showed Agent stats but not a per-model summary. Issue 48 adds a Model stats section alongside Agent stats.

This is actual rendering from the pinned OpenCode host, captured with synthetic imported sessions; it makes no model calls. It shows both sections expanded, then Agent stats collapsed while Model stats stays expanded. The script checks rendered rows, values, markers, legends, and expansion states.

Costs come from session-reported values grouped by recorded model IDs—not provider-price estimates or the model currently selected in the UI. From the repository root, install the pinned host with `npm ci --prefix .github/tooling/opencode-host`, then run the command below. The script closes its isolated server and PTY in its own cleanup path.

```bash
OATS_OPENCODE="$PWD/.github/tooling/opencode-host/node_modules/.bin/opencode" node demo/capture-model-stats.mjs
```

```output
=== Both summaries expanded ===
▼ Agent stats (details)
alpha:                         $3.00
beta:                          $2.00e
gamma:                   unavailable
zero:                          $0.00
Unattributed:                  $1.00e
e = estimated
▼ Model stats
alpha-model:                   $3.00
beta-model:                    $2.00e
gamma-model:             unavailable
zero-model:                    $0.00
Unattributed:                  $1.00e
e = estimated

=== Agent stats collapsed; Model stats remains expanded ===
▶ Agent stats (details)
▼ Model stats
alpha-model:                   $3.00
beta-model:                    $2.00e
gamma-model:             unavailable
zero-model:                    $0.00
Unattributed:                  $1.00e
e = estimated
```
