@ears:complex @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-35
Feature: While usage details are open, when the displayed session changes, the plugin UI shall show the new session scope

  Scenario: The previous session pair is replaced by the new session pair
    Given the usage details host fixture "switch"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And the details session changes
    Then the usage details modal shall show only the new session pair
