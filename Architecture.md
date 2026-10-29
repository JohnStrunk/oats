# Project Architecture

This document covers the planned OATS OpenCode V2 TUI plugin and the existing
repository infrastructure. The plugin components describe conceptual boundaries
and data flow, not an implemented plugin or a commitment to specific UI
placements, libraries, or internal APIs.

## Main Components

- **`plugin-ui`**: Presents a compact sidebar overview and a larger detail
  view of session and subagent activity, identities, models, usage, rates,
  and costs. Both views draw from the same attributed usage picture.
- **`session-data-access`**: Connects to OpenCode's session data and updates,
  including the session tree, execution status, usage records, and recorded
  agent and model identities. OpenCode remains the source of execution data.
- **`usage-aggregation`**: Organizes usage by session, subagent, and model,
  relating individual records to session-tree summaries without counting
  delegated work twice. It reconciles provider-reported input, output,
  cache-read, cache-write, and reasoning semantics before deriving totals.
- **`pricing-attribution`**: Associates usage with the applicable model and
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

1. OpenCode supplies the session tree, agent and model identities, and usage
   updates to session data access. Live usage settles at step boundaries,
   rather than arriving as a billing count for each streamed token.
2. Usage aggregation relates those records to the relevant sessions and
   models, retaining the distinction between individual usage and tree totals.
3. Pricing attribution combines that usage with available rates and recorded
   costs to form an explanatory cost breakdown.
4. The plugin UI presents the resulting overview and details, including gaps
   or uncertainty in the underlying data.

## Limitations and Open Definitions

- Agent configuration or a currently selected model is not proof of the model
  used for earlier work. Attribution depends on recorded execution identities,
  and a session may contain work from multiple models.
- Usage reporting varies by provider. Cached and reasoning tokens may overlap
  other reported categories; totals and cost estimates depend on reconciling
  those meanings rather than blindly adding every field.
- Missing usage or pricing limits completeness. A zero recorded price or cost
  does not by itself establish that the provider charged nothing. OATS is not
  a billing ledger, and derived estimates may differ from provider invoices.
- The definition of **base cost**, its relationship to total cost, and when a
  comparison is meaningful remain unresolved. This architecture assigns no
  formula or accounting scope to that term.
- Detailed aggregation conventions, treatment of incomplete records, and UI
  interactions remain for later behavioral specifications. This document
  defines the project boundaries, not those acceptance criteria.
