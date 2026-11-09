@ears:event-driven
@component:repo-infrastructure
@interface:renovate
Feature: When eligible OpenCode stack updates are available, the Renovate configuration shall group the OpenCode and OpenTUI package updates together

  As a repository maintainer
  I want OpenCode and OpenTUI package updates proposed in one pull request
  So that the version-coupled plugin, host, and TUI packages move together and the family stays resolvable

  # These checks inspect the repository configuration, not a live Renovate
  # run. The @opencode/plugin peer pins, the @opentui/solid dependency on the
  # same @opentui/core version, and npm resolution make the family
  # version-coupled; whether updates are currently eligible depends on
  # upstream releases and requires verification against Renovate and its
  # external services.
  Scenario: The grouping configuration covers the OpenCode and OpenTUI packages without unrelated dependencies
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the OpenCode stack grouping rule shall cover the OpenCode and OpenTUI packages without unrelated dependencies
    And the OpenCode stack grouping rule shall disable separate major and minor branches

  Scenario: The configuration checks detect regressions
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the OpenCode stack grouping configuration checks shall reject negative controls
