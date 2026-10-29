@ears:event-driven
@component:repo-infrastructure
@interface:cli
Feature: When a contributor runs the default complete feature suite, the repository infrastructure shall execute all discovered acceptance scenarios

  As a repository contributor
  I want the default run to execute the discovered scenarios
  So that verification does not silently skip a component

  Scenario: The default configuration executes scenarios from both components
    Given a sandbox containing scenarios for both components
    When the contributor runs the sandbox feature suite with the default configuration
    Then the runner shall execute the scenarios for both components
