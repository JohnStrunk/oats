@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If a host read is incomplete, then the session data access shall retain previously known records

  Scenario Outline: Known records survive stalled or unending reads
    Given a session host with known records and controlled read limits
    When the host has a <fault> during refresh
    Then the prior root and descendant records shall remain available after the incomplete read

    Examples:
      | fault                 |
      | endless message pages |
      | endless child pages   |
      | stalled session log   |
      | endless session log   |
