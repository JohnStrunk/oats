@ears:unwanted-behavior
@component:repo-infrastructure
@interface:github-actions
Feature: If any configured test or lint check job fails or is cancelled, then the CI workflow shall report a failure conclusion for the Successful CI job

  As a repository maintainer
  I want the "Successful CI" job to report failure if any prerequisite test or lint job fails or aborts
  So that pull requests with failing checks are prevented from merging

  Scenario: A test job fails
    Given a configured test job completes with conclusion "failure"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the CI workflow shall execute the "Successful CI" job
    And the "Successful CI" job conclusion shall be "failure"

  Scenario: A lint check job fails
    Given a configured lint check job completes with conclusion "failure"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the CI workflow shall execute the "Successful CI" job
    And the "Successful CI" job conclusion shall be "failure"

  Scenario: A prerequisite job is cancelled
    Given a configured test or lint job completes with conclusion "cancelled"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the CI workflow shall execute the "Successful CI" job
    And the "Successful CI" job conclusion shall be "failure"
