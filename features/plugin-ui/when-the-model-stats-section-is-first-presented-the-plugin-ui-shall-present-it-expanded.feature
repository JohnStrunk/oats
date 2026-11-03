@ears:event-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-48
Feature: When the Model stats section is first presented, the plugin UI shall present it expanded

  Scenario: Model stats starts expanded alongside Agent stats
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the Model stats heading shall display the "▼" indicator
    And the Agent stats heading shall display the "▼" indicator

  Scenario: A new plugin run starts with Model stats expanded
    Given the Agent stats host fixture "switch"
    When the Agent stats session is displayed
    And the user toggles Model stats using keyboard
    And the Agent stats app is restarted
    Then the Model stats heading shall display the "▼" indicator
