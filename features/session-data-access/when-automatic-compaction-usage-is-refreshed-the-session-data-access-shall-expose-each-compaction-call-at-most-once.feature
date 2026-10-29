@ears:event-driven @component:session-data-access @interface:opencode-session-data @regression-auto-compaction
Feature: When automatic compaction usage is refreshed, the session data access shall expose each compaction call at most once

  Scenario: A live automatic compaction is also present in message history
    Given an isolated regression session host
    When automatic compaction is refreshed with "no" persisted constituent calls
    Then the automatic compaction without a persisted call log shall appear once

  Scenario: A complete ordered log supplies the compaction's constituent calls
    Given an isolated regression session host
    When automatic compaction is refreshed with "complete" persisted constituent calls
    Then only the matching automatic compaction summary shall be replaced by its constituent calls
