@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, the plugin UI shall show the title "Agent cost details" at the panel's upper-left corner

  Scenario: The exact title appears at the upper-left of the panel
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show the title "Agent cost details" at the upper-left corner
