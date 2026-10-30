@ears:state-driven @component:plugin-ui @interface:opencode-tui @sidebar-issue-6
Feature: While the plugin is running, the plugin UI shall retain the user's Agent stats expansion choice across session changes

  Scenario: Collapsing survives switching sessions but not a new app run
    Given the Agent stats host fixture "switch"
    When the Agent stats session is displayed
    And the user toggles Agent stats using keyboard
    And the user switches the Agent stats session to "new-root"
    Then the sidebar shall hide agent "new-agent"
    When the user toggles Agent stats using keyboard
    Then the sidebar shall show agent "new-agent" with reported cost 5
    When the user toggles Agent stats using keyboard
    Then the sidebar shall hide agent "new-agent"
    When the Agent stats app is restarted
    Then the sidebar shall show agent "new-agent" with reported cost 5
