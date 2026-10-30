@ears:event-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: When settled usage changes the displayed session's summary, the plugin UI shall update the Agent stats display

  Scenario: A settled update becomes visible
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    And reported usage of 4 settles for agent "alpha"
    Then the sidebar shall show agent "alpha" with reported cost 5

  Scenario: A settled update while collapsed is visible on reopening
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    And the user toggles Agent stats using keyboard
    And reported usage of 4 settles for agent "alpha"
    And the user toggles Agent stats using keyboard
    Then the sidebar shall show agent "alpha" with reported cost 5
