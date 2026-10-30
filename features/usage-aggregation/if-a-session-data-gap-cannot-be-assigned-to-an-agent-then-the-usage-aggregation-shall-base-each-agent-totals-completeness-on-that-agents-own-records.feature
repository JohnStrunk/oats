@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If a session data gap cannot be assigned to an agent, then the usage aggregation shall base each agent total's completeness on that agent's own records

  Scenario: An unassignable history gap does not make every known agent incomplete
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[{"kind":"historical-usage-unavailable","sessionID":"child"}],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":2},{"id":"2","sessionID":"root","agent":"beta","cost":null}]}
      """
    When the input snapshot is aggregated
    Then the agent "alpha" shall have known reported cost 2
    And the agent "alpha" total shall be complete
    And the agent "beta" shall have no known reported cost and be incomplete
    And the reported cost summary shall be incomplete
