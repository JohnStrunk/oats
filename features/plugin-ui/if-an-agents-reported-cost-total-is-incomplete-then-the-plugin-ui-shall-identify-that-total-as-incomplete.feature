@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: If an agent's reported cost total is incomplete, then the plugin UI shall identify that total as incomplete

  Scenario: Known partial cost remains visible
    Given the Agent stats host fixture "incomplete"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "partial" with reported cost 2
    And the sidebar shall identify agent "partial" as incomplete
    And the sidebar shall identify agent "unknown" as incomplete without a zero total
