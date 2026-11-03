@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @sidebar-issue-48
Feature: While a Model stats row is visible, the plugin UI shall display its reported cost instead of a provider-price estimate

  Scenario: Recorded cost remains the displayed value when token counts and model prices differ
    Given the Agent stats host fixture "model reported cost"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model          | cost  |
      | reported-model | $1.24 |
