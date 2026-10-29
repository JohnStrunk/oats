@ears:event-driven
@component:repo-infrastructure
@interface:github-actions
Feature: When all configured test and lint check jobs complete successfully, the CI workflow shall report a successful conclusion for the Successful CI job

  As a repository maintainer
  I want a single aggregate status check named "Successful CI" to succeed when all prerequisite jobs pass
  So that branch protection rules can enforce a single merge gate without tracking individual matrix jobs

  Scenario: All prerequisite test and lint jobs complete successfully
    Given all configured automated test jobs have completed with conclusion "success"
    And all configured lint check jobs have completed with conclusion "success"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the CI workflow shall execute the "Successful CI" job
    And the "Successful CI" job conclusion shall be "success"

  Scenario Outline: Invariant aggregate success across varying job combinations
    Given <test_job_count> test jobs have completed with conclusion "success"
    And <lint_job_count> lint jobs have completed with conclusion "success"
    When the CI workflow evaluates the aggregate prerequisite status
    Then the "Successful CI" job conclusion shall be "success"

    Examples:
      | test_job_count | lint_job_count |
      | 1              | 1              |
      | 2              | 3              |
      | 5              | 1              |
