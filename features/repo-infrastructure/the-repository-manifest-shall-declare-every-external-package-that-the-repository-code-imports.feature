@ears:ubiquitous
@component:repo-infrastructure
@interface:renovate
@interface:cli
Feature: The repository manifest shall declare every external package that the repository code imports

  As a repository maintainer
  I want every imported external package declared in the root manifest
  So that imports do not silently depend on packages hoisted from transitive dependencies

  # The scan matches import syntax positions in the repository's own
  # JavaScript sources; it is not a module-resolution or type-checking run.
  # A lock file update that restructures node_modules cannot be observed
  # here, which is why the declarations themselves are checked.
  Scenario: Every imported external package is declared in the repository manifest
    Given the repository manifest is loaded
    When the repository JavaScript sources are scanned for package imports
    Then every imported external package shall be declared in the repository manifest

  Scenario: The declaration checks detect regressions
    Given the repository manifest is loaded
    When the repository JavaScript sources are scanned for package imports
    Then the manifest declaration checks shall reject negative controls
