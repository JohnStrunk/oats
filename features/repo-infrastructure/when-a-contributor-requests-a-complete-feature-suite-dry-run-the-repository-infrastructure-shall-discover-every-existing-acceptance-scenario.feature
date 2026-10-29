@ears:event-driven
@component:repo-infrastructure
@interface:cli
Feature: When a contributor requests a complete feature-suite dry run, the repository infrastructure shall discover every existing acceptance scenario

  As a repository contributor
  I want the migrated suite to retain the existing scenarios
  So that changing test runners does not silently remove verification

  Scenario: Existing features are discovered
    Given the repository contains the existing acceptance scenarios
    When the contributor requests a dry run of the complete feature suite
    Then the runner shall discover every existing acceptance scenario including every example
