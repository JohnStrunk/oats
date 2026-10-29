@ears:state-driven @component:session-data-access @interface:opencode-tui @interface:opencode-session-data
Feature: While the new displayed session is loading, the session data access shall exclude the previous session subtree

  Scenario: A loaded session is replaced while the new session history is blocked
    When the reactive route switches from a loaded session to a session with blocked history
    Then the blocked route snapshot shall not expose the previous session subtree
    And the released route snapshot shall contain the new session records
