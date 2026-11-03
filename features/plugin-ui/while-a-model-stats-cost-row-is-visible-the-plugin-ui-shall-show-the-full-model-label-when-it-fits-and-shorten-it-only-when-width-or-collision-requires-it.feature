@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-47 @sidebar-issue-48
Feature: While a Model stats cost row is visible, the plugin UI shall show the full model label when it fits and shorten it only when width or collision requires it

  Scenario: Short labels stay full and long colliding labels fit their rows
    Given the Agent stats host fixture "model name sizing"
    When the Agent stats session is displayed
    Then the Model stats model labels shall fit their available row widths:
      | identifier                              | cost  | must_be_full |
      | compact-model                           | $1.00 | yes          |
      | 代理模型                                | $4.00 | yes          |
      | abcdefghijklmnopqrstuvwx0123456789-alpha | $2.00 | no           |
      | abcdefghijklmnopqrstuvwx0123456789-beta  | $3.00 | no           |

  Scenario: Generated identifiers use the name width left by their reported-cost values
    Given the Agent stats host fixture "model name sizing"
    When the Agent stats session is displayed
    Then generated recorded model identifiers shall use their available row width without premature shortening

  Scenario: Whitespace-equivalent identifiers receive deterministic display-only suffixes
    Given the Agent stats host fixture "model whitespace collision"
    When the Agent stats session is displayed
    # The second identifier contains U+00A0 NO-BREAK SPACE between the words.
    Then the Model stats model labels shall fit their available row widths:
      | identifier   | cost  | must_be_full | displayed_label |
      | shared model | $1.00 | no           | shared model #1  |
      | shared model | $2.00 | no           | shared model #2  |
