# Project Architecture

This document covers the OATS OpenCode V2 TUI plugin and the existing repository
infrastructure. The plugin bootstrap displays an **OATS loaded** startup toast
through the OpenCode TUI host. Session data access supplies individual records;
internal usage aggregation sums reported costs by agent name. Pricing attribution
and reporting views remain planned. The
descriptions below define conceptual boundaries, not a commitment to specific
UI placements, libraries, or internal APIs. The host compatibility scope is
pinned to OpenCode **v2.0.32**; compatibility with other releases is not established.

## Main Components

- **`plugin-ui`**: Currently presents the startup toast. Planned reporting
  presents a compact sidebar overview and a larger detail
  view of session and subagent activity, identities, models, usage, rates,
  and costs. Both views draw from the same attributed usage picture.
- **`session-data-access`**: Supplies available historical and live individual
  usage records for the displayed session and its descendants, retaining recorded
  agent and model identities and OpenCode-reported costs. It exposes missing
  data and partial failures without inventing values, preserving attributable
  records and retrying unavailable data on refresh where the host can supply
  it. History with unproven provenance is withheld, with uncertainty flagged;
  the conservative fork and metadata rules below limit availability.
  Changing the displayed session changes
  the dataset's scope; no displayed session means an empty dataset. OpenCode
  remains the source of execution data. This component does not aggregate
  records or present statistics.
- **`usage-aggregation`**: Internally summarizes individual OpenCode-reported costs
  on demand from each latest scoped session-data snapshot, by recorded agent
  name for the displayed session and its descendants. It does not subscribe to
  updates or maintain reactive summaries. Repeated
  invocations and work across models share a summary under the same name;
  delegated work remains attributed to the executing agent without counting
  tree totals again. Summaries distinguish known totals from incomplete data
  and preserve work with unknown identity as unattributed. This capability does
  not present a UI, derive pricing estimates, or establish billing accuracy.
  Token aggregation and broader session and model breakdowns remain planned;
  token totals will require reconciling provider-reported input, output,
  cache-read, cache-write, and reasoning semantics.
- **`pricing-attribution`** (planned): Associates usage with the applicable model and
  provider pricing, expressed as rates per million tokens. It relates
  per-dimension and total cost estimates to OpenCode-reported costs while
  preserving distinctions between reported values, derived estimates, and
  unavailable pricing.
- **`repo-infrastructure`**: Repository automation, continuous integration workflows, automated dependency maintenance, verification pipelines, code quality linters, and merge gate coordination.

## External Interfaces

- **`opencode-tui`**: OpenCode V2's plugin host and supported UI extension
  surfaces for presenting the overview and detail view within the terminal.
- **`opencode-session-data`**: OpenCode's session, message, hierarchy, status,
  and update interfaces, accessed through the plugin data facilities and
  connected OpenCode client. These supply the records behind session and
  subagent attribution.
- **`opencode-model-pricing`**: Model and provider metadata exposed by
  OpenCode, together with recorded usage and cost information. Provider
  reporting and pricing availability constrain the plugin's estimates; a
  separate billing-provider integration is not assumed.
- **`github-actions`**: GitHub Actions event hooks (pull requests, branch pushes, workflow dispatches) and the GitHub Checks API for job conclusion reporting and branch protection merge gating.
- **`renovate`**: Renovate bot configuration interface for automated dependency updates, digest pinning, release age cooldowns, and pull request rebasing.
- **`mergify`**: Mergify bot automation interface for merge queue management, automated qualification gating against CI checks, and pull request merging.
- **`cli`**: Developer and automation command-line interfaces for executing build tools, linters, and test runners locally or within CI containers.

## Information Flow

The bootstrap uses the TUI host to present its startup toast. Session data
access and internal reported-cost aggregation provide the first two stages of
the statistics flow; pricing attribution and reporting views remain planned:

1. OpenCode supplies available historical records and live updates for the displayed
   session subtree to session data access. Records retain execution identities,
   reported usage and cost, and indications of missing or incomplete data.
   Live usage settles at step boundaries, rather than arriving as a billing
   count for each streamed token. Updates replace individual records without
   duplicating them.
2. On demand, usage aggregation takes the latest scoped snapshot and sums each
   individual reported cost once by recorded agent
   name, retaining known totals and indications of incomplete or unattributed
   work. A subsequent invocation reflects additions and updates in its supplied
   snapshot without retaining contributions from earlier snapshots. The supplied
   scope isolates the displayed session subtree from unrelated or previously
   displayed sessions. No displayed session means no agent summaries. There is
   no reactive subscription or reporting UI for this aggregation capability.
3. Planned pricing attribution combines usage with available rates and recorded
   costs to form an explanatory cost breakdown.
4. Planned reporting UI presents the resulting overview and details, including gaps
   or uncertainty in the underlying data.

## Limitations and Open Definitions

- Agent configuration or a currently selected model is not proof of the model
  used for earlier work. Attribution depends on recorded execution identities,
  and a session may contain work from multiple models.
- OpenCode v2.0.32 typically does not persist historical events. Some event-only
  usage and retry attempts may therefore be unreconstructible after the event
  is lost. Persisted records do not guarantee a complete execution history;
  refreshing cannot recover data the host no longer has. Session data access
  exposes uncertainty without inventing records or missing values.
- Forks can contain copied records from earlier work. Without provenance that
  distinguishes copies from new execution, all historical records for a known
  fork may be withheld, including possible post-fork work. Independently
  attributable descendants and live-witnessed work may still be available;
  this does not establish completeness of the fork's history.
- Failed or unavailable session metadata leaves historical provenance unproven.
  Such history is withheld until metadata lookup recovers and attribution can
  be established, rather than assuming the session is not a fork. Uncertainty
  remains explicit; no records are invented to fill the gap.
- Usage reporting varies by provider. Cached and reasoning tokens may overlap
  other reported categories; totals and cost estimates depend on reconciling
  those meanings rather than blindly adding every field.
- Unknown usage or cost remains distinct from a reported zero. Missing usage
  or pricing limits completeness. A zero recorded price or cost
  does not by itself establish that the provider charged nothing. OATS is not
   a billing ledger, and derived estimates may differ from provider invoices.
- Reported-cost aggregation retains the known portion of an agent's total and
  identifies incompleteness when cost is missing or ambiguous. No known cost is
  not a known zero. Unknown agent identity remains unattributed rather than
  assigning work to another agent or discarding its known cost. Data-access
  gaps also limit the completeness of the overall summary; aggregation cannot
  reconstruct missing history.
- The definition of **base cost**, its relationship to total cost, and when a
  comparison is meaningful remain unresolved. This architecture assigns no
  formula or accounting scope to that term.
- Reported-cost aggregation behavior is specified in
  [features/usage-aggregation/](features/usage-aggregation/). Token aggregation,
  how reporting views present incomplete records, and UI interactions remain
  for later behavioral specifications. This document defines the project
  boundaries, not those acceptance criteria.
