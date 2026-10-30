@ears:event-driven
@component:repo-infrastructure
@interface:github-actions
@interface:cli
Feature: When CI runs automated tests, the CI workflow shall run the session data contract test against the pinned OpenCode host

  Scenario: CI sets up the synchronized Node release and selects the pinned host before the contract test
    # The contract check recognizes the implicit shell or literal bash/sh, not arbitrary shell templates, even valid ones.
    When the repository CI workflow is inspected
    And the repository Node version declarations are inspected
    Then the CI test job shall run the real-host contract test with the installed pinned host
