@ears:unwanted-behavior
@component:repo-infrastructure
@interface:github-actions
Feature: If a configured test or lint check job is skipped, then the CI workflow shall report a failure conclusion for the Successful CI job

  Scenario: A prerequisite lint job is skipped
    Given a configured lint check job completes with conclusion "skipped"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the CI workflow shall execute the "Successful CI" job
    And the "Successful CI" job conclusion shall be "failure"
