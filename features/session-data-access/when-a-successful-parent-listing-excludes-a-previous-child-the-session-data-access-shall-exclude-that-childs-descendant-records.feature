@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-capped-descendant-regression
Feature: When a successful parent listing excludes a previous child, the session data access shall exclude that child's descendant records

  Scenario: A capped grandchild is excluded when its ancestor is later removed despite another branch failing
    Given a session tree with a four-node traversal limit
    When a capped grandchild's ancestor is removed and another branch listing fails
    Then the removed ancestor's grandchild shall be excluded from the root snapshot
