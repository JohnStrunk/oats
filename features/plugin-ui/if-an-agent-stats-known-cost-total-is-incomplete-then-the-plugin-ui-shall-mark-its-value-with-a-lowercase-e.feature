@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34
Feature: If an Agent stats known cost total is incomplete, then the plugin UI shall mark its value with a lowercase e

  The e immediately follows the formatted amount or directional bound. This
  applies to named agents and Unattributed, not merely the overall summary.

  Scenario: Known partial amounts are marked without marking complete amounts
    Given the Agent stats host fixture "aligned mixed"
    When the Agent stats session is displayed
    Then the sidebar cost rows shall align with these values and markers:
      | label        | value       | marker |
      | alpha        | $0.00       | blank  |
      | beta         | $1.20       | e      |
      | gamma        | unavailable | blank  |
      | delta        | <-$9999.99  | blank  |
      | Unattributed | $3.00       | e      |

  Scenario: An incomplete directional bound retains the marker
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And an incomplete reported cost of "10000" is supplied for agent tiny
    Then the sidebar cost rows shall align with these values and markers:
      | label | value     | marker |
      | tiny  | >$9999.99 | e      |
