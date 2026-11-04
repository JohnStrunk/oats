@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, the plugin UI shall display a clickable button labeled "esc" at the panel's upper-right corner

  Scenario: The lowercase esc button appears at the upper-right of the panel
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show the clickable "esc" button at the upper-right corner
