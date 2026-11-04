@ears:complex @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, when the user clicks outside the modal panel, the plugin UI shall close the usage details modal

  Scenario: Clicking outside the panel closes the modal
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user clicks outside the modal panel
    Then the usage details modal shall be closed

  Scenario: Clicking the cell immediately above the bordered panel closes the modal
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user clicks the cell immediately above the bordered panel
    Then the usage details modal shall be closed
