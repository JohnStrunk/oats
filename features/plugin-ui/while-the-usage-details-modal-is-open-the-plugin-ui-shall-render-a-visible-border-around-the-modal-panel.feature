@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-55
Feature: While the usage details modal is open, the plugin UI shall render a visible border around the modal panel

  Scenario: The open usage details modal has a visible panel border
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall have a visible border around its panel
