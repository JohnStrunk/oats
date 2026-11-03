@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: If a Model stats known reported-cost total is incomplete, then the plugin UI shall mark its value with a lowercase e

  The marker applies to known partial totals, including the Unattributed row.
  A wholly unknown total remains unavailable without a marker.

  Scenario: Known partials, complete zero and unknown costs remain distinct
    Given the Agent stats host fixture "model incomplete"
    When the Agent stats session is displayed
    Then the Model stats cost rows shall align with these values and markers:
      | label            | value       | marker |
      | zero-model       | $0.00       | blank  |
      | partial-model    | $2.00       | e      |
      | unknown-model    | unavailable | blank  |
      | Unattributed     | $3.00       | e      |
