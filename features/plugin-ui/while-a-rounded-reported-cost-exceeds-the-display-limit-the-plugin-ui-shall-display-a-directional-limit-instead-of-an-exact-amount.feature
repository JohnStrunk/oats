@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: While a rounded reported cost exceeds the display limit, the plugin UI shall display a directional limit instead of an exact amount

  The display limit is $9999.99 in either direction. First round the known
  reported total upward to a whole cent; if it exceeds $9999.99, display
  ">$9999.99", and if it is less than -$9999.99, display "<-$9999.99".
  These indicators describe bounds, not exact capped amounts. A known partial
  total retains its incomplete marker even when shown as a limit. A total
  unavailable because aggregation cannot produce a finite number remains
  unavailable and incomplete, rather than being replaced by a limit.

  Scenario Outline: The rounded total determines whether a limit is shown
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "1.25" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "$1.25"
    When a reported cost of "<cost>" is supplied for agent tiny
    Then the sidebar shall display bounded cost "<display>" for agent "tiny"

    Examples:
      | cost          | display    |
      | 9999.98       | $9999.98   |
      | 9999.989999   | $9999.99   |
      | 9999.99       | $9999.99   |
      | 9999.990001   | >$9999.99  |
      | 10000         | >$9999.99  |
      | -9999.99      | $-9999.99  |
      | -9999.990001  | $-9999.99  |
      | -10000        | <-$9999.99 |
      | 1e308         | >$9999.99  |
      | -1e308        | <-$9999.99 |

  Scenario Outline: The exact decimal sum is rounded before applying the limit
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "1.25" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "$1.25"
    When reported costs of "<first>" and "<second>" are supplied for agent tiny
    Then the sidebar shall display bounded cost "<display>" for agent "tiny"

    Examples:
      | first    | second    | display   |
      | 4999.99  | 5000      | $9999.99  |
      | 9999.89  | 0.10      | $9999.99  |
      | 9999.89  | 0.100001  | >$9999.99 |
      | -9999.89 | -0.100001 | $-9999.99 |

  Scenario Outline: A bounded partial total retains its incomplete marker
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "1.25" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "$1.25"
    When an incomplete reported cost of "<cost>" is supplied for agent tiny
    Then the sidebar shall display bounded cost "<display>" for agent "tiny"
    And the sidebar shall identify agent "tiny" as incomplete

    Examples:
      | cost   | display    |
      | 10000  | >$9999.99  |
      | -10000 | <-$9999.99 |

  Scenario: An overflowing aggregate remains unavailable rather than a limit
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "1.25" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "$1.25"
    When reported costs of "1.7976931348623157e308" and "1.7976931348623157e308" are supplied for agent tiny
    Then the sidebar shall display agent "tiny" as unavailable and incomplete

  Scenario: Generated amounts beyond either limit are directional bounds
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    Then generated costs beyond the display limit shall show the appropriate directional bound
