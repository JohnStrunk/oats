@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall right-align numeric values and reserve a trailing "e" marker cell so the numeric position remains unchanged

  Scenario: Numeric positions remain aligned across magnitudes and completeness states
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then generated usage details values shall remain right-aligned with a reserved optional e marker cell
