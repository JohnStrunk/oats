@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While the usage details modal is open, the plugin UI shall style the "Agent cost details" title distinctly from ordinary usage data

  Scenario: The title styling is distinguishable from a normal numeric data cell
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details title shall have SGR styling distinct from a normal data cell
