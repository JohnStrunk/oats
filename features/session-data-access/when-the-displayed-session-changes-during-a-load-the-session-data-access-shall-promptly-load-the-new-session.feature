@ears:event-driven @component:session-data-access @interface:opencode-session-data @interface:opencode-tui @refresh-coalescing
Feature: When the displayed session changes during a load, the session data access shall promptly load the new session

  Scenario: A blocked old session does not delay or overwrite the new session
    Given a controlled traversal host for refresh coalescing
    When the route changes while the old session traversal is blocked
    Then the new session shall load before the old read is released and remain displayed afterwards
