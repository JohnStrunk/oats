@ears:event-driven @component:session-data-access @interface:opencode-session-data @regression-issue-4
Feature: When a retry starts, the session data access shall not assign its identity to an earlier attempt

  Scenario: A retry has a known identity but the earlier start was not observed
    Given an isolated regression session host
    When a regression retry starts after an unidentified failure
    Then the regression failure identity shall not be invented

  Scenario: Different identities remain attached to their own attempts
    Given an isolated regression session host
    When a regression retry starts after an identified failure
    Then the regression attempts shall retain their distinct identities
