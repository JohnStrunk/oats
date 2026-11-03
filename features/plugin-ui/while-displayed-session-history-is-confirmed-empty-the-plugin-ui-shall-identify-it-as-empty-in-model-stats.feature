@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While displayed session history is confirmed empty, the plugin UI shall identify it as empty in Model stats

  Scenario: A successful empty history read is not presented as loading or unavailable
    Given the Agent stats host fixture "empty history"
    When the Agent stats session is displayed
    Then the sidebar shall identify Model stats history as "empty" rather than loading
