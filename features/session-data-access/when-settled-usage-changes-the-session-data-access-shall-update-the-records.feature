@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When settled usage changes, the session data access shall update the records

  Scenario: A repeated settlement notification updates the existing record once
    Given the session data host fixture "live settlement"
    When the host reports settled usage twice
    Then the session data outcome shall match "live settlement"
