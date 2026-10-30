@ears:event-driven @component:usage-aggregation @interface:opencode-session-data
Feature: When settled usage is updated, the usage aggregation shall use the latest individual record

  Scenario: Repeated live settlement notifications do not double the cost
    Given the session data host fixture "live settlement"
    When the host reports settled usage twice
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 7         |

  Scenario: A later snapshot replaces an earlier value instead of adding it
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":2}]}
      """
    When the input snapshot is aggregated
    And this replacement snapshot is aggregated:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":7}]}
      """
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 7         |

  Scenario: Refreshing updated host history replaces the previous cost
    Given the session data host fixture "recorded identities"
    When session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 1         |
      | beta  | 2         |
    When the host updates an existing historical cost and session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 7         |
      | beta  | 2         |
