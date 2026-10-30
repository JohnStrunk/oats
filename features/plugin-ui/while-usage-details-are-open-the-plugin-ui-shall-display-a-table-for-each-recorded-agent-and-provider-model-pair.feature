@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @details-issue-35
Feature: While usage details are open, the plugin UI shall display a table for each recorded agent and provider model pair

  Records from the displayed session and its descendants contribute once each.
  Providers sharing a model ID remain distinct. Missing identities are
  unattributed rather than assigned to a known agent or model.

  Scenario: Repeated records from the displayed subtree form one pair
    Given the usage details host fixture "single pair"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show the single scoped pair

  Scenario: Identical model IDs from different providers stay distinct
    Given the usage details host fixture "providers"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall distinguish the providers

  Scenario: Missing agent or model identity is not silently discarded
    Given the usage details host fixture "unattributed"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall preserve unattributed identities
