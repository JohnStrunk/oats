@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: While Agent stats is expanded, the plugin UI shall show one row per recorded agent name in the displayed session subtree

  Scenario: Repeated names, nested delegation and unrelated sessions
    Given the Agent stats host fixture "repeated nested history"
    When the Agent stats session is displayed
    Then the sidebar agent rows shall be:
      | agent      | cost |
      | alpha      | 8    |
      | beta       | 2    |
      | worker-two | 3    |
