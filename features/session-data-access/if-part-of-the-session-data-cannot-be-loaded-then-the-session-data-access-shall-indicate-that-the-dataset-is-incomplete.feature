@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If part of the session data cannot be loaded, then the session data access shall indicate that the dataset is incomplete

  Scenario: A descendant history fails after a successful earlier refresh
    Given the session data host fixture "partial failure"
    When a descendant history fails during refresh
    Then the session data outcome shall match "partial failure"
