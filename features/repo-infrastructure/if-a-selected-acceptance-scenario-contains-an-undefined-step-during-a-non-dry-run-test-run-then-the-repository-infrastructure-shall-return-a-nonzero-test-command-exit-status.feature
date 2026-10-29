@ears:unwanted-behavior
@component:repo-infrastructure
@interface:cli
Feature: If a selected acceptance scenario contains an undefined step during a non-dry-run test run, then the repository infrastructure shall return a nonzero test-command exit status

  As a repository maintainer
  I want undefined steps in selected scenarios to fail the test command
  So that missing verification cannot be mistaken for a successful run

  Scenario: An undefined step fails the test command
    Given an isolated feature with an undefined step
    When the contributor runs the isolated feature suite
    Then the runner shall report the step as undefined
    And the test command shall return a nonzero exit status
