@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34 @sidebar-issue-47
Feature: While an Agent stats cost row has a lowercase e marker, the plugin UI shall display the exact legend "e = estimated" exactly once

  Summary-level gaps alone do not add a legend. The legend explains the marker
  without changing the marker's existing conditions or placement.

  Scenario: A known incomplete reported-cost total has one exact legend
    Given the Agent stats host fixture "aligned mixed"
    When the Agent stats session is displayed
    Then the sidebar shall show the e legend exactly once
