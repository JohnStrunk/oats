@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-35
Feature: While a usage details table is displayed, the plugin UI shall show its pair heading with the reported cost

  The heading format is <agent> - <model>  $XX.XX. The amount is the sum
  of the pair's recorded reported costs, not the category estimates. Reported
  costs follow the existing exact-decimal summation and ceiling-to-cent display
  convention; incomplete costs retain the known portion and an indication.

  Scenario: Heading uses the sum of reported costs rather than estimates
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details heading shall show alpha and fixture-model with reported cost "$3.00"

  Scenario: Generated reported costs remain correct across record order and grouping
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then generated pair reported costs shall be summed before display
