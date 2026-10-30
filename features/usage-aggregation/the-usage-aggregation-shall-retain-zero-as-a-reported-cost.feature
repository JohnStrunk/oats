@ears:ubiquitous @component:usage-aggregation @interface:opencode-session-data
Feature: The usage aggregation shall retain zero as a reported cost

  Scenario: A reported zero is not the same as an absent cost
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[],"errors":[],"records":[{"id":"1","sessionID":"root","agent":"zero","cost":0},{"id":"2","sessionID":"root","agent":"missing","cost":null}]}
      """
    When the input snapshot is aggregated
    Then the agent "zero" shall have known reported cost 0
    And the agent "missing" shall have no known reported cost and be incomplete
