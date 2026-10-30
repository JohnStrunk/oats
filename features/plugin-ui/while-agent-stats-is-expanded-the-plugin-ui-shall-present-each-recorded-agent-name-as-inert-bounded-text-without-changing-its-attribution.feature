@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6 @sidebar-name-safety
Feature: While Agent stats is expanded, the plugin UI shall present each recorded agent name as inert bounded text without changing its attribution

  A name is untrusted. Its presentation must not execute terminal controls,
  introduce a separate displayed row, or hide its own reported cost. Names
  are bounded to the available sidebar row; long names do not add rows.
  Grouping uses the original recorded names, not their displayed forms.

  Scenario Outline: Hostile and generated agent names cannot control or spoof the sidebar
    When the sidebar displays recorded agent names from the "<family>" safety cases
    Then every name shall remain inert and bounded with its original attribution

    Examples:
      | family    |
      | controls  |
      | bidi      |
      | long      |
      | generated |
