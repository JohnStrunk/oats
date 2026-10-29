@ears:event-driven @component:session-data-access @interface:opencode-session-data @regression-issue-4
Feature: When a live retry settles, the session data access shall preserve known prior usage

  Scenario: The same assistant message has a known historical attempt before the retry
    Given an isolated regression session host
    When a live regression retry follows known history
    Then the known regression usage shall not disappear
