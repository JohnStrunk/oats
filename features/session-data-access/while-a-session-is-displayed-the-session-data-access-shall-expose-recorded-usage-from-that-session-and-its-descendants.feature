@ears:state-driven @component:session-data-access @interface:opencode-tui @interface:opencode-session-data
Feature: While a session is displayed, the session data access shall expose recorded usage from that session and its descendants

  Scenario: Existing history includes nested descendants but not ancestors or unrelated sessions
    Given the session data host fixture "tree with paginated history"
    When session data is refreshed
    Then the session data outcome shall match "tree with paginated history"

  Scenario: Different records remain distinct across repeated refreshes
    Given the session data host fixture "tree with paginated history"
    When session data is refreshed twice
    Then the session data outcome shall match "tree with paginated history"

  Scenario: Arbitrary descendant trees exclude unrelated sessions
    Then generated session trees shall expose exactly their descendant records

  Scenario: A newly created descendant is discovered without an explicit refresh
    Given the session data host fixture "tree with paginated history"
    When the host reports a new descendant session
    Then the session data outcome shall match "live descendant"

  Scenario: Multiple pages of child sessions and message history are followed
    Given the session data host fixture "pagination"
    When session data is refreshed
    Then all paginated descendant history shall be exposed
