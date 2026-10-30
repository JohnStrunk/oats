@ears:state-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: While a session is displayed, the plugin UI shall present an Agent stats sidebar section

  Scenario: The actual plugin contributes to a session sidebar host slot
    Given the Agent stats host fixture "history"
    When the actual OATS TUI plugin is loaded by the sidebar host
    Then the plugin shall contribute to a session sidebar slot

  Scenario: The section title includes the details link
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then the sidebar shall contain the section title "Agent stats (details)"

  Scenario: A session without the OATS plugin has no Agent stats section
    Given an Agent stats session without the OATS plugin
    When the Agent stats session is displayed
    Then the session sidebar shall not contain an Agent stats section
