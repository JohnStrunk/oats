# Using OATS

OATS confirms startup with an **OATS loaded** toast. In the session sidebar, it
shows sibling **Agent stats** and **Model stats** sections. Both sections start
expanded and can be collapsed independently.

## Agent stats

1. Open a session with available history and show the session sidebar.
2. Find **Agent stats**. Each named agent has one row with its total known
   OpenCode-reported cost, including nested delegated work. Repeated invocations
   of the same agent are combined, even across models. Costs are right-aligned
   in a shared column.
3. Click the **Agent stats** title to collapse or expand that section. For
   keyboard interaction, open OpenCode's command palette and select **Toggle
   Agent stats**. This command affects Agent stats only. The heading uses the
   host's disclosure indicators: `▼` when expanded and `▶` when collapsed.
4. Switch sessions to see costs for the newly displayed session subtree. The
   Agent stats expansion choice is shared across sessions for this application
   lifetime, independently of Model stats. Restarting the application defaults
   it to expanded.

Available history appears when a session opens. Costs update as OpenCode settles
usage at step boundaries, not for every streamed token. Collapsing a section
does not leave stale data when it is reopened. When you switch sessions, the
scope follows the newly displayed session and its descendants, excluding
unrelated sessions and the previous session subtree. See [data and cost
details](data-and-costs.md#session-data-access) for history states, gaps, and
completeness.

Work without a recorded agent name remains **Unattributed**, rather than being
dropped or assigned to another agent. Unattributed rows use the same alignment
and completeness formatting as named-agent rows.

Known incomplete row totals remain visible with a lowercase `e` marker. When at
least one Agent stats row has `e`, that section displays the legend
`e = estimated` exactly once; it omits the legend when no row has `e`. Unknown
totals display as `unavailable`, without an `e` marker.

Each agent row uses its own available label width. Safe names are shown in full
when they fit and ellipsized only when needed. Labels are disambiguated only
when their fitted forms collide; disambiguation does not change attribution to
the original recorded names.

Agent stats shows reported costs, not estimates derived from token rates. The
usage details modal provides token breakdowns and current-price estimates.
Reported costs and estimates have different meanings; see
[data and cost details](data-and-costs.md).

## Model stats

1. Open the session sidebar for a session with available history. Find
   **Model stats** beside **Agent stats**; it starts expanded.
2. Each row shows the total known OpenCode-reported cost for one recorded model
   ID in the displayed session subtree, including nested delegated work.
   Matching IDs combine into one row across providers and agents. Grouping uses
   the ID on each usage record, not the currently selected model. Catalogue-only
   and currently selected models do not create or replace rows. Each row label
   uses the catalogue `name` for its usage provider. If an ID appears in usage
   from multiple providers with different catalogue names, OATS uses the `name`
   for the provider on the earliest recorded usage for that ID; if that matching
   `name` is missing or empty, the recorded ID remains the label. Labels retain
   the existing truncation and collision-disambiguation behavior: they stay full
   when they fit and shorten only when width or a collision requires it. Work
   without a usable recorded model ID remains in an **Unattributed** row rather
   than being dropped or assigned to another ID. Model stats reports recorded
   costs only; it does not calculate price estimates.
3. Click the **Model stats** title to collapse or expand this section without
   changing Agent stats. For keyboard interaction, open OpenCode's command
   palette and select **Toggle Model stats**. The heading uses the host's
   disclosure indicators: `▼` when expanded and `▶` when collapsed.
4. Switch sessions to see costs for the new session subtree. Model stats has its
   own expansion choice, independent of Agent stats and shared across sessions
   for this application lifetime. Restarting the application defaults it to
   expanded.

Known incomplete Model stats row totals remain visible with a lowercase `e`
marker. Model stats displays its own `e = estimated` legend exactly once when at
least one model row has `e`; it omits the legend when no model row has `e`.
Unknown totals display as `unavailable`, without an `e` marker.

## Usage details

Click **(details)** in Agent stats to open the details modal without collapsing
or expanding the sidebar section. Use the host's standard modal scrolling
controls to browse the tables. The modal has a visible border and is titled
**Agent cost details**. Click the on-screen `esc` control, press **Escape**, or
click outside the modal to dismiss it.

The modal groups available usage by recorded agent and model, sorted by agent
and then model. Models from different providers remain separate, and work
without a recorded agent is grouped as unattributed. Each table has **input**,
**output**, **cache write**, and **cache read** columns:

- **Price** shows the current price, or `mixed`.
- **Tokens** shows available token counts.
- **Cost** shows estimated costs for each category.

The `e` marker identifies estimated or partial values. See [data and cost
details](data-and-costs.md#current-price-estimates-in-usage-details) for the
distinction between reported group costs and category estimates, calculation
details, and limitations.

The open modal follows the currently displayed session and its descendants,
updating as session data changes and usage settles at step boundaries, not for
every streamed token. Available records do not guarantee complete history; the
[session-data limitations](data-and-costs.md#session-data-access) also apply to
these details, including missing events and uncertain fork provenance.
