@ears:event-driven
@component:repo-infrastructure
@interface:cli
Feature: When a contributor selects a component tag for a feature-suite run, the repository infrastructure shall execute only scenarios matching that tag

  As a repository contributor
  I want to run a component's scenarios independently
  So that targeted verification excludes unrelated components

  Scenario: Select the plugin UI scenarios
    Given the repository contains the existing acceptance scenarios
    When the contributor requests a dry run for the plugin UI component
    Then the runner shall select all existing plugin UI scenarios and no other component's scenarios

  Scenario: Select the repository infrastructure scenarios
    Given the repository contains the existing acceptance scenarios
    When the contributor requests a dry run for the repository infrastructure component
    Then the runner shall select all existing repository infrastructure scenarios and no other component's scenarios

  Scenario: Tag selection executes the plugin UI component
    Given a sandbox containing scenarios for both components
    When the contributor runs the sandbox feature suite for the plugin UI component
    Then the runner shall execute only the plugin UI sandbox scenario

  Scenario: Tag selection executes the repository infrastructure component
    Given a sandbox containing scenarios for both components
    When the contributor runs the sandbox feature suite for the repository infrastructure component
    Then the runner shall execute only the repository infrastructure sandbox scenario

  Scenario: An undefined step in an unselected scenario does not affect the run
    Given an isolated feature with an undefined step
    When the contributor runs the isolated feature suite for the plugin UI component
    Then the runner shall execute only the plugin UI sandbox scenario
    And the test command shall return a zero exit status

  Scenario: Select the session data access scenarios
    Given the repository contains the existing acceptance scenarios
    When the contributor requests a dry run for the session data access component
    Then the runner shall select all existing session data access scenarios and no other component's scenarios
