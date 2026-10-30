@ears:event-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: When the Agent stats section is first presented, the plugin UI shall present it expanded

  Scenario: Existing history is visible without toggling
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "alpha" with reported cost 1
