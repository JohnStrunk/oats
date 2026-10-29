@ears:ubiquitous
@component:repo-infrastructure
@interface:renovate
Feature: The Renovate configuration shall enforce a ten-day cooldown for standard packages and a weekly schedule for docker images

  As a repository maintainer
  I want a ten-day cooldown before adopting standard dependency updates with a schedule-based alternative for docker images
  So that untested or faulty upstream releases have time to be recalled before pull requests are created

  Scenario: Default minimum release age is ten days
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the global minimum release age shall be "10 days"

  Scenario: Docker images use a weekly schedule in lieu of release age timestamps
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then a package rule shall match the "docker" category
    And the docker package rule shall nullify the minimum release age
    And the docker package rule shall specify a weekly schedule
