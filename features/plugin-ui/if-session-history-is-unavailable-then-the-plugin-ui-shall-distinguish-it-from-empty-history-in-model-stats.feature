@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: If session history is unavailable, then the plugin UI shall distinguish it from empty history in Model stats

  Scenario: A failed first read is not presented as confirmed empty
    Given the Agent stats host fixture "unavailable history"
    When the Agent stats session is displayed
    Then the sidebar shall identify Model stats history as "unavailable" rather than empty
