@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34
Feature: If an Agent stats cost total is unknown, then the plugin UI shall display unavailable instead of zero

  The unavailable value has a blank reserved marker position, not e, for both
  named agents and Unattributed. An unavailable value conveys incompleteness
  without presenting an invented numeric total.

  Scenario: Unknown and zero remain distinct and occupy aligned columns
    Given the Agent stats host fixture "aligned mixed"
    When the Agent stats session is displayed
    Then the sidebar cost rows shall align with these values and markers:
      | label        | value       | marker |
      | alpha        | $0.00       | blank  |
      | beta         | $1.20       | e      |
      | gamma        | unavailable | blank  |
      | delta        | <-$9999.99  | blank  |
      | Unattributed | $3.00       | e      |

  Scenario: Unattributed unknown costs are also unavailable
    Given the Agent stats host fixture "aligned unknown"
    When the Agent stats session is displayed
    Then the sidebar cost rows shall align with these values and markers:
      | label        | value       | marker |
      | alpha        | unavailable | blank  |
      | Unattributed | unavailable | blank  |
