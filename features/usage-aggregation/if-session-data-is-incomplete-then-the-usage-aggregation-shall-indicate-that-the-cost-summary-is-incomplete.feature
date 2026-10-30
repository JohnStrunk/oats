@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If session data is incomplete, then the usage aggregation shall indicate that the cost summary is incomplete

  Scenario: Unresolved host history is not silently counted as zero
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[{"kind":"historical-usage-unavailable","sessionID":"child"}],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":2}]}
      """
    When the input snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 2         |
    And the reported cost summary shall be incomplete

  Scenario: Ambiguous overlapping usage remains a gap instead of an extra cost
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[{"kind":"compaction-usage-overlap","sessionID":"root","eventID":"e1","cost":3}],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":2},{"id":"2","sessionID":"root","agent":null,"cost":3,"source":"compaction"}]}
      """
    When the input snapshot is aggregated
    Then the reported agent costs shall match:
      | agent | knownCost |
      | alpha | 2         |
    And the unattributed reported cost shall be 3
    And the reported cost summary shall be incomplete
