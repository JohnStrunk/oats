@ears:event-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-48
Feature: When the user toggles either sidebar summary section, the plugin UI shall change only that section's expansion state

  Scenario Outline: Toggling Model stats leaves Agent stats unchanged
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    And the user toggles Model stats using <input>
    Then the Model stats heading shall display the "▶" indicator
    And the sidebar shall hide model "fixture-model"
    And the Agent stats heading shall display the "▼" indicator
    When the user toggles Model stats using <input>
    Then the Model stats heading shall display the "▼" indicator
    And the sidebar shall show model "fixture-model" with reported cost 13
    And the Agent stats heading shall display the "▼" indicator

    Examples:
      | input    |
      | mouse    |
      | keyboard |

  Scenario: Toggling Agent stats leaves Model stats unchanged
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    And the user toggles Agent stats using keyboard
    Then the Agent stats heading shall display the "▶" indicator
    And the Model stats heading shall display the "▼" indicator
