@ears:state-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: While a positive sub-cent reported cost is displayed, the plugin UI shall format it as 0.01 US dollars

  Scenario: A tiny positive reported cost is displayed as one cent
    Given the Agent stats host fixture "formatting"
    When the Agent stats session is displayed
    Then the sidebar shall format agent "tiny" as "$0.01"

  Scenario: Positive sub-cent costs across small scales display as one cent
    When generated positive reported costs are displayed in Agent stats
    Then every generated positive sub-cent cost shall be displayed as one cent
