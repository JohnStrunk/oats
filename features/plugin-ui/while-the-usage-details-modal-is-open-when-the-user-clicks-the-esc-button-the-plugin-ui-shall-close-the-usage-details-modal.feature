@ears:complex @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, when the user clicks the "esc" button, the plugin UI shall close the usage details modal

  Scenario: Clicking the esc button closes the modal
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user clicks the "esc" button
    Then the usage details modal shall be closed
