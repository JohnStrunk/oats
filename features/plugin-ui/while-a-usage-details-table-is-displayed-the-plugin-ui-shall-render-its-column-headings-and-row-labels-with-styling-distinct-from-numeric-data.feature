@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall render its column headings and row labels with styling distinct from numeric data

  Scenario: Its table headings and row labels are distinguishable from numeric values
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table headings and row labels shall have SGR styling distinct from numeric data
