@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-consecutive-regressions
Feature: When a capped child is later proven removed, the session data access shall exclude its records

  Scenario: A complete parent listing disproves a child retained through an earlier traversal cap
    Given a session tree with a four-node traversal limit
    When consecutive incomplete refreshes first cap and then disprove a known child
    Then the disproved child shall be excluded while the uncertain branch remains
