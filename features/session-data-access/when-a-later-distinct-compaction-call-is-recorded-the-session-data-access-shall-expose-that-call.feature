@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-focused-regressions
Feature: When a later distinct compaction call is recorded, the session data access shall expose that call

  Scenario: A call after a completed logged compaction is not part of its summary
    Given an independent follow-up session host
    And a persisted multi-call compaction and its completed summary
    When the completed compaction is initially refreshed
    Then the initial compaction snapshot shall contain the two individual calls without their aggregate
    When a later unframed compaction call is recorded in the same session
    Then the later compaction call shall remain distinct from the completed compaction
