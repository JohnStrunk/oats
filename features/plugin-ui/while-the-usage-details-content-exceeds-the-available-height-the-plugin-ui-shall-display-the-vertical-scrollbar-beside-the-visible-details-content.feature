@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-43
Feature: While the usage details content exceeds the available height, the plugin UI shall display the vertical scrollbar beside the visible details content

  Scenario: The overflow scrollbar is alongside the first visible table
    Given the usage details host fixture "scroll"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details scrollbar shall appear beside the visible details table

  Scenario: The overflow scrollbar is alongside a heading with mixed narrow and wide Unicode
    Given the usage details host fixture "scroll mixed unicode"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details scrollbar shall appear beside the visible details table
