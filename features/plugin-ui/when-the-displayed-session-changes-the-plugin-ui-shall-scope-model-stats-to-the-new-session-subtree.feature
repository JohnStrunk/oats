@ears:event-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: When the displayed session changes, the plugin UI shall scope Model stats to the new session subtree

  Scenario: New model totals replace the previous session's rows
    Given the Agent stats host fixture "model switch"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model     | cost |
      | old-model | 1    |
    When the user switches the Agent stats session to "new-root"
    Then the sidebar model rows shall be:
      | model     | cost |
      | new-model | 5    |
