@ears:event-driven @component:session-data-access @interface:opencode-tui @interface:opencode-session-data
Feature: When the displayed session changes, the session data access shall expose only the new session subtree

  Scenario: A switch replaces the previous session data
    Given the session data host fixture "switch"
    When the displayed session changes and session data is refreshed
    Then the session data outcome shall match "switched"

  Scenario: A delayed prior refresh cannot overwrite the new session
    Given the session data host fixture "switch"
    When an old refresh completes after a new session refresh
    Then the session data outcome shall match "switched"

  Scenario: A reactive route switch is observed without an explicit refresh
    When the reactive host route switches to another session
    Then the route probe shall observe only the new session records

  Scenario: A reactive switch cannot be overwritten by a blocked prior startup load
    When the reactive host route switches during initial loading
    Then the route probe shall observe only the new session records
