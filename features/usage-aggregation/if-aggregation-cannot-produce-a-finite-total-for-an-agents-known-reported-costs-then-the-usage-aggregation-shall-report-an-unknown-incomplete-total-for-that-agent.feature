@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If aggregation cannot produce a finite total for an agent's known reported costs, then the usage aggregation shall report an unknown, incomplete total for that agent

  Totals use supported numeric aggregation without a guarantee of arbitrary
  precision or a particular summation order. Failure to produce a finite total
  does not imply that the mathematical sum is unrepresentable.

  Scenario: Two finite costs overflow the supported total
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":1.7976931348623157e308},{"id":"2","sessionID":"root","agent":"alpha","cost":1.7976931348623157e308}]}
      """
    When the input snapshot is aggregated
    Then the agent "alpha" shall have no known reported cost and be incomplete
    And the reported cost summary shall be incomplete
