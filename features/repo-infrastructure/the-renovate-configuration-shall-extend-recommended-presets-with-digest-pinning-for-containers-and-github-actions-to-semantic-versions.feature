@ears:ubiquitous
@component:repo-infrastructure
@interface:renovate
Feature: The Renovate configuration shall extend recommended presets with digest pinning for containers and GitHub Actions to semantic versions

  As a repository maintainer
  I want Renovate to use recommended defaults and pin immutable digests for containers and GitHub Actions to semantic versions
  So that dependency updates follow best practices and workflow steps are secured against upstream tag tampering

  Scenario: Recommended presets and digest pinning are configured
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the configuration shall extend "config:recommended"
    And the configuration shall extend container digest pinning
    And the configuration shall extend GitHub Actions digest pinning to semantic versions
