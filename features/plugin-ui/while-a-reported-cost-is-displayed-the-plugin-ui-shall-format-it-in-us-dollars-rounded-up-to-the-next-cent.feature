@ears:state-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: While a reported cost is displayed, the plugin UI shall format it in US dollars rounded up to the next cent

  Rounding up means the least whole number of cents greater than or equal to
  the reported cost, including for negative costs. Display the result with
  exactly two fractional digits, without scientific notation. For a total,
  sum the reported decimal amounts exactly before rounding the total once;
  binary floating-point artifacts must not increase the displayed cent.
  For each reported floating-point amount, the decimal input is the shortest
  decimal representation that round-trips to that same floating-point value.
  If aggregation cannot produce a finite total, the total remains unavailable
  and incomplete rather than being treated as a finite value to round.

  Scenario: Zero and exact cent amounts use dollar notation
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    Then the sidebar shall format agent "zero" as "$0.00"
    And the sidebar shall format agent "fraction" as "$1.25"

  Scenario Outline: Costs at and around cent boundaries round toward positive infinity
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "<cost>" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "<display>"

    Examples:
      | cost     | display |
      | 0        | $0.00   |
      | 0.01     | $0.01   |
      | 0.010001 | $0.02   |
      | 1.15     | $1.15   |
      | 1.25     | $1.25   |
      | 1.250001 | $1.26   |
      | -0.001   | $0.00   |
      | -0.01    | $-0.01  |
      | -0.01001 | $-0.01  |
      | -1.25    | $-1.25  |
      | -1.25001 | $-1.25  |

  Scenario Outline: Repeated records are summed as decimals before rounding
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    And a reported cost of "1.25" is supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "$1.25"
    When reported costs of "<first>" and "<second>" are supplied for agent tiny
    Then the sidebar shall format agent "tiny" as "<display>"

    Examples:
      | first | second | display |
      | 0.10  | 0.20   | $0.30   |
      | 0.001 | 0.001  | $0.01   |
      | 0.009 | 0.002  | $0.02   |
      | 1.005 | 0.005  | $1.01   |

  Scenario: Generated cent boundaries and fractional cents round up
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    Then every generated reported cost shall be displayed rounded up to the next cent
