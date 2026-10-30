@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-35
Feature: While the usage details content exceeds the available height, the plugin UI shall allow scrolling to all pair tables

  Scenario: A user can reach the last table with the host's scrolling controls
    Given the usage details host fixture "scroll"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user scrolls to the end of usage details
    Then the last usage details pair shall be visible
