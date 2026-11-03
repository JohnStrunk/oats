@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34 @sidebar-issue-47
Feature: While no Agent stats cost row has a lowercase e marker, the plugin UI shall omit the "e = estimated" legend

  Scenario Outline: Complete, unavailable and empty states have no estimate legend
    Given the Agent stats host fixture "<fixture>"
    When the Agent stats session is displayed
    Then the sidebar shall not show an e legend

    Examples:
      | fixture          |
      | aligned complete |
      | aligned unknown  |
      | blocked history |
      | empty history    |
      | unavailable history |
