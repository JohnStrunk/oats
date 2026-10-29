@ears:event-driven @component:session-data-access @interface:opencode-session-data @regression-issue-4-boundaries
Feature: When a retry fails without usage, the session data access shall preserve the prior usage and the retry gap

  Scenario: Refresh does not copy prior usage to a failed retry
    Given an isolated regression session host
    When a retry starts after known historical usage
    Then the known prior attempt shall retain its identity at retry start
    When the retry fails without usage and the session data is refreshed
    Then the prior usage and the retry usage gap shall remain distinct
