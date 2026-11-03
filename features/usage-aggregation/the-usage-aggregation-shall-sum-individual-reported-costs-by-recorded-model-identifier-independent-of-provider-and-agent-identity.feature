@ears:ubiquitous @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: The usage aggregation shall sum individual reported costs by recorded model identifier independent of provider and agent identity

  The session-data snapshot is already scoped to the displayed session and its
  descendants. The model identifier on each record, rather than its provider or
  executing agent, determines its model-cost group.

  Scenario: The same recorded model identifier groups costs from different providers, agents and descendants
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"r1","sessionID":"root","agent":"alpha","model":{"providerID":"provider-one","id":"shared-model"},"cost":1},{"id":"r2","sessionID":"child","agent":"beta","model":{"providerID":"provider-two","id":"shared-model"},"cost":2},{"id":"r3","sessionID":"grandchild","agent":"gamma","model":{"providerID":"provider-three","id":"shared-model"},"cost":3},{"id":"r4","sessionID":"root","agent":"alpha","model":{"providerID":"provider-one","id":"other-model"},"cost":5}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model        | knownCost | incomplete | roundedCost |
      | shared-model | 6         | false      | $6.00       |
      | other-model  | 5         | false      | $5.00       |

  Scenario: Generated records preserve identity grouping and cost completeness
    Then generated model-cost records shall preserve recorded-identity grouping and completeness
