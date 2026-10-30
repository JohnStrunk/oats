@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If an agent's reported cost is missing, then the usage aggregation shall indicate that the agent's total is incomplete

  Scenario: A known partial total is retained when another cost is missing
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":5},{"id":"2","sessionID":"root","agent":"alpha","cost":null}]}
      """
    When the input snapshot is aggregated
    Then the agent "alpha" shall have known reported cost 5 and be incomplete

  Scenario: Only missing cost is not represented as a known zero
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"alpha","cost":null}]}
      """
    When the input snapshot is aggregated
    Then the agent "alpha" shall have no known reported cost and be incomplete

  Scenario: A real upstream usage gap is linked to a known agent's missing cost
    Given the session data host fixture "missing and zero"
    And the host has a known agent with an unavailable reported cost
    When session data is refreshed
    Then the session data snapshot shall contain an attributable missing usage gap
    When the current session snapshot is aggregated
    Then the agent "alpha" shall have known reported cost 0 and be incomplete
