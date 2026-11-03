@ears:ubiquitous @component:usage-aggregation @interface:opencode-session-data @sidebar-issue-48
Feature: The usage aggregation shall retain zero as a known reported model cost

  Scenario: A reported zero remains a known complete total
    Given this aggregation input snapshot:
      """json
      {"sessionID":"root","complete":true,"gaps":[],"errors":[],"records":[{"id":"zero","sessionID":"root","agent":"alpha","model":{"providerID":"provider","id":"free-recorded-model"},"cost":0}]}
      """
    When the input snapshot is aggregated by recorded model identifier
    Then the reported model costs shall match:
      | model               | knownCost | incomplete | roundedCost |
      | free-recorded-model | 0         | false      | $0.00       |
