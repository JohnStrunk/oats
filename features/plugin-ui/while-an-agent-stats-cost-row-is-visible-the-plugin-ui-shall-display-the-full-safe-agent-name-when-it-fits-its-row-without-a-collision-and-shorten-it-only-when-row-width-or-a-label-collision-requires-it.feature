@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-47
Feature: While an Agent stats cost row is visible, the plugin UI shall display the full safe agent name when it fits its row without a collision and shorten it only when row width or a label collision requires it

  The full-name check applies to the safely sanitized display form of each
  recorded name; truncation or a disambiguation suffix does not change its
  attribution or merge distinct agents. Each row's available name width is the
  terminal-cell space remaining after its colon, separator, cost, and reserved
  marker cell. A name that fits remains full unless its fitted label would
  collide with another name; ellipsizing is limited to names that exceed their
  own row width, and collision suffixes are limited to actual fitted-label
  collisions. Each recorded agent keeps one row, with its cost and marker
  visible and aligned.

  Scenario: Full names remain visible when their row widths distinguish them
    Given the Agent stats host fixture "name sizing"
    When the Agent stats session is displayed
    Then the sidebar agent names shall fit their available row widths:
      | name                     | value       | marker | must_be_full |
      | short                    | $1.00       | blank  | yes          |
      | medium-agent-name        | $2.00       | blank  | yes          |
      | abcdefghijklmnopqrstuvwx1234 | $3.00       | blank  | no           |
      | bcdefghijklmnopqrstuvwxy1234 | unavailable | blank  | no           |
      | cdefghijklmnopqrstuvwxy12345 | >$9999.99   | e      | no           |
      | abcdefghijklmnop-alpha  | $4.00       | blank  | yes          |
      | abcdefghijklmnop-beta   | $5.00       | blank  | yes          |
      | abcdefghijklmnop-a      | $100.00     | blank  | yes          |
      | abcdefghijklmnop-b      | $6.00       | blank  | yes          |

  Scenario: Fitted-label collisions remain distinguishable without merging agents
    Given the Agent stats host fixture "name sizing"
    When the Agent stats session is displayed
    Then the sidebar shall disambiguate names that collide at their available row widths:
      | name                                                                                                                                                                          | value | marker |
      | common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-alpha | $8.00 | blank  |
      | common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-common-agent-prefix-beta  | $9.00 | blank  |
