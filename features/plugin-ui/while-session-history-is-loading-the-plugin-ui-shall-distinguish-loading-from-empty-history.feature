@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-6
Feature: While session history is loading, the plugin UI shall distinguish loading from empty history

  An empty successful message read means no recorded messages were returned;
  it does not prove that all historical usage is known.

  Scenario: A blocked first read is not presented as empty
    Given the Agent stats host fixture "blocked history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as loading rather than empty

  Scenario: An empty history is not presented as loading
    Given the Agent stats host fixture "empty history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as empty rather than loading
    And the sidebar shall identify the overall summary as incomplete
