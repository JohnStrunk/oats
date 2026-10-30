@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: If work has no recorded agent name, then the plugin UI shall identify that work as unattributed

  Scenario: Known unattributed cost is not assigned to a named agent
    Given the Agent stats host fixture "incomplete"
    When the Agent stats session is displayed
    Then the sidebar shall show unattributed reported cost 3
