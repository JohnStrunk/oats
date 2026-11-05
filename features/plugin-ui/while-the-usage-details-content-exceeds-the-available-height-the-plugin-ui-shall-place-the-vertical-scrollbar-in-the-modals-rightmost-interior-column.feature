@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-43 @details-issue-64
Feature: While the usage details content exceeds the available height, the plugin UI shall place the vertical scrollbar in the modal's rightmost interior column

  Scenario: The scrollbar occupies the modal's rightmost interior column with the first table visible
    Given the usage details host fixture "scroll"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details scrollbar shall occupy the modal rightmost interior column

  Scenario: The scrollbar occupies the modal's rightmost interior column with a mixed-width Unicode heading
    Given the usage details host fixture "scroll mixed unicode"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details scrollbar shall occupy the modal rightmost interior column
