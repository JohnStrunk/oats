# AGENTS

## Development methodology

This repository is structured as a spec-driven, dark-factory workflow. All
system behavior, configuration, and code is defined via the specifications in
the `features` directory.

### Authoritative artifacts

The following artifacts are considered to be source-of-truth, defining the
specification of the system:

- [`/Vision.md`](Vision.md) - The high-level "vision" for the system/project,
  including its goals and objectives. Start here to understand the purpose of
  the system.
- [`/Architecture.md`](Architecture.md) - The architecture of the system,
  including its components and their interactions. This document provides a
  high-level overview of how the system is structured. It should not contain
  implementation details, only the high-level components and their interfaces
  to each other and the external world.
- [`/features/**`](features) - This directory contains the specifications for
  the system's features, written in Gherkin syntax, and the step definitions.
  See [`/features/AGENTS.md`](features/AGENTS.md) for the authoritative format,
  tagging requirements, and directory layout.
- [`/AGENTS.md`](AGENTS.md), [`/.agents/**`](.agents), and
  [`/.opencode/**`](.opencode) - These files contain the development
  methodology and the definitions of the agents that develop and test the
  system.

### Incremental development vs. Clean-room regeneration

- **Incremental development is the norm:** Implementation code,
  configurations, and test step definitions are checked into version control.
  Daily evolution proceeds incrementally, maintaining existing working
  features while adding or refining behavior.
- **Regeneration invariant:** All code and step implementations remain
  conceptually derived from the authoritative artifacts. It must always be
  possible to delete all derived artifacts and regenerate the system from
  scratch using only the authoritative artifacts.

### Language and framework selection

- **Consistency:** The programming language, framework, and toolchain must
  remain consistent within a given generation of the project.
- **Freedom of choice:** Unless an authoritative requirement in
  [`/Vision.md`](Vision.md), [`/Architecture.md`](Architecture.md), or
  [`/features/**`](features) explicitly mandates a specific technology, the
  agent is free to select the most suitable modern language and framework for
  that generation.

### Agent roles and separation of duties

Specialized subagents are defined in [`.agents/agents/`](.agents/agents/) and
mirrored in [`.opencode/agents/`](.opencode/agents/) for compatibility with
both Antigravity and OpenCode v2:

1. **[`qa-spec`](.agents/agents/qa-spec.md)** — Requirements & QA
   Specification Agent:
   - Uses the `eliciting-requirements` skill to craft EARS rules.
   - Creates `.feature` files in `features/` per
     [`features/AGENTS.md`](features/AGENTS.md).
   - Generates executable step definitions in `features/steps/<type>`
     (`given/`, `when/`, `then/`) incorporating property-based testing.
   - Ensures tests fail before implementation (Red phase).

2. **[`developer`](.agents/agents/developer.md)** — Implementation Agent:
   - Selects or adheres to the consistent language and framework for the
     generation.
   - Implements application code and wiring to satisfy feature specifications
     (Green phase).
   - Does not alter test assertions or acceptance criteria to force passes.

3. **[`verifier`](.agents/agents/verifier.md)** — Verification & Gatekeeper
   Agent:
   - Executes the test suite and audits step definitions for anti-tautology
     and mock integrity.
   - Enforces architectural alignment with
     [`Architecture.md`](Architecture.md) and tagging compliance with
     [`features/AGENTS.md`](features/AGENTS.md).
   - Audits clean-room regeneration capability from scratch.

4. **[`security`](.agents/agents/security.md)** — Security Review & Audit Agent:
   - Operates alongside the `verifier` agent to inspect implementation code,
     dependencies, and system configuration for security vulnerabilities.
   - Audits changes against authoritative security benchmarks, emphasizing the
     OWASP Top 10, OWASP API Security Top 10, and OWASP Top 10 for LLM
     Applications.
   - Gates releases against critical security risks, insecure defaults, secret
     leaks, and supply chain threats.

### Development workflow

1. **Elicit requirements:** When adding a feature, fixing a bug, or modifying
   behavior, the `qa-spec` agent uses the `eliciting-requirements` skill
   interactively with the user to construct EARS rules.
2. **Draft feature specifications:** Add each EARS rule as a `.feature` file
   in `features/` named after a slugified version of the rule. Follow the
   schema in [`features/AGENTS.md`](features/AGENTS.md).
3. **Implement step definitions & property tests:** The `qa-spec` agent
   creates step definitions under `features/steps/{given,when,then}/`,
   formulating invariant properties with property-based testing.
4. **Implement behavior:** The `developer` agent implements system code,
   configs, and dependencies to make tests pass.
5. **Verify, audit & gate:** The `verifier` agent runs the test suite and audits
   architectural boundaries while the `security` agent inspects code and
   configurations for security vulnerabilities against OWASP standards,
   jointly certifying readiness for commit.
