@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: If a model group's finite reported costs overflow, then the usage aggregation shall report an unknown incomplete total

  Scenario: A finite input pair with a non-finite sum is not reported as a known total
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"large-one","sessionID":"root","agent":"alpha","model":{"providerID":"provider","id":"overflow-model"},"cost":1.7976931348623157e+308},{"id":"large-two","sessionID":"child","agent":"beta","model":{"providerID":"provider","id":"overflow-model"},"cost":1.7976931348623157e+308},{"id":"large-negative-one","sessionID":"root","agent":"gamma","model":{"providerID":"provider","id":"negative-overflow-model"},"cost":-1.7976931348623157e+308},{"id":"large-negative-two","sessionID":"child","agent":"delta","model":{"providerID":"provider","id":"negative-overflow-model"},"cost":-1.7976931348623157e+308}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model          | knownCost | incomplete | roundedCost |
      | overflow-model | null      | true       | null        |
      | negative-overflow-model | null | true       | null        |
