@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: While a session is displayed, the plugin UI shall present a Model stats section alongside Agent stats

  Scenario: Both independent summaries are present in the session sidebar
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the sidebar shall contain the section title "Agent stats"
    And the sidebar shall contain the section title "Model stats"
