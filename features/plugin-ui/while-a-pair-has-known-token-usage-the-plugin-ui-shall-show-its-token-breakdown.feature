@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-35
Feature: While a pair has known token usage, the plugin UI shall show its token breakdown

  OpenCode 2.0.32 records input as non-cached input and output as visible
  output separate from reasoning; output-rate usage includes both output and
  reasoning. Cache read and write are separate recorded categories.

  Scenario: Noncached input and output including reasoning are displayed
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table shall show the known token counts
