@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: If a Model stats reported-cost total is unknown, then the plugin UI shall display unavailable instead of zero

  Scenario: Unknown, incomplete and known-zero model totals have distinct values
    Given the Agent stats host fixture "model incomplete"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model         | cost        |
      | zero-model    | $0.00       |
      | partial-model | $2.00       |
      | unknown-model | unavailable |
      | Unattributed  | $3.00       |
