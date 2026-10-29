@ears:ubiquitous
@component:repo-infrastructure
@interface:github-actions
Feature: The CI workflow shall reference all GitHub Actions using full semantic versions

  As a repository maintainer
  I want GitHub Actions in workflow definitions to be specified with full semantic versions
  So that workflow execution is immutable, reproducible, and protected against unexpected breaking changes from upstream major tag shifts

  Scenario: All workflow step actions specify full semantic versions
    Given the repository contains YAML files and GitHub Actions workflow definitions
    When the CI workflow step actions are inspected
    Then all referenced GitHub Actions shall specify full semantic versions
