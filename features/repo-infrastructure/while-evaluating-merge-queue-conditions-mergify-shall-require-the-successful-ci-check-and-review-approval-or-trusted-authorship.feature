@ears:state-driven
@component:repo-infrastructure
@interface:mergify
Feature: While evaluating merge queue conditions, Mergify shall require the Successful CI check and review approval or trusted authorship

  As a repository maintainer
  I want merge queue entries to satisfy CI passing checks, approval, and label policies
  So that untested, unapproved, or blocked pull requests are prevented from merging

  Scenario: Queue conditions require CI check success
    Given the repository contains a Mergify configuration file
    When the Mergify configuration is evaluated
    Then the default queue rule shall require check-success for "Successful CI"

  Scenario: Queue conditions require review approval or trusted author
    Given the repository contains a Mergify configuration file
    When the Mergify configuration is evaluated
    Then the default queue rule shall allow trusted authors or approved reviews

  Scenario: Queue conditions block on change requests or do-not-merge label
    Given the repository contains a Mergify configuration file
    When the Mergify configuration is evaluated
    Then the default queue rule shall require zero change requests
    And the default queue rule shall require absence of the "do-not-merge" label
