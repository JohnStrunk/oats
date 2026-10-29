@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If recorded identity or usage is missing, then the session data access shall expose the gap without inventing a value

  Scenario: An incomplete assistant record remains available alongside a complete one
    Given the session data host fixture "missing and zero"
    When session data is refreshed
    Then the session data outcome shall match "missing and zero"

  Scenario: A failed live compaction reports cost but omits tokens
    Given an isolated regression session host
    When a failed compaction reports cost without tokens
    Then the failed compaction shall retain its known cost and indicate the usage gap
