@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While the plugin is running, the plugin UI shall retain the user's Model stats expansion choice across session changes

  Scenario: A collapsed Model stats section stays collapsed after a session change and resets on restart
    Given the Agent stats host fixture "model switch"
    When the Agent stats session is displayed
    And the user toggles Model stats using keyboard
    Then the Model stats heading shall display the "▶" indicator
    And the sidebar shall hide model "old-model"
    When the user switches the Agent stats session to "new-root"
    Then the Model stats heading shall display the "▶" indicator
    And the Agent stats heading shall display the "▼" indicator
    And the sidebar shall hide model "new-model"
    When the user toggles Model stats using keyboard
    Then the sidebar shall show model "new-model" with reported cost 5
    When the user toggles Model stats using keyboard
    And the Agent stats app is restarted
    Then the Model stats heading shall display the "▼" indicator
    And the sidebar model rows shall be:
      | model      | cost |
      | new-model  | 5    |
