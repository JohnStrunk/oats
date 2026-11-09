@ears:ubiquitous
@component:repo-infrastructure
@interface:renovate
Feature: The repository manifest shall pin the declared OpenCode client to the exact version of the OpenCode plugin dependency

  As a repository maintainer
  I want the OpenCode client declared at the same exact version as the plugin
  So that the client API the tests exercise matches the plugin line the repository pins

  Scenario: The manifest pins the OpenCode client to the exact plugin version
    Given the repository manifest is loaded
    Then the manifest shall pin the OpenCode client to the exact version of the OpenCode plugin dependency

  Scenario: The pin checks detect regressions
    Given the repository manifest is loaded
    Then the OpenCode client pin checks shall reject negative controls
