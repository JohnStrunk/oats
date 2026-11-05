@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall truncate an overlong agent/model identity with a terminal-cell-aware ellipsis while keeping its reported cost right-justified on the same heading line

  The combined identity is the visible <agent> - <provider>/<model> label. It
  is overlong when its terminal-cell width exceeds the space before the
  right-justified reported cost and the existing two-cell gap. The ellipsis
  glyph is `…` and occupies one terminal cell.

  Scenario: An overlong ASCII identity keeps its reported cost on one heading line
    Given the usage details host fixture "long identity"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the overlong usage details heading beginning with "overflow-agent-" shall use a terminal-cell ellipsis and keep its reported cost "$1.00" right-justified on one line

  Scenario: A wide Unicode identity is measured in terminal cells
    Given the usage details host fixture "wide Unicode identity"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the overlong usage details heading beginning with "wide-agent-" shall use a terminal-cell ellipsis and keep its reported cost "$1.00" right-justified on one line

  Scenario: Generated overlong identities preserve the heading cost alignment
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then generated overlong pair identities shall keep their reported costs right-justified on one ellipsized heading line
