@ears:ubiquitous @component:session-data-access @interface:opencode-session-data
Feature: The session data access shall expose each underlying record at most once

  Scenario: Repeated settlement notifications do not duplicate the record
    Given the session data host fixture "live settlement"
    When the host reports settled usage twice
    Then the session data outcome shall match "live settlement"
