# Vision

**OATS (OpenCode Agent Token Stats)** is an OpenCode V2 TUI plugin for
users who want to understand token usage and cost across a session and its
subagents while work is happening. Its goal is to make delegated work visible
without leaving the terminal or piecing together separate session records.

The current bootstrap displays an **OATS loaded** startup toast. Token usage,
cost reporting, and the views described below remain planned.

The intended experience combines a compact sidebar overview with a larger
detail view. Together, these views will connect agent and subagent names to
the models actually used, showing input, output, cache-read, cache-write, and
total tokens, applicable prices per million tokens, and per-dimension and
total costs. Base-versus-total cost comparisons are an aim where meaningful;
the meaning of base cost remains to be defined.

OATS aims for useful, transparent estimates, not billing-accurate accounting.
Live visibility follows OpenCode's per-step usage settlement rather than a
per-token meter. Provider reporting, cache and reasoning accounting, and
missing or zero pricing can limit what is known; those limits are part of the
picture, not evidence that work was free.
