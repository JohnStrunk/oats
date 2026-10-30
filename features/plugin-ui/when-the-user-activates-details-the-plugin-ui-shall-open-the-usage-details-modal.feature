@ears:event-driven @component:plugin-ui @interface:opencode-tui @details-issue-35
Feature: When the user activates details, the plugin UI shall open the usage details modal

  Scenario: Clicking details opens the modal without toggling the sidebar
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall be visible
    When the user dismisses the usage details modal
    Then the Agent stats section shall remain expanded

  Scenario: Clicking details while collapsed does not expand the sidebar
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user toggles Agent stats using mouse
    And the user clicks the usage details link
    Then the usage details modal shall be visible
    When the user dismisses the usage details modal
    Then the Agent stats section shall remain collapsed
