@ears:unwanted-behavior @component:usage-aggregation @interface:opencode-session-data
Feature: If a retry projection has ambiguous usage, then the usage aggregation shall mark the overall cost summary incomplete

  A retry gap names the message, not the agent for the uncertain attempt. It
  cannot be assigned to the prior attempt's agent merely because the message
  identifier is shared.

  Scenario: A running retry with a different agent leaves prior usage attributed
    Given an isolated regression session host
    When a retry starts after known historical usage
    And the running retry projection is refreshed before its terminal event
    Then the session data snapshot shall contain a retry ambiguity gap
    When the current session snapshot is aggregated
    Then the reported agent costs shall match:
      | agent       | knownCost |
      | first-agent | 3         |
    And the agent "first-agent" total shall be complete
    And the reported cost summary shall be incomplete
