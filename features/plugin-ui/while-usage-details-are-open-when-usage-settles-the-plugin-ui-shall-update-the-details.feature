@ears:complex @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-35
Feature: While usage details are open, when usage settles, the plugin UI shall update the details

  Scenario: A new settled record updates the open modal
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    And additional usage settles for the details pair
    Then the usage details heading shall show alpha and fixture-model with reported cost "$7.00"
