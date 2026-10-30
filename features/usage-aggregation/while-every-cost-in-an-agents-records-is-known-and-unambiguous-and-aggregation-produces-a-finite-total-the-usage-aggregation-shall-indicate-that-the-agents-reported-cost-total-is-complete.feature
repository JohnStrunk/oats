@ears:state-driven @component:usage-aggregation @interface:opencode-session-data
Feature: While every cost in an agent's records is known and unambiguous and aggregation produces a finite total, the usage aggregation shall indicate that the agent's reported cost total is complete

  Completeness concerns the reported costs in the agent's known records. A
  reported zero does not establish that a provider charged nothing.
  Totals use supported numeric aggregation without a guarantee of arbitrary
  precision or a particular summation order.

  Scenario: Zero alone does not make a reported cost total incomplete
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"zero","cost":0}]}
      """
    When the input snapshot is aggregated
    Then the agent "zero" shall have known reported cost 0
    And the agent "zero" total shall be complete

  Scenario: A different agent's missing cost does not affect a reported zero
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"zero","cost":0},{"id":"2","sessionID":"root","agent":"missing","cost":null}]}
      """
    When the input snapshot is aggregated
    Then the agent "zero" shall have known reported cost 0
    And the agent "zero" total shall be complete
    And the agent "missing" shall have no known reported cost and be incomplete

  Scenario: A missing token report is not itself a missing cost
    Given the session data host fixture "recorded identities"
    And the host has a known cost with unavailable tokens
    When session data is refreshed
    Then the session data snapshot shall contain a token-only usage gap
    When the current session snapshot is aggregated
    Then the agent "alpha" shall have known reported cost 1
    And the agent "alpha" total shall be complete
    And the reported cost summary shall be incomplete
