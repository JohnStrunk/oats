@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall render its column-heading row and row-label column with foreground or background colors that differ from ordinary numeric data

  Each column heading and row label is compared with the rendered PTY
  foreground/background colors of normal numeric data in the same modal. No
  fixed palette is prescribed. Bold-only or other non-color SGR differences do
  not satisfy this requirement.

  Scenario: Each column heading and row label has a color distinct from numeric data
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details column-heading row and row-label column shall have SGR foreground or background colors distinct from ordinary numeric data

  Scenario: The column headings and row labels remain color-distinct under Night Owl
    Given the usage details host fixture "single pair"
    And the OpenCode theme "nightowl" is active
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details column-heading row and row-label column shall have SGR foreground or background colors distinct from ordinary numeric data
