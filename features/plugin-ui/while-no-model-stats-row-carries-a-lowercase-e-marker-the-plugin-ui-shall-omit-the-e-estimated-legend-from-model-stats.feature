@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While no Model stats row carries a lowercase e marker, the plugin UI shall omit the "e = estimated" legend from Model stats

  Scenario: Complete model rows omit the Model stats legend
    Given the Agent stats host fixture "model rounding"
    When the Agent stats session is displayed
    Then the Model stats e legend shall be omitted
