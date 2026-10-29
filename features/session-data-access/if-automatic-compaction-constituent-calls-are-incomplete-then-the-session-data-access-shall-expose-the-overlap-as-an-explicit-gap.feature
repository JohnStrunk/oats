@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data @regression-auto-compaction
Feature: If automatic compaction constituent calls are incomplete, then the session data access shall expose the overlap as an explicit gap

  Scenario: A partial ordered log does not account for the full summary
    Given an isolated regression session host
    When automatic compaction is refreshed with "partial" persisted constituent calls
    Then the partial compaction overlap shall be reported without countable duplicates
