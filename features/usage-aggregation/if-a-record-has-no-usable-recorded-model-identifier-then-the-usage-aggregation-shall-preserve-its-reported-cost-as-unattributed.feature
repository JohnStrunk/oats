@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: If a record has no usable recorded model identifier, then the usage aggregation shall preserve its reported cost as unattributed

  A usable identifier is a non-empty string. A provider identifier alone does
  not attribute a reported cost to a model.

  Scenario: Missing, blank and non-string identifiers share the unattributed group
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"missing","sessionID":"root","agent":"alpha","model":null,"cost":2},{"id":"blank","sessionID":"root","agent":"beta","model":{"providerID":"provider","id":""},"cost":3},{"id":"whitespace","sessionID":"child","agent":"gamma","model":{"providerID":"provider","id":"   "},"cost":null},{"id":"non-string","sessionID":"child","agent":"delta","model":{"providerID":"provider","id":17},"cost":4},{"id":"provider-only","sessionID":"child","agent":"epsilon","model":{"providerID":"provider"},"cost":0}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model        | knownCost | incomplete | roundedCost |
      | Unattributed | 9         | true       | $9.00       |
