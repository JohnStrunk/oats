@ears:ubiquitous
@component:repo-infrastructure
@interface:github-actions
@interface:cli
Feature: The repository infrastructure shall specify the same exact Node version for CI and nvm

  As a repository maintainer
  I want CI and local development to use the same exact Node release
  So that automated checks run against the intended Node release

  Scenario: CI and nvm use the same exact Node release
    When the repository Node version declarations are inspected
    Then every CI Node version shall specify the exact nvm release

  Scenario: The version alignment check detects mismatches and non-exact versions
    Then the Node version alignment check shall reject negative controls
