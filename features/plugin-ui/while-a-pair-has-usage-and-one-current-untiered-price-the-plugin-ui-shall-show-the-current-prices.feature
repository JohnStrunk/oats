@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @details-issue-35
Feature: While a pair has usage and one current untiered price, the plugin UI shall show the current prices

  Scenario: Four current prices are displayed per million tokens
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table shall show the known current prices
