@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While session history is loading, the plugin UI shall distinguish loading from empty history in Model stats

  Scenario: A blocked first read is shown as loading
    Given the Agent stats host fixture "blocked history"
    When the Agent stats session is displayed
    Then the sidebar shall identify Model stats history as "loading" rather than empty
