@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: While an agent row is visible, the plugin UI shall show its known total reported cost

  Scenario: History is shown when the session opens
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "alpha" with reported cost 1
