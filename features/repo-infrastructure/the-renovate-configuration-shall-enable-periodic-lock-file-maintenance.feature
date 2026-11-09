@ears:ubiquitous
@component:repo-infrastructure
@interface:renovate
Feature: The Renovate configuration shall enable periodic lock file maintenance

  As a repository maintainer
  I want Renovate to refresh the lock file periodically
  So that transitive dependency resolution stays reproducible without unrelated version changes

  Scenario: Lock file maintenance is enabled with a valid schedule
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the Renovate configuration shall enable lock file maintenance with a valid schedule

  Scenario: The configuration checks detect regressions
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the lock file maintenance configuration checks shall reject negative controls
