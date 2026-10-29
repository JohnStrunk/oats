@ears:ubiquitous @component:session-data-access @interface:opencode-session-data
Feature: The session data access shall retain recorded execution identities and reported usage values

  Scenario: Historical records use their own agent and model instead of current session selections
    Given the session data host fixture "recorded identities"
    When session data is refreshed
    Then the session data outcome shall match "recorded identities"

  Scenario: Reported zero cost is distinct from absent cost
    Given the session data host fixture "missing and zero"
    When session data is refreshed
    Then the session data outcome shall match "missing and zero"
