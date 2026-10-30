@ears:event-driven
@component:repo-infrastructure
@interface:cli
@interface:github-actions
@interface:renovate
Feature: When the configured OpenCode host pin changes, the CI workflow verification shall accept the updated exact pin

  Scenario: Exact host pins do not require a separate version literal in the CI verification
    When CI workflow verification is run against generated exact OpenCode host pins
    Then CI workflow verification shall accept each generated exact host pin

  Scenario: Maximum safe version components remain valid exact pins
    When CI workflow verification is run against maximum safe OpenCode host components
    Then CI workflow verification shall accept each generated exact host pin
