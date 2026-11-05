@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall left-justify each agent and model identity and right-justify its reported cost

  Scenario: Each pair heading uses its padded left and right edges
    Given the usage details host fixture "providers"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair heading shall align its identity left and reported cost right

  Scenario: A trailing incomplete marker stays in the right-justified cost field
    Given the usage details host fixture "partial reported cost"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair heading shall align its identity left and reported cost right

  Scenario: A negative reported cost stays right-justified
    Given the usage details host fixture "negative reported cost"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair heading shall align its identity left and reported cost right

  Scenario: An unavailable reported cost stays right-justified
    Given the usage details host fixture "unknown"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show an unavailable reported-cost heading
    And each usage details pair heading shall align its identity left and reported cost right
