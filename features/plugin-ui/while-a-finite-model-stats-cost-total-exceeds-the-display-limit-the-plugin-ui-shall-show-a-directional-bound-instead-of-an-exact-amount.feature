@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While a finite Model stats cost total exceeds the display limit, the plugin UI shall show a directional bound instead of an exact amount

  Scenario: The exact display limit and values beyond it retain their correct display
    Given the Agent stats host fixture "model overflow"
    When the Agent stats session is displayed
    Then the Model stats cost rows shall align with these values and markers:
      | label            | value       | marker |
      | positive-bound   | >$9999.99   | blank  |
      | negative-bound   | <-$9999.99  | blank  |
      | partial-bound    | >$9999.99   | e      |
      | at-limit         | $9999.99    | blank  |
      | just-over-limit  | >$9999.99   | blank  |
