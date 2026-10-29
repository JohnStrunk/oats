@ears:unwanted-behavior
@component:repo-infrastructure
@interface:cli
Feature: If an executed acceptance scenario fails, then the repository infrastructure shall return a nonzero test-command exit status

  As a repository maintainer
  I want failing scenarios to fail the test command
  So that verification cannot report success for broken behavior

  Scenario: A failing assertion fails the test command
    Given an isolated feature with a failing scenario
    When the contributor runs the isolated feature suite
    Then the runner shall report the scenario as failed
    And the test command shall return a nonzero exit status
