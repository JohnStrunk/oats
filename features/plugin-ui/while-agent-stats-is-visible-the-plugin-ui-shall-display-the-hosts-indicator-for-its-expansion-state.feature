@ears:state-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-34
Feature: While Agent stats is visible, the plugin UI shall display the host's indicator for its expansion state

  The supported OpenCode host uses ▼ for expanded and ▶ for collapsed.

  Scenario Outline: Both input methods preserve the host indicator convention
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the Agent stats heading shall display the "▼" indicator
    When the user toggles Agent stats using <input>
    Then the Agent stats heading shall display the "▶" indicator
    And the sidebar shall hide agent "alpha"
    When the user toggles Agent stats using <input>
    Then the Agent stats heading shall display the "▼" indicator
    And the sidebar shall show agent "alpha" with reported cost 1

    Examples:
      | input    |
      | mouse    |
      | keyboard |
