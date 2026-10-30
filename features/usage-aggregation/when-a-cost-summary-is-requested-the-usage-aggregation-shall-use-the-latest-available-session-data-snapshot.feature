@ears:event-driven @component:usage-aggregation @interface:opencode-tui @interface:opencode-session-data
Feature: When a cost summary is requested, the usage aggregation shall use the latest available session data snapshot

  The aggregation boundary is on demand: each request reads the latest snapshot.
  This requirement does not promise a reactive callback or reporting UI.

  Scenario: Repeated reads follow duplicate settlement and home
    Given the session data host fixture "live settlement"
    When session data is refreshed
    And the current session snapshot is aggregated
    Then the agent "alpha" shall have no known reported cost and be incomplete
    When the host reports settled usage twice
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 7         |
    When the displayed route changes to home and session data is refreshed
    And the current session snapshot is aggregated
    Then the reported cost summary shall be empty

  Scenario: Repeated reads follow a switch to a different session
    Given the session data host fixture "switch"
    When session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent      | knownCost |
      | alpha      | 1         |
      | beta       | 2         |
      | worker     | 3         |
      | worker-two | 3         |
      | nested     | 4         |
    When the displayed session changes and session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent     | knownCost |
      | new-agent | 5         |
    And the reported cost summary shall identify session "new-root"
