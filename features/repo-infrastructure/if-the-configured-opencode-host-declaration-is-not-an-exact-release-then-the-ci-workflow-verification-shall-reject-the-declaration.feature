@ears:unwanted-behavior
@component:repo-infrastructure
@interface:cli
@interface:github-actions
@interface:renovate
Feature: If the configured OpenCode host declaration is not an exact release, then the CI workflow verification shall reject the declaration

  Scenario: The host declaration remains an exact pin
    When CI workflow verification is run against non-exact OpenCode host declarations
    Then CI workflow verification shall reject each non-exact host declaration
