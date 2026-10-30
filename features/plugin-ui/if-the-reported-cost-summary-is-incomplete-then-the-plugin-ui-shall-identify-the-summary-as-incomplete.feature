@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: If the reported cost summary is incomplete, then the plugin UI shall identify the summary as incomplete

  Scenario: A partial failure preserves known costs and indicates the gap
    Given the Agent stats host fixture "partial failure"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "alpha" with reported cost 1
    And the sidebar shall identify the overall summary as incomplete
