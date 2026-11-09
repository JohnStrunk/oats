@ears:state-driven
@component:repo-infrastructure
@interface:renovate
Feature: While the pinned OpenCode plugin line accepts only OpenTUI 0.7.x peers, the Renovate configuration shall cap OpenTUI package updates to the 0.7.x line

  As a repository maintainer
  I want OpenTUI updates capped to the peer-compatible line
  So that proposed dependency updates remain npm-resolvable while the pinned plugin line accepts only OpenTUI 0.7.x peers

  # This step verifies only the configured cap. Whether an upstream @opentui
  # release exists, and whether the pinned plugin line accepts other OpenTUI
  # peers, cannot be verified here; the cap must be revisited when the plugin
  # pin changes.
  Scenario: The version cap restricts only the OpenTUI packages to the 0.7.x line
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the OpenTUI version cap shall restrict only the OpenTUI packages to the 0.7.x line

  Scenario: The configuration checks detect regressions
    Given the repository contains a Renovate configuration file
    When the Renovate configuration is evaluated
    Then the OpenTUI version cap configuration checks shall reject negative controls
