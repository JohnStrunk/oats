@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-focused-regressions
Feature: When a successful parent listing excludes a previous child, the session data access shall exclude that child's records

  Scenario: An unrelated branch listing failure does not restore a removed sibling
    Given the session data host fixture "tree with paginated history"
    When a confirmed sibling is removed and the retained child's listing fails
    Then the removed sibling shall stay excluded while the uncertain retained branch remains
