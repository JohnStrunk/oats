# Data and cost details

OATS presents the usage and cost information OpenCode makes available. This
page explains what the summaries include, how displayed costs are formatted,
and why incomplete or unknown values should not be read as zero. See the
[usage guide](usage.md) for sidebar and modal interactions.

## Session data access

Session data access retains each record's recorded agent and model identities,
reported usage, and OpenCode-reported cost rather than attributing historical
work to current selections. Unknown usage or cost remains distinct from a
reported zero; a reported cost is not proof of the provider's actual charge.

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
recovery allows attribution; it is not treated as proof that a session is not a
fork. Partial loading failures preserve attributable records and indicate
incompleteness. Refresh retries unavailable data where the host can supply it.

OpenCode v2.0.32 typically does not persist historical events. This observation
is version-specific and has not been established for later releases. Some
event-only usage and retry attempts may be unreconstructible once those events
are lost, so available records are not a guarantee of complete history. Refresh
cannot recover data the host no longer has.

Both sidebar sections distinguish loading, confirmed-empty history, and
unavailable history. A complete-looking row is not proof that history is
complete. Summary-level history gaps without a row-level `e` marker are not
separately indicated in either section. See the [usage guide](usage.md) for the
row-level completeness markers.

## Reported cost aggregation

Both sidebar sections show informational OpenCode-reported costs, not estimates
derived from token rates. They do not guarantee billing accuracy. A reported
zero does not prove that the provider charged nothing.

Agent stats summarizes reported costs by recorded agent name for the displayed
session and its descendants, including nested delegated work. Repeated
invocations and work across models combine under the same name. Each individual
reported cost is counted once under the agent that performed the work, without
adding delegated tree totals again.

Model stats groups reported costs by recorded model ID in the same session
subtree, combining matching IDs across providers and agents into one row per
usable ID. Grouping uses the ID on each usage record rather than the currently
selected model; catalogue-only and currently selected models do not create or
replace rows. Row labels use the catalogue `name` for the provider on the usage
record. If an ID appears in usage from multiple providers with different
catalogue names, the label uses the `name` for the provider on the earliest
recorded usage for that ID. If that matching `name` is missing or empty, the
recorded ID remains the label. Work without a usable recorded model ID remains
in an **Unattributed** row. Model stats does not derive provider-price estimates.

Summaries retain known totals and indicate incompleteness. Missing or ambiguous
cost is not treated as zero; an agent or model group with no known cost has no
known total. In Agent stats, work without a recorded agent name remains
unattributed, preserving its known cost rather than assigning it to another
agent or dropping it. Any such unattributed work makes the Agent stats summary
incomplete, even when its cost is known. Unknown session-wide data-access gaps
mark only the overall Agent stats summary incomplete; each agent's
incompleteness flag reflects only that agent's available records. An unset agent
flag therefore does not guarantee that all of the agent's work is present when
the overall summary is incomplete.

Aggregation runs on demand from each latest scoped session-data snapshot; it
does not itself subscribe to updates or maintain reactive summaries. The sidebar
requests summaries as its scoped data changes. Invoking aggregation again with
the latest snapshot reflects record additions and updates without duplicate
contributions or retained contributions from earlier snapshots. The supplied
scope covers the displayed session subtree, excluding unrelated sessions and
the previously displayed subtree. No displayed session means no sidebar
summaries.

## Reported-cost precision and display

Reported numeric costs are added with accurate decimal arithmetic before
display rounding. For example, `$0.10 + $0.20` displays as `$0.30`, not `$0.31`
from a binary floating-point addition artifact. For each finite normalized host
`Number`, the exact decimal value used is its shortest round-trip decimal
representation: the shortest decimal text that converts back to the same
`Number`. This does not preserve the original JSON or provider decimal text and
cannot recover precision already lost by the provider or host.

Agent stats and Model stats order rows by descending exact reported-cost totals
before display rounding. Known incomplete rows sort by their known total. Finite
totals outside the `$9999.99` display bound still sort by exact value. The
**Unattributed** row sorts by its own total.

Rows with unknown totals, including sums that overflow the host `Number` range,
appear last. Unknown named rows retain insertion order, defined as the order in
which each named identity first appeared. Tied known named rows also retain
insertion order. When totals tie, the **Unattributed** row follows named rows.

Displayed totals are rounded up toward positive infinity to the next cent;
amounts already at an exact cent remain unchanged. Any positive amount below one
cent displays as `$0.01`. For example, `$1.231` displays as `$1.24`. Negative
amounts also round toward positive infinity: `-$0.011` displays as `$-0.01`, not
`$-0.02`. This is display rounding of the aggregated total, not rounding of
individual records or billing-exact accounting.

The maximum displayable magnitude is `$9999.99`. Rounded totals above that range
display as `>$9999.99`; those below `-$9999.99` display as `<-$9999.99`, rather
than an exact clipped cap. The completeness marker is preserved even when a
total is outside the display range.

## Current-price estimates in usage details

The compact sidebar shows reported costs. The usage details modal also presents
token breakdowns and current-price estimates. Its heading uses the
OpenCode-reported cost for the agent/model pair, not the sum of the estimated
category costs.

In the modal, **Price** shows the current model price per million tokens, or
`mixed` when calls use different pricing tiers rather than implying one shared
rate. **Tokens** shows available token counts; **Output** includes host-reported
reasoning tokens, priced at the output rate. **Cost** sums per-call category
estimates, each calculated as the applicable current-tier price × that call's
tokens ÷ 1,000,000. Pricing tiers are selected per call, not from the combined
token count.

`e` identifies estimates and partial or incomplete values. Unknown usage,
prices, and costs are not treated as zero; partial results retain the known
portion rather than implying a complete total. If a call's applicable tier
cannot be determined, its estimate remains unknown and the combined result
remains partial or unknown. A reported zero price or cost does not prove the
provider charged nothing.

Current-price estimates are not historical charges. Available model prices may
differ from those in effect when the work ran or from your provider's billing
terms. Estimated category costs can therefore differ from the reported heading
and sidebar costs or your invoice. Provider usage accounting and missing prices
or token counts can also limit the breakdown. OATS is not a billing ledger.

## Planned experience

- Token usage and model-price-derived estimates in the sidebar.
- Base-versus-total cost comparisons, once their meaning is defined.

Usage reporting and cost estimates depend on the data available from OpenCode
and model providers. Estimates are informational, not billing guarantees, and
may differ from provider invoices.
