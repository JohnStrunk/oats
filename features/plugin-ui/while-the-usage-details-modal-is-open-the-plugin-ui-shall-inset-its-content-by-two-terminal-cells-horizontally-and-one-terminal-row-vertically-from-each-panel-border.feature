@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While the usage details modal is open, the plugin UI shall inset its content by two terminal cells horizontally and one terminal row vertically from each panel border

  Scenario: The title and pair heading use two horizontal cells and one top padding row
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall render its title and pair heading with the requested padding

  Scenario: Scrolled content leaves one vertical padding row above the bottom border
    Given the usage details host fixture "scroll"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the user scrolls to the end of usage details
    Then the last usage details pair shall be visible
    And the scrolled usage details shall leave one blank row above the bottom panel border
