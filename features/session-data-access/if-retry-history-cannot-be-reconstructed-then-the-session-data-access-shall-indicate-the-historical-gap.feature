@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data @regression-issue-4
Feature: If retry history cannot be reconstructed, then the session data access shall indicate the historical gap

  Scenario: A persisted title event does not establish complete retry history
    Given an isolated regression session host
    When only a persisted title event is available for regression
    Then the regression retry history gap shall remain visible
