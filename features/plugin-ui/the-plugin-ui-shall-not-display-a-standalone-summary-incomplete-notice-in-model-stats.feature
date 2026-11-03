@ears:ubiquitous @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-48
Feature: The plugin UI shall not display a standalone "Summary incomplete" notice in Model stats

  Scenario: A data-access gap does not create a separate summary notice
    Given the Agent stats host fixture "partial failure"
    When the Agent stats session is displayed
    Then the sidebar shall omit a standalone "Summary incomplete" notice in Model stats

  Scenario: A known partial model total uses its row marker without a separate notice
    Given the Agent stats host fixture "model incomplete"
    When the Agent stats session is displayed
    Then the sidebar shall omit a standalone "Summary incomplete" notice in Model stats

  Scenario: A row label containing the notice text remains an ordinary cost row
    Given the Agent stats host fixture "model notice label"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model              | cost  |
      | Summary incomplete | $1.00 |
    And the sidebar shall omit a standalone "Summary incomplete" notice in Model stats
