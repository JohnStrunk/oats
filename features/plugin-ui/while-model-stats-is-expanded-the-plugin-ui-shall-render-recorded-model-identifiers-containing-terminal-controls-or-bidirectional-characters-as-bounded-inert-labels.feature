@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48 @sidebar-name-safety
Feature: While Model stats is expanded, the plugin UI shall render recorded model identifiers containing terminal controls or bidirectional characters as bounded inert labels

  Scenario: Terminal-control and bidi characters cannot execute or erase model cost rows
    Given the Agent stats host fixture "model label safety"
    When the sidebar session is displayed with raw terminal output capture
    Then the Model stats control and bidi labels shall remain inert and preserve their reported costs
