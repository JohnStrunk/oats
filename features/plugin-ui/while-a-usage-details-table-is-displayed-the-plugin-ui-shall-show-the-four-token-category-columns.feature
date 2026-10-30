@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-35
Feature: While a usage details table is displayed, the plugin UI shall show the four token category columns

  Scenario: Categories appear in the requested order
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table shall show the four category columns in order
