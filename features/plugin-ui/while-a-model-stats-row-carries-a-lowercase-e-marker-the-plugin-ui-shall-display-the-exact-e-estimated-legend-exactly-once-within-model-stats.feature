@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While a Model stats row carries a lowercase e marker, the plugin UI shall display the exact "e = estimated" legend exactly once within Model stats

  The legend belongs to its own summary and does not replace or satisfy the
  Agent stats legend.

  Scenario: Incomplete model rows have one legend in each affected summary
    Given the Agent stats host fixture "model incomplete"
    When the Agent stats session is displayed
    Then the Model stats e legend shall appear exactly once
    And the Agent stats e legend shall appear exactly once
