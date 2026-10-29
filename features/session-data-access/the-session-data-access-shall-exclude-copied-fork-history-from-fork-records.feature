@ears:ubiquitous @component:session-data-access @interface:opencode-session-data
Feature: The session data access shall exclude copied fork history from fork records

  Scenario Outline: Fork copies have new identifiers and an ambiguous historical record follows them
    Given the session data host fixture "<fork>"
    When session data is refreshed
    Then only provably owned fork descendant history shall be exposed

    Examples:
      | fork         |
      | fork before  |
      | fork through |

  Scenario: A new live attempt in a fork remains visible despite ambiguous copied history
    Given the session data host fixture "fork through"
    When a new live attempt settles in the fork
    Then the proven live fork record and descendant history shall remain visible
