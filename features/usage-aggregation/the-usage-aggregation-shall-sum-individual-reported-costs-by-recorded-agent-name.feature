@ears:ubiquitous @component:usage-aggregation @interface:opencode-session-data
Feature: The usage aggregation shall sum individual reported costs by recorded agent name

  Scenario: Scoped nested descendant costs retain their recorded agent attribution
    Given the session data host fixture "tree with paginated history"
    When session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent      | knownCost |
      | alpha      | 1         |
      | beta       | 2         |
      | worker     | 3         |
      | worker-two | 3         |
      | nested     | 4         |

  Scenario: Different recorded models and sessions share a name
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"r1","sessionID":"root","agent":"alpha","model":{"providerID":"p","id":"one"},"cost":2},{"id":"r2","sessionID":"child","agent":"alpha","model":{"providerID":"p","id":"two"},"cost":3},{"id":"r3","sessionID":"grandchild","agent":"beta","model":{"providerID":"p","id":"two"},"cost":7},{"id":"r4","sessionID":"grandchild","agent":"alpha","model":{"providerID":"p","id":"one"},"cost":5}]}
      """
    When the input snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 10        |
      | beta  | 7         |

  Scenario: The same agent executes at root, child and grandchild levels
    Given the session data host fixture "tree with paginated history"
    And the host records alpha work across nested sessions
    When session data is refreshed
    And the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent      | knownCost |
      | alpha      | 8         |
      | beta       | 2         |
      | worker-two | 3         |

  Scenario: Aggregation is invariant under ordering and model changes
    When generated valid session snapshots are aggregated
    Then reported totals shall be invariant under record order and model changes

  Scenario: Individual costs at extreme finite scales remain known
    When generated valid session snapshots are aggregated
    Then individual reported costs shall be preserved across finite scales
