@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: If session history is unavailable, then the plugin UI shall distinguish unavailability from empty history

  Scenario: A failed first read is not presented as empty
    Given the Agent stats host fixture "unavailable history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as unavailable rather than empty
