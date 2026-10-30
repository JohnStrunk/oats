@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-model-pricing @details-issue-35
Feature: While a category has a known current price and known tokens, the plugin UI shall display the category cost estimate

  For a single untiered current price the estimate is the price per million
  tokens multiplied by the category's token count divided by 1000000. It is
  identified by e and is not represented as a reported or historical charge.

  Scenario: All four costs use current rates rather than reported costs
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details table shall show the estimated category costs

  Scenario: Generated input usage produces proportionate category estimates
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then generated input counts shall produce the corresponding category estimates
