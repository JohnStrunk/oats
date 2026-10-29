@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-followup-boundaries
Feature: When a retry projection is refreshed before settlement, the session data access shall preserve prior attribution

  Scenario: The retry projection changes identity while still carrying prior usage
    Given an isolated regression session host
    When a retry starts after known historical usage
    And the running retry projection is refreshed before its terminal event
    Then the earlier attempt shall keep its original attribution after the running retry refresh
