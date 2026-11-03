@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: If a model group's reported costs include an unavailable value, then the usage aggregation shall retain its known partial total and mark the group incomplete

  An unavailable or non-finite reported cost contributes no known amount. A
  group with no finite reported cost has an unknown total, not a zero total.

  Scenario: Known partial and wholly unknown model totals remain distinct
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"partial-known","sessionID":"root","agent":"alpha","model":{"providerID":"provider-one","id":"partial-model"},"cost":2.5},{"id":"partial-missing","sessionID":"child","agent":"beta","model":{"providerID":"provider-two","id":"partial-model"},"cost":null},{"id":"partial-nonfinite","sessionID":"child","agent":"gamma","model":{"providerID":"provider-three","id":"partial-model"},"cost":1e309},{"id":"unknown","sessionID":"root","agent":"delta","model":{"providerID":"provider","id":"unknown-model"},"cost":null}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model         | knownCost | incomplete | roundedCost |
      | partial-model | 2.5       | true       | $2.50       |
      | unknown-model | null      | true       | null        |
