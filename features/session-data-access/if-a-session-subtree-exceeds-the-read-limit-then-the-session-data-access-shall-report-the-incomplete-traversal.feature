@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data @issue-4-followup-boundaries
Feature: If a session subtree exceeds the read limit, then the session data access shall report the incomplete traversal

  Scenario: An unbounded single-child chain preserves previously known records
    Given a session tree host with confirmed prior records
    When the host supplies an unbounded single-child chain with a small subtree limit
    Then the bounded chain refresh shall retain prior records and report an incomplete traversal
