# OATS — OpenCode Agent Token Stats

OATS is a planned OpenCode v2 plugin for understanding token usage and
estimated costs across agents, subagents, and models.

**Status: project definition only.** The plugin is not implemented. This
repository currently contains development guidance and repository
infrastructure specifications, not an installable plugin.

## Planned experience

- A compact sidebar overview of token usage and estimated costs.
- An expanded view with token and estimated-cost breakdowns per agent and
  subagent, and per model.

Usage reporting and cost estimates will depend on the data available from
OpenCode and model providers. Estimates are informational, not billing
guarantees, and may differ from provider invoices.

## Specification-driven development

The project uses an agent-assisted, specification-driven workflow:

1. Define the goals and audience in [Vision.md](Vision.md).
2. Describe components and interfaces in [Architecture.md](Architecture.md).
3. Refine requirements into EARS (Easy Approach to Requirements Syntax) rules
   and Gherkin specifications in [features/](features/), with executable step
   definitions.
4. Implement behavior against those specifications, then verify and audit it.

These documents guide future implementation; this README describes the
planned direction, not completed plugin behavior. Feature specifications
follow the conventions in [features/AGENTS.md](features/AGENTS.md).

## Repository infrastructure

Existing specifications in [features/repo-infrastructure/](features/repo-infrastructure/)
cover CI, linting, Renovate dependency management, and Mergify merge queue
automation.

Run the repository infrastructure verification suite with:

```bash
uvx --with pyyaml --with json5 behave
```
