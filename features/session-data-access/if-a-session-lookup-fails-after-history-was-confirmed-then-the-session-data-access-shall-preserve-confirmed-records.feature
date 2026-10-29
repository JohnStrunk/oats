@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If a session lookup fails after history was confirmed, then the session data access shall preserve confirmed records

  Scenario: Previously confirmed history and witnessed live usage survive a later lookup failure
    Given an isolated non-fork session with a controllable lookup
    When confirmed history and live usage are followed by a failed session lookup
    Then the confirmed records shall survive the failed lookup with an explicit incomplete indication
