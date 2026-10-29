@ears:ubiquitous @component:session-data-access @interface:opencode-session-data
Feature: The session data access shall not expose raw conversation content

  Scenario: User and assistant text are not part of usage records
    Given the session data host fixture "private data"
    When session data is refreshed
    Then the snapshot shall not contain raw conversation content
