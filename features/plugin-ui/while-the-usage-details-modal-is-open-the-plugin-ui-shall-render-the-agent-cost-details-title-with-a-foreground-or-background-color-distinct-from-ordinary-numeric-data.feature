@ears:state-driven @component:plugin-ui @interface:opencode-tui @details-issue-64
Feature: While the usage details modal is open, the plugin UI shall render the "Agent cost details" title with a foreground or background color distinct from ordinary numeric data

  The color difference is measured from rendered PTY foreground/background
  colors against normal numeric data in the same modal. No fixed palette is
  prescribed. Bold-only or other non-color SGR differences do not satisfy this
  requirement.

  Scenario: The title color differs from normal numeric data
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details title shall have an SGR foreground or background color distinct from ordinary numeric data

  Scenario: The title color differs from normal numeric data under Night Owl
    Given the usage details host fixture "single pair"
    And the OpenCode theme "nightowl" is active
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details title shall have an SGR foreground or background color distinct from ordinary numeric data
