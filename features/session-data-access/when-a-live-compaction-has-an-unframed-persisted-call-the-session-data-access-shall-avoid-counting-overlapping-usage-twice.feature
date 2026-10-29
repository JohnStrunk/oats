@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-followup-boundaries
Feature: When a live compaction has an unframed persisted call, the session data access shall avoid counting overlapping usage twice

  Scenario: A live summary, its historical projection, and an unframed persisted call overlap
    Given an isolated regression session host
    When a live compaction summary is refreshed with its projection and an unframed persisted call
    Then the overlapping compaction usage shall not be separately countable
