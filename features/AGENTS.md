# Feature Specification Guidelines

This document defines the authoritative schema and standards for all
specification files in the `features/` directory and their executable step
definitions.

---

## 1. Feature File Format

All specifications are written in Gherkin syntax. Each `.feature` file
represents exactly **one EARS rule**.

### 1.1 Feature Title

The `Feature:` title **must be the exact, normative EARS rule sentence**
describing the behavior.

- EARS rules must follow the standard EARS syntax and contain exactly one
  `shall`.
- The filename must be a slugified version of the EARS rule (e.g.,
  `when-valid-credentials-are-submitted-issue-jwt.feature`).

### 1.2 Tags

Every feature file must be tagged at the feature header level with tags
identifying:

1. **EARS Template Type** (must specify at least one):
   - `@ears:ubiquitous` — System ubiquitous requirement (`The <system> shall
     <action>`)
   - `@ears:event-driven` — Event-driven requirement (`When <trigger>, the
     <system> shall <action>`)
   - `@ears:state-driven` — State-driven requirement (`While <state>, the
     <system> shall <action>`)
   - `@ears:unwanted-behavior` — Unwanted behavior / error requirement (`If
     <trigger>, then the <system> shall <action>`)
   - `@ears:optional-feature` — Optional capability (`Where <feature is
     included>, the <system> shall <action>`)
   - `@ears:complex` — Complex combination (`While <state>, When <trigger>,
     the <system> shall <action>`)
2. **System Component** (maps to architecture components in
   `/Architecture.md`):
   - `@component:<component-name>` (e.g., `@component:auth-service`,
     `@component:order-router`)
3. **Interfaces Involved** (maps to external interfaces in
   `/Architecture.md`):
   - `@interface:<interface-name>` (e.g., `@interface:http-rest`,
     `@interface:cli`, `@interface:storage`)

### 1.3 Example Feature File Structure

```gherkin
@ears:event-driven
@component:session-manager
@interface:http-api
Feature: When a valid authentication token is provided, the session manager shall renew the session expiry time

  As a client application
  I want my active session extended upon valid requests
  So that authenticated users are not prematurely logged out during active usage

  Background:
    Given an active user session exists in the session store

  Scenario: Successful session renewal on valid request
    Given the session has remaining time before expiration
    When an authenticated HTTP request is received with token "valid-token-123"
    Then the session expiry timestamp shall be extended by 3600 seconds
    And the HTTP response status code shall be 200

  Scenario Outline: Invariant session renewal across arbitrary valid TTLs
    Given a session with remaining TTL of <initial_ttl> seconds
    When an authenticated renewal request is processed
    Then the new TTL shall equal <initial_ttl> plus 3600 seconds
    And the expiration date shall always be in the future

    Examples:
      | initial_ttl |
      | 1           |
      | 60          |
      | 3599        |
```

## 2. Step Definitions Organization

Step definition implementations must be strictly separated by step semantics
and located in the directories below. For the current generation, implement
steps as JavaScript ES modules (`.js`) using Cucumber.js.

```text
features/
└── steps/
    ├── given/     # Setup, preconditions, state initialization
    ├── when/      # Actions, events, triggers, external stimuli
    └── then/      # Assertions, invariant checks, observable outcomes
```

### 2.1 File Placement Rules

- **`features/steps/given/`**: Place files defining `Given` step handlers.
  These prepare system state, seed storage, or mock external third-party
  boundaries.
- **`features/steps/when/`**: Place files defining `When` step handlers. These
  execute the stimulus, invoke CLI commands, trigger HTTP requests, or send
  messages across system boundaries.
- **`features/steps/then/`**: Place files defining `Then` step handlers. These
  execute observable assertions, check post-conditions, and evaluate invariant
  contracts.

### 2.2 Naming and Modularity

- Step definition files must implement exactly one step.
- Name step files as a slugified version of the step that they implement, e.g.:
  - `features/steps/given/an-authenticated-user-exists.js`
  - `features/steps/when/a-valid-login-request-is-received.js`
  - `features/steps/then/the-session-expiry-is-extended.js`
- Keep step definitions reusable across scenarios, and attempt to re-use
  existing steps rather than creating new ones for similar behavior.
- Step definitions must test against the actual system boundaries (e.g.,
  public API, CLI invocation, service interface) rather than bypassing logic
  with mock-only assertions.

### 2.3 Support Code and Test Execution

- Keep shared helpers, scenario World setup, and lifecycle hooks separate from
  files that register individual steps. Keep scenario state isolated and clean
  up resources, including child processes and temporary directories, on failure
  as well as success.
- Cucumber's ES-module configuration explicitly loads step files; shared support
  is loaded transitively through their imports. Keep unit-test files out of
  Cucumber's support-code import graph.
- Harness unit tests currently use Node.js's built-in test runner and run
  without launching the real OpenCode host. The tagged smoke scenarios exercise
  that boundary.
- From the repository root, run `npm run test:unit` for unit tests,
  `npm run test:features` for all acceptance scenarios, or `npm test` for both.
  Filter acceptance scenarios with a Cucumber tag expression, for example
  `npm run test:features -- --tags '@component:plugin-ui'`.
- Follow [README.md](../README.md) for real-host smoke-test prerequisites and
  isolation constraints. A test-framework migration must preserve observable
  assertions and negative controls, not replace them with mock-only checks.

---

## 3. Property-Based Testing Guidelines

Where behavior specifies invariants across variable input ranges:

- In the step definition, use a JavaScript property-based testing framework
  compatible with the current stack (for example, `fast-check`). Record the
  selected dependency in the package manifest and lockfile.
- The step handler should run randomized generative inputs to verify that the
  normative requirement holds across boundary values, null inputs, and extreme
  scales.
