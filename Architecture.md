# Project Architecture

This document covers the OATS OpenCode V2 TUI plugin and the existing repository
infrastructure. The plugin presents an **OATS loaded** startup toast and an
**Agent stats** session-sidebar section through the OpenCode TUI host. Session
data access supplies individual records; usage aggregation sums reported costs
by agent name for the sidebar. Pricing attribution and a larger detail view
remain planned. The descriptions below define conceptual boundaries and
required host surfaces, not a commitment to specific libraries or internal
APIs. The documented supported OpenCode
host version follows the exact `@opencode/cli` pin in
[the host package manifest](.github/tooling/opencode-host/package.json);
compatibility with other releases is not established. An upgrade must pass
verification before support for the newly pinned release is established.

## Main Components

- **`plugin-ui`**: Presents the startup toast and a collapsible **Agent stats**
  section in the session sidebar. It owns presentation of scoped reported-cost
  summaries, data status, and mouse and keyboard toggling. Expansion starts
  enabled; the user's choice is shared across sessions for the application
  lifetime and resets on restart. Collapsing changes visibility, not data scope
  or freshness when reopened. The UI coordinates session-data updates with
  on-demand aggregation rather than calculating costs itself. Display formatting
  rounds aggregated reported-cost totals toward positive infinity to the next
  cent, leaving exact-cent amounts unchanged, without changing underlying
  records or aggregation. This applies to negative totals too; any positive
  total below one cent displays as one cent. It distinguishes
  empty history, loading, and unavailable data, preserves known partial totals,
  and visibly identifies incomplete totals and unattributed work. A larger
  detail view of activity, models, tokens, rates, and costs remains planned.
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
  surfaces and interaction facilities for the sidebar, startup toast, and
  planned detail view within the terminal.
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

The bootstrap uses the TUI host to present its startup toast. The sidebar
connects session data access and reported-cost aggregation to presentation;
pricing attribution and a larger detail view remain planned:

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
   displayed sessions. No displayed session means no agent summaries. The
   aggregation component itself has no reactive subscription or UI ownership.
3. The plugin UI requests summaries for available history when a session opens
   and as scoped data changes, presenting one row per recorded agent name,
   including nested delegated work and combining repeated invocations. Settled
   usage updates the displayed costs; session switching changes the displayed
   scope without retaining the previous session's totals. Reopening a collapsed
   section presents current data. Status and uncertainty remain visible rather
   than converting missing or ambiguous data into a complete zero-cost result.
4. Planned pricing attribution combines usage with available rates and recorded
   costs to form an explanatory cost breakdown.
5. A planned larger detail view presents broader breakdowns, including gaps or
   uncertainty in the underlying data.

## Limitations and Open Definitions

- Agent configuration or a currently selected model is not proof of the model
  used for earlier work. Attribution depends on recorded execution identities,
  and a session may contain work from multiple models.
- OpenCode v2.0.32 typically does not persist historical events. This observation
  is version-specific, not established for later releases. Some event-only
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
  a billing ledger. Displayed sidebar totals are rounded informational reported
  costs, not billing-exact values, derived estimates, or billing guarantees;
  future estimates may differ from provider invoices.
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
  [features/usage-aggregation/](features/usage-aggregation/). Behavioral
  specifications in [features/](features/) define sidebar acceptance criteria
  and interactions; this document defines conceptual boundaries rather than
  implementation details. Token aggregation, model-price-derived estimates,
  and larger detail-view behavior remain outside the initial sidebar milestone.
- These boundaries and the authoritative behavioral specifications must remain
  sufficient to regenerate the sidebar without relying on existing derived
  implementation code. Specific UI libraries, internal APIs, and test helpers
  are not architectural requirements.
