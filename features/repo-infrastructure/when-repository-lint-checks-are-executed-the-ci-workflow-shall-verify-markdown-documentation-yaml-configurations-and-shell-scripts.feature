@ears:event-driven
@component:repo-infrastructure
@interface:github-actions
@interface:cli
Feature: When repository lint checks are executed, the CI workflow shall verify markdown documentation, yaml configurations, and shell scripts

  As a repository contributor
  I want automated linting for markdown documentation, yaml files, and shell scripts
  So that repository files conform to consistent syntax, formatting, and action standards

  Background:
    Given the repository working tree contains source files and documentation

  Scenario: Markdown documentation linting
    Given the repository contains markdown documentation files
    When the CI workflow executes the markdown linter
    Then markdown documentation files shall conform to markdown linting standards

  Scenario: YAML and workflow linting
    Given the repository contains YAML files and GitHub Actions workflow definitions
    When the CI workflow executes the YAML and workflow linter
    Then all workflow and configuration files shall conform to actionlint and yamllint standards

  Scenario: Shell script linting
    Given the repository contains executable shell scripts
    When the CI workflow executes the shell script linter
    Then all shell scripts shall conform to shellcheck standards
