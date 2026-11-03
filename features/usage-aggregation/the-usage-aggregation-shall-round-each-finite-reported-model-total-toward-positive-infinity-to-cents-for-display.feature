@ears:ubiquitous @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: The usage aggregation shall round each finite reported model total toward positive infinity to cents for display

  The aggregation sums the shortest decimal representations of finite reported
  costs before rounding once. Exact cents remain unchanged, positive
  sub-cent totals display as one cent, and negative totals round toward
  positive infinity.

  Scenario: Repeated fractional costs are summed before cent rounding
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"one","sessionID":"root","agent":"alpha","model":{"providerID":"provider-one","id":"sum-model"},"cost":0.009},{"id":"two","sessionID":"child","agent":"beta","model":{"providerID":"provider-two","id":"sum-model"},"cost":0.002},{"id":"tiny","sessionID":"root","agent":"gamma","model":{"providerID":"provider","id":"sub-cent-model"},"cost":0.000001},{"id":"negative","sessionID":"root","agent":"delta","model":{"providerID":"provider","id":"negative-model"},"cost":-0.01001},{"id":"exact","sessionID":"root","agent":"epsilon","model":{"providerID":"provider","id":"exact-model"},"cost":1.25}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model          | knownCost | incomplete | roundedCost |
      | sum-model      | 0.011     | false      | $0.02       |
      | sub-cent-model | 0.000001  | false      | $0.01       |
      | negative-model | -0.01001  | false      | $-0.01      |
      | exact-model    | 1.25      | false      | $1.25       |

  Scenario: Generated thousandth-cent totals retain upward rounding
    Then generated reported model-cost totals shall be rounded upward to whole cents
