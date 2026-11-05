@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall render each agent-and-model identity and its reported cost as a heading with styling distinct from table data

  Scenario: Every agent/model/reported-cost heading has styling distinguishable from normal numeric cells
    Given the usage details host fixture "providers"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details pair headings shall have SGR styling distinct from normal data cells

  Scenario: An incomplete reported cost keeps the heading's distinct styling
    Given the usage details host fixture "partial reported cost"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details pair headings shall have SGR styling distinct from normal data cells
