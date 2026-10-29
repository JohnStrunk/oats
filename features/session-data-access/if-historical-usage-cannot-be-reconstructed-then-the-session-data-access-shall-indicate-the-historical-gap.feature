@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If historical usage cannot be reconstructed, then the session data access shall indicate the historical gap

  Scenario: History remains usable when the host retains messages but not durable events
    Given the session data host fixture "recorded identities"
    When session data is refreshed
    Then the session data outcome shall match "recorded identities"
    And the historical usage gap shall be indicated without invented records
