@ears:event-driven
@component:repo-infrastructure
@interface:mergify
Feature: When a pull request is created or updated, the Mergify configuration shall enqueue the pull request into the default merge queue

  As a repository maintainer
  I want all pull requests automatically routed to the default merge queue
  So that merges are sequenced and validated deterministically

  Scenario: Pull request rules configure default queue action
    Given the repository contains a Mergify configuration file
    When the Mergify configuration is evaluated
    Then a pull request rule named "default" shall specify the "queue" action
