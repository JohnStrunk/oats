@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-35
Feature: While usage details are open, the plugin UI shall sort pair tables by agent and then model

  Scenario: Multiple pairs appear in agent then model order
    Given the usage details host fixture "sorting"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show pairs in sorted order
