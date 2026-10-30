# Vision

**OATS (OpenCode Agent Token Stats)** is an OpenCode V2 TUI plugin for
users who want to understand token usage and cost across a session and its
subagents while work is happening. Its goal is to make delegated work visible
without leaving the terminal or piecing together separate session records.

The initial reporting experience is a collapsible **Agent stats** section in
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

The broader intended experience combines the compact sidebar overview with a
larger detail view. Token breakdowns, the larger view, model-price-derived
estimates, and base-versus-total comparisons remain outside the initial sidebar
milestone. Together, the broader views will connect agent and subagent names to
the models actually used, showing input, output, cache-read, cache-write, and
total tokens, applicable prices per million tokens, and per-dimension and
total costs. Base-versus-total cost comparisons are an aim where meaningful;
the meaning of base cost remains to be defined.

The initial sidebar sums reported costs; it does not derive cost estimates.
These values are informational, not billing guarantees. OATS aims for useful,
transparent reporting and, later, estimates, not billing-accurate accounting.
Live visibility follows OpenCode's per-step usage settlement rather than a
per-token meter. Provider reporting, cache and reasoning accounting, and
missing or zero pricing can limit what is known; those limits are part of the
picture, not evidence that work was free.
