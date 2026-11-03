@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While a Model stats reported cost is displayed, the plugin UI shall format it in US dollars rounded up to the next cent

  Costs are summed as their shortest decimal representations before the total
  is rounded once toward positive infinity. This rule also applies to negative
  totals.

  Scenario: Exact, fractional and repeated costs retain cent-level formatting
    Given the Agent stats host fixture "model rounding"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model          | cost   |
      | zero-model     | $0.00  |
      | exact-model    | $1.25  |
      | sub-cent-model | $0.01  |
      | sum-model      | $0.30  |
      | negative-model | $-0.01 |
