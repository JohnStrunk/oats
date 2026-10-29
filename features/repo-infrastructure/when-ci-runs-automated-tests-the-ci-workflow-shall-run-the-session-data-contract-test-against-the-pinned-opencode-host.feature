@ears:event-driven
@component:repo-infrastructure
@interface:github-actions
@interface:cli
Feature: When CI runs automated tests, the CI workflow shall run the session data contract test against the pinned OpenCode host

  Scenario: CI installs and explicitly selects the pinned host before the contract test
    When the repository CI workflow is inspected
    Then the CI test job shall run the real-host contract test with the installed pinned host
