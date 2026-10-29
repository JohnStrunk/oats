@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-consecutive-regressions
Feature: When a persisted call follows a live compaction, the session data access shall preserve the distinct call

  Scenario: A projection without a completion time does not extend the live window indefinitely
    Given an isolated regression session host
    When a live summary and its projection are refreshed with overlapping and later persisted calls
    Then the later call shall remain distinct and the overlapping call shall be reported as uncertain
