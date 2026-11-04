# Vision

**OATS (OpenCode Agent Token Stats)** is an OpenCode V2 TUI plugin for
users who want to understand token usage and cost across a session and its
subagents while work is happening. Its goal is to make delegated work visible
without leaving the terminal or piecing together separate session records.

The reporting experience includes sibling, independently collapsible
**Agent stats** and **Model stats** sections in the session sidebar, alongside
the **OATS loaded** startup toast. Agent stats shows known OpenCode-reported
costs by recorded agent name across the displayed session and nested delegated
work, combining repeated invocations. Model stats groups reported costs by
recorded model ID, combining matching IDs across providers and agents into one
row per usable ID. It uses the ID on each usage record, not the currently
selected model, to determine grouping; catalogue-only and currently selected
models do not create or replace rows. A row label uses the catalogue `name` for
its usage provider. If an ID appears in usage from multiple providers with
different catalogue names, use the `name` for the provider on the earliest
recorded usage for that ID; if that matching `name` is missing or empty, the
recorded model ID remains the label. Work without a usable recorded model ID
remains visible as **Unattributed**; Model stats shows reported costs only and
does not derive provider-price estimates.

Known incomplete row totals remain visible with an `e` marker. Each section has
its own `e = estimated` legend, shown exactly once if that section has a row
with the marker and omitted otherwise. Summary-level gaps without a row-level
marker have no separate sidebar incompleteness indicator; neither section
displays a standalone `Summary incomplete` notice. Unattributed work remains
visible. History loading, confirmed-empty history, and unavailable history are
distinct, and unknown totals remain distinct from zero.

Both sections start expanded, support mouse and keyboard toggling, and can be
collapsed independently. The application retains each section's expansion
choice across session changes for its lifetime, not across restarts. Both
summaries follow the displayed session and its descendants. Available history
appears when a session opens; session and settled-usage updates keep both
summaries current, including after either is reopened from a collapsed state.

Model stats gives each usable recorded model ID a row. It keeps the row label full
when it fits and shortens it only when width or a collision requires it,
preserving the existing truncation and collision-disambiguation behavior. Row
labels align left and reported-cost values align right.

The sidebar's **(details)** link opens a scrollable usage-details modal for the
same session and nested delegated work. It groups repeated usage by recorded
agent and provider/model identity, rather than the currently selected model,
and follows session changes and settled usage. Each group pairs its
OpenCode-reported cost total with input, output, cache-write, and cache-read
token counts, current prices per million tokens, and estimated category costs.
Reported totals remain distinct from estimates based on current rates, which
need not reflect historical charges. Estimates and incomplete values are
identified with an **e**; known partial values remain visible and unknown values
are not shown as zero.

Token categories follow the host's reporting semantics: input excludes cached
tokens, and output-rate usage includes visible output and reasoning. Estimates
require known usage and a single applicable current untiered rate; missing or
ambiguous pricing, including unsupported tiered pricing, remains unknown rather
than implying free usage. Base-versus-total cost comparisons remain a future
aim where meaningful; the meaning of base cost remains to be defined.

Both sidebar summaries sum reported costs; neither derives price estimates.
These values are informational, not billing guarantees. OATS aims for useful,
transparent cost reporting and, in the details view, estimates—not
billing-accurate accounting.
Live visibility follows OpenCode's per-step usage settlement rather than a
per-token meter. Provider reporting, cache and reasoning accounting, and
missing or zero pricing can limit what is known; those limits are part of the
picture, not evidence that work was free.
