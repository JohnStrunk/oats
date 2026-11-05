# Development guide

This page is for contributors working from a repository checkout. Start with
the project [vision](../Vision.md), [architecture](../Architecture.md), and
[feature specifications](../features/). The development process treats those
documents as the source of truth for system behavior.

## Specification-driven development

The project uses an agent-assisted, specification-driven workflow:

1. Define the goals and audience in [Vision.md](../Vision.md).
2. Describe components and interfaces in [Architecture.md](../Architecture.md).
3. Refine requirements into EARS (Easy Approach to Requirements Syntax) rules
   and Gherkin specifications in [`features/`](../features/), with executable
   step definitions.
4. Implement behavior against those specifications, then verify and audit it.

Feature specifications follow the conventions in
[`features/AGENTS.md`](../features/AGENTS.md). Agent stats and Model stats
present reported costs; the details modal adds token breakdowns and current-
price estimates. The items listed under
[Planned experience](data-and-costs.md#planned-experience) remain future work.

## Developing from a checkout

The bootstrap is a JavaScript package with a TUI entrypoint; no build step is
required. For checkout development and verification, run `npm ci` from the
repository root to install the locked dependencies. See
[Testing and CI](testing-ci.md) for runtime prerequisites and verification
commands. This dependency setup is for contributors; it is not the user plugin
installation method.

The package exports `./tui` as `src/tui.js`. A root-level `tui.js` forwards to
that entrypoint because the v2.0.32 host's local-directory resolver needs the
root file even with the package export present. This is a version-specific
observation, not a verified limitation of later releases. Keep this shim when
changing the plugin entrypoint.

Host tests take their expected version from the `@opencode/cli` dependency in
[the host manifest](../.github/tooling/opencode-host/package.json). Its lockfile
supplies a reproducible installation. See [Testing and CI](testing-ci.md) for
supported-version and test prerequisites.

## Host-provided UI runtime

The supported host supplies the shared Solid and OpenTUI runtime used by the
plugin. OATS does not install OpenTUI as a production dependency. Installing a
packed OATS package in a fresh npm consumer was verified against OpenCode 2.0.32
when it was the pinned TUI release, including rendering and the Agent stats
palette toggle. `npm audit --omit=dev` reported no vulnerabilities for that
consumer dependency tree. This does not audit the host executable or establish
compatibility with other host releases.

The OpenTUI packages in this checkout are development-only test dependencies;
their Solid peer is overridden locally, and that override does not apply to npm
consumers. Do not install these OpenTUI packages as consumer dependencies merely
to load OATS: their strict Solid peer can pull an affected older release.

For the host's plugin API, see the official
[V2 CLI plugin documentation](https://opencode.ai/v2/docs/build/plugins/cli).

## Internal aggregation facade

For internal consumers, `createUsageAggregation(sessionData).getSummary()` reads
the latest snapshot on each call. This facade is not a public package API.
