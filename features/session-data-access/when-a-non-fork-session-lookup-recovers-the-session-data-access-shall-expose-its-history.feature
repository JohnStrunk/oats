@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When a non-fork session lookup recovers, the session data access shall expose its history

  Scenario: Initially unproven root history becomes visible after lookup recovery
    Given an isolated non-fork session with a controllable lookup
    When the initial session lookup fails and a later lookup succeeds
    Then the non-fork history shall be withheld initially and exposed after recovery
