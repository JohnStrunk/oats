@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall render each pair identity and its reported cost with foreground or background colors that differ from ordinary numeric data

  Each pair heading's agent/model identity and reported cost, including an
  unavailable cost, is compared with the rendered PTY foreground/background
  colors of normal numeric data in the same modal. No fixed palette is
  prescribed. Bold-only or other non-color SGR differences do not satisfy this
  requirement.

  Scenario: Every visible pair identity and currency cost differs from normal numeric data
    Given the usage details host fixture "providers"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data

  Scenario: An incomplete reported cost keeps its heading color distinction
    Given the usage details host fixture "partial reported cost"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data

  Scenario: A negative reported cost keeps its heading color distinction
    Given the usage details host fixture "negative reported cost"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data

  Scenario: An unavailable reported cost keeps its heading color distinction
    Given the usage details host fixture "unknown"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show an unavailable reported-cost heading
    And each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data

  Scenario: Every pair heading remains color-distinct under Night Owl
    Given the usage details host fixture "unknown"
    And the OpenCode theme "nightowl" is active
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show an unavailable reported-cost heading
    And each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data
