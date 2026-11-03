@ears:ubiquitous @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-47
Feature: The plugin UI shall not display a standalone "Summary incomplete" notice in Agent stats

  Scenario: A partial history failure preserves known costs without a summary notice
    Given the Agent stats host fixture "partial failure"
    When the Agent stats session is displayed
    Then the sidebar shall show agent "alpha" with reported cost 1
    And the sidebar shall omit the standalone "Summary incomplete" notice

  Scenario: A known partial agent total keeps its marker without a summary notice
    Given the Agent stats host fixture "incomplete"
    When the Agent stats session is displayed
    Then the sidebar shall identify agent "partial" as incomplete
    And the sidebar shall omit the standalone "Summary incomplete" notice

  Scenario: A recorded agent named "Summary incomplete" remains a cost row without a standalone notice
    Given the Agent stats host fixture "summary incomplete agent"
    When the Agent stats session is displayed
    Then the sidebar agent rows shall be:
      | agent              | cost |
      | Summary incomplete | 1    |
    And the sidebar shall omit the standalone "Summary incomplete" notice

  Scenario: Loading history remains distinct without a summary notice
    Given the Agent stats host fixture "blocked history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as loading rather than empty
    And the sidebar shall omit the standalone "Summary incomplete" notice

  Scenario: Empty history remains distinct without a summary notice
    Given the Agent stats host fixture "empty history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as empty rather than loading
    And the sidebar shall omit the standalone "Summary incomplete" notice

  Scenario: Unavailable history remains distinct without a summary notice
    Given the Agent stats host fixture "unavailable history"
    When the Agent stats session is displayed
    Then the sidebar shall identify history as unavailable rather than empty
    And the sidebar shall omit the standalone "Summary incomplete" notice
