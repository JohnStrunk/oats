@ears:ubiquitous @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-54
Feature: The plugin UI shall display Agent and Model stats rows in descending reported-cost order

  Scenario: Agent rows sort by exact reported totals before rounding and retain incomplete, unattributed, and unknown-only groups
    Given the Agent stats host fixture "sorted costs"
    When the Agent stats session is displayed
    Then the Agent stats cost rows shall appear in this order:
      | row            | value       | marker |
      | tie-agent-z    | $4.00       | blank  |
      | tie-agent-a    | $4.00       | blank  |
      | partial-agent  | $3.14       | e      |
      | complete-tie-agent | $3.14     | blank  |
      | named-agent-tie | $2.75      | blank  |
      | Unattributed   | $2.75       | blank  |
      | agent-high     | $0.02       | blank  |
      | agent-low      | $0.02       | blank  |
      | agent-high-extra | $0.01     | blank  |
      | known-zero-agent | $0.00     | blank  |
      | negative-agent   | $-1.00    | blank  |
      | unknown-agent  | unavailable | blank  |

  Scenario: Model rows sort independently by exact totals and retain insertion order for ties
    Given the Agent stats host fixture "sorted costs"
    When the Agent stats session is displayed
    And the user toggles Agent stats using keyboard
    Then the Model stats cost rows shall appear in this order:
      | row            | value       | marker |
      | tie-model-z    | $4.00       | blank  |
      | tie-model-a    | $4.00       | blank  |
      | partial-model  | $3.14       | e      |
      | complete-tie-model | $3.14     | blank  |
      | named-model-tie | $2.75      | blank  |
      | Unattributed   | $2.75       | blank  |
      | model-high     | $0.02       | blank  |
      | model-low      | $0.02       | blank  |
      | known-zero-model | $0.00     | blank  |
      | negative-model   | $-1.00    | blank  |
      | unknown-model  | unavailable | blank  |

  Scenario: Generated null, zero, negative, boundary, and extreme costs remain ordered in both stats tables
    Given the Agent stats host fixture "history"
    When the Agent stats session is displayed
    Then generated sidebar cost rows shall remain in exact descending order
