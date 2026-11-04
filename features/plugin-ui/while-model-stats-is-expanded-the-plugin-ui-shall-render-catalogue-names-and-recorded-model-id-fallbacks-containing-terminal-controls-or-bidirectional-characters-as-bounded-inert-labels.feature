@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @sidebar-issue-48 @sidebar-issue-56 @sidebar-name-safety
Feature: While Model stats is expanded, the plugin UI shall render catalogue names and recorded model ID fallbacks containing terminal controls or bidirectional characters as bounded inert labels

  Scenario: Terminal and bidi controls stay inert, and an overlong catalogue name is truncated without losing its cost row
    Given the Agent stats host fixture "model label safety"
    When the sidebar session is displayed with raw terminal output capture
    Then the Model stats control and bidi labels shall remain inert and preserve their reported costs
