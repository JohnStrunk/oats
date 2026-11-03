@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While a Model stats cost row is visible, the plugin UI shall align its label left and its value right

  Scenario: Values and lowercase markers use a shared right edge
    Given the Agent stats host fixture "model incomplete"
    When the Agent stats session is displayed
    Then the Model stats cost rows shall align with these values and markers:
      | label            | value       | marker |
      | zero-model       | $0.00       | blank  |
      | partial-model    | $2.00       | e      |
      | unknown-model    | unavailable | blank  |
      | Unattributed     | $3.00       | e      |
