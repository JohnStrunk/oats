@ears:ubiquitous
@component:repo-infrastructure
@interface:mergify
Feature: The Mergify configuration shall enforce serialized single pull request batching and merge commits

  As a repository maintainer
  I want each pull request tested and merged individually using merge commits
  So that multi-PR draft speculative merge batches are avoided and git history remains clear

  Scenario: Single batch size and merge commit method are configured
    Given the repository contains a Mergify configuration file
    When the Mergify configuration is evaluated
    Then the default queue rule shall specify a batch_size of 1
    And the default queue rule shall specify merge_method as "merge"
