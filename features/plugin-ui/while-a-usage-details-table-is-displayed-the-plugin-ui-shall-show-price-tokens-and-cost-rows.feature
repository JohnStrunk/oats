@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-35
Feature: While a usage details table is displayed, the plugin UI shall show Price Tokens and Cost rows

  Scenario: All rows appear in the requested order
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table shall show Price Tokens and Cost rows in order
