@ears:ubiquitous @component:session-data-access @interface:opencode-session-data @regression-issue-4
Feature: The session data access shall preserve distinct compactions with equal usage

  Live compaction terminal events report a compaction summary, not the
  individual provider calls that contributed to it.

  Scenario: A later live compaction has the same cost and tokens as an earlier summary
    Given an isolated regression session host
    When a later regression compaction has equal usage
    Then the regression compactions shall remain distinct
