@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When usage settles during initial history loading, the session data access shall retain the settled record

  Scenario: A stale history response arrives after the live settlement
    When usage settles while the initial history response is blocked
    Then the settled record shall survive the stale response
