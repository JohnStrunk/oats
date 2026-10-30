@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34
Feature: While an Agent stats cost row is visible, the plugin UI shall align its label left and its value right

  Named agents and Unattributed use the same layout. Value endings align in a
  shared column, immediately followed by a reserved marker column. Formatting,
  directional bounds and bounded inert names remain unchanged.

  Scenario: Differently sized values and labels align across complete, incomplete and unavailable rows
    Given the Agent stats host fixture "aligned mixed"
    When the Agent stats session is displayed
    Then the sidebar cost rows shall align with these values and markers:
      | label        | value       | marker |
      | alpha        | $0.00       | blank  |
      | beta         | $1.20       | e      |
      | gamma        | unavailable | blank  |
      | delta        | <-$9999.99  | blank  |
      | Unattributed | $3.00       | e      |

  Scenario: Generated labels and costs retain alignment
    Given the Agent stats host fixture "aligned complete"
    When the Agent stats session is displayed
    Then generated sidebar cost rows shall retain their alignment and marker positions
