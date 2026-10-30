@ears:event-driven @component:usage-aggregation @interface:opencode-tui @interface:opencode-session-data
Feature: When the displayed session changes, the usage aggregation shall exclude the previous session subtree

  Scenario: A different displayed session does not retain the old totals
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"old","cost":50}]}
      """
    When the input snapshot is aggregated
    And this replacement snapshot is aggregated:
      """json
      {"sessionID":"other","complete":true,"gaps":[],"errors":[],"records":[{"id":"2","sessionID":"other","agent":"new","cost":3}]}
      """
    Then the reported agent costs shall match:
      | agent | knownCost |
      | new   | 3         |
    And the reported cost summary shall identify session "other"

  Scenario: An actual session-data route change replaces the aggregated subtree
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
