@ears:event-driven
@component:repo-infrastructure
@interface:renovate
@interface:github-actions
Feature: When eligible Node updates are available, the Renovate configuration shall group only the nvm and CI Node updates together

  As a repository maintainer
  I want the Node versions in .nvmrc and CI to be updated together
  So that compatible updates can be reviewed together without unrelated dependencies

  # These checks inspect the repository configuration, not a live Renovate run.
  # The nvm and GitHub Actions datasources can make updates eligible at different
  # times; grouping cannot wait for both. Inherited presets and actual PR creation
  # require verification against Renovate and its external services.
  Scenario: The grouping configuration covers Node declarations but excludes unrelated updates including a Node Docker action image
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    And the repository Node version declarations are inspected
    Then the Node grouping rule shall cover the nvm and CI Node dependencies without unrelated dependencies
    And the Node grouping rule shall disable separate major and minor branches

  Scenario: The configuration checks detect regressions
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the Node grouping configuration checks shall reject negative controls
