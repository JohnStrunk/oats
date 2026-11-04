@ears:complex @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, when the user presses Escape, the plugin UI shall close the usage details modal

  Scenario: Pressing Escape continues to close the modal
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user presses Escape while the usage details modal is open
    Then the usage details modal shall be closed
