@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-64
Feature: While the usage details modal is open, the plugin UI shall render its modal title, pair titles, and table headings with pairwise-distinct foreground or background colors

  The "Agent cost details" modal title, each pair identity and its reported
  cost (including an unavailable cost), the column headings, and the row
  labels are compared pairwise from their rendered PTY foreground/background
  colors: every one of the three elements must differ in color from the other
  two. No fixed palette is prescribed. Bold-only or other non-color SGR
  differences do not satisfy this requirement.

  Scenario: Multiple pair tables keep the title, pair titles, and table headings pairwise-distinct
    Given the usage details host fixture "providers"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal title, pair titles, and table headings shall have pairwise-distinct SGR foreground or background colors

  Scenario: The title, pair titles, and table headings remain pairwise-distinct under Night Owl
    Given the usage details host fixture "providers"
    And the OpenCode theme "nightowl" is active
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal title, pair titles, and table headings shall have pairwise-distinct SGR foreground or background colors

  Scenario: A single pair table keeps the title, pair titles, and table headings pairwise-distinct
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal title, pair titles, and table headings shall have pairwise-distinct SGR foreground or background colors

  Scenario: An unavailable reported cost keeps the title, pair titles, and table headings pairwise-distinct
    Given the usage details host fixture "unknown"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show an unavailable reported-cost heading
    And the usage details modal title, pair titles, and table headings shall have pairwise-distinct SGR foreground or background colors
