@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When incomplete session data is refreshed, the session data access shall retry loading the missing data

  Scenario: A failed descendant history is available on the next refresh
    Given the session data host fixture "partial failure"
    When a descendant history fails and then succeeds on refresh
    Then the session data outcome shall match "recovered"
