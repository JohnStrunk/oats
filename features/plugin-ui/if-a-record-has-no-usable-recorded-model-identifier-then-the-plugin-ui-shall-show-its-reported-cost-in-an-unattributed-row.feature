@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: If a record has no usable recorded model identifier, then the plugin UI shall show its reported cost in an Unattributed row

  Scenario: Costs with missing, blank or unusable model identifiers are preserved
    Given the Agent stats host fixture "model unattributed"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model               | cost |
      | named-model         | 1    |
      | Unattributed        | 9    |
      | Unattributed #1     | 7    |
