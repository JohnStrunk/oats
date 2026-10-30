@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If a record has no agent name, then the usage aggregation shall preserve its reported cost as unattributed

  Unattributed work makes the overall summary incomplete even when its cost is known.

  Scenario: Missing identity does not credit a known agent
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":2},{"id":"2","sessionID":"child","agent":null,"cost":3},{"id":"3","sessionID":"child","agent":null,"cost":4}]}
      """
    When the input snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 2         |
    And the unattributed reported cost shall be 7
    And the reported cost summary shall be incomplete
