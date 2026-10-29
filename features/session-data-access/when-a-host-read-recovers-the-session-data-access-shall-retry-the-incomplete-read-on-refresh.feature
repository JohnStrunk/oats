@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When a host read recovers, the session data access shall retry the incomplete read on refresh

  Scenario Outline: A later refresh recovers missing history
    Given a session host with known records and controlled read limits
    When the host has a <fault> during refresh
    And the host read recovers and session data is refreshed
    Then the recovered snapshot shall include newly available history without the read failure

    Examples:
      | fault                 |
      | endless message pages |
      | endless child pages   |
      | stalled session log   |
      | endless session log   |
