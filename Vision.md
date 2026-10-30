# Vision

**OATS (OpenCode Agent Token Stats)** is an OpenCode V2 TUI plugin for
users who want to understand token usage and cost across a session and its
subagents while work is happening. Its goal is to make delegated work visible
without leaving the terminal or piecing together separate session records.

The reporting experience includes a collapsible **Agent stats** section in
the session sidebar, alongside the **OATS loaded** startup toast. It shows known
OpenCode-reported costs by recorded agent name across the displayed session and
nested delegated work, combining repeated invocations. Incomplete totals and
unattributed work remain visible; empty history, loading, and unavailable data
are distinct rather than implying that work cost nothing.

The section starts expanded and supports mouse and keyboard toggling. The
user's expansion choice is shared across sessions for the application lifetime,
not persisted across restarts. Available history appears when a session opens,
and settled usage and session changes keep the display current, including when
the section is reopened after being collapsed.

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

The initial sidebar sums reported costs; it does not derive cost estimates.
These values are informational, not billing guarantees. OATS aims for useful,
transparent reporting and estimates, not billing-accurate accounting.
Live visibility follows OpenCode's per-step usage settlement rather than a
per-token meter. Provider reporting, cache and reasoning accounting, and
missing or zero pricing can limit what is known; those limits are part of the
picture, not evidence that work was free.
