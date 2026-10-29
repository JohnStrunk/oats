@ears:event-driven
@component:repo-infrastructure
@interface:renovate
Feature: When a pull request modifies GitHub Actions workflows, the Renovate configuration shall enable automatic rebasing when behind the base branch

  As a repository maintainer
  I want Renovate PRs that update workflow files to be automatically rebased when the base branch changes
  So that GitHub Actions workflow permission conflicts and stale check runs are prevented

  Scenario: Workflow file updates are automatically rebased when behind base branch
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then a package rule shall match workflow file paths
    And the workflow package rule shall specify rebaseWhen as "behind-base-branch"
