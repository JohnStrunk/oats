@ears:event-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: When the user toggles the Agent stats section, the plugin UI shall change its expansion state

  Scenario Outline: Either input method collapses and expands the section
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    And the user toggles Agent stats using <input>
    Then the sidebar shall hide agent "alpha"
    When the user toggles Agent stats using <input>
    Then the sidebar shall show agent "alpha" with reported cost 1

    Examples:
      | input    |
      | mouse    |
      | keyboard |
