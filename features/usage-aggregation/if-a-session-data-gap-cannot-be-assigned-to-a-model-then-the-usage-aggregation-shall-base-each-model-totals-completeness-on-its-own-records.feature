@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: If a session-data gap cannot be assigned to a model, then the usage aggregation shall base each model total's completeness on its own records

  Scenario: An unassigned history gap affects the summary without marking known model rows incomplete
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":false,"gaps":[{"kind":"historical-usage-unavailable","sessionID":"child"}],"errors":[],"records":[{"id":"first","sessionID":"root","agent":"alpha","model":{"providerID":"provider","id":"first-model"},"cost":2},{"id":"second","sessionID":"child","agent":"beta","model":{"providerID":"provider","id":"second-model"},"cost":3}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model        | knownCost | incomplete | roundedCost |
      | first-model  | 2         | false      | $2.00       |
      | second-model | 3         | false      | $3.00       |
    And the reported model cost summary shall be incomplete
