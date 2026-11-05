@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While a usage details table is displayed, the plugin UI shall render its column-heading row and row-label column with background colors that differ from ordinary numeric data

  The distinction is measured from rendered PTY SGR background colors against
  ordinary numeric data in the same modal. Blank spacer and padding cells carry
  the same explicit background as the adjacent heading/label, distinct from
  numeric data.
  No fixed palette is prescribed. Foreground-only, bold-only, and other
  non-background SGR differences do not satisfy this requirement.

  Scenario: Each column heading and row label has a background distinct from numeric data
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details column-heading row and row-label column shall have SGR background colors distinct from ordinary numeric data

  Scenario: The entire heading row and label column remain background-distinct under Night Owl
    Given the usage details host fixture "single pair"
    And the OpenCode theme "nightowl" is active
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details column-heading row and row-label column shall have SGR background colors distinct from ordinary numeric data
