@ears:event-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: When the displayed session changes, the plugin UI shall scope Agent stats to the new session subtree

  The new scope takes effect even while the section is collapsed; rows remain
  hidden until it is expanded.

  Scenario: Switching sessions replaces the previous rows
    Given the Agent stats host fixture "switch"
    When the Agent stats session is displayed
    And the user switches the Agent stats session to "new-root"
    Then the sidebar agent rows shall be:
      | agent     | cost |
      | new-agent | 5    |

  Scenario: An old blocked read cannot overwrite the new session
    Given the Agent stats host fixture "blocked old session"
    When the Agent stats session is displayed
    And the user switches the Agent stats session to "new-root"
    Then the sidebar agent rows shall be:
      | agent     | cost |
      | new-agent | 5    |
    When the old Agent stats history read is released
    Then the sidebar agent rows shall remain:
      | agent     | cost |
      | new-agent | 5    |

  Scenario: A blocked new session never displays the old session's rows
    Given the Agent stats host fixture "blocked new session"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "alpha" with reported cost 1
    When the user switches the Agent stats session to "new-root"
    Then the sidebar shall show loading without previous session rows
    When the new Agent stats history read is released
    Then the sidebar agent rows shall be:
      | agent     | cost |
      | new-agent | 5    |
