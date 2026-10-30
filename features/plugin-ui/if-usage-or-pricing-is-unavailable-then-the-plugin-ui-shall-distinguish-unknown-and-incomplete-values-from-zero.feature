@ears:unwanted-behavior @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @details-issue-35
Feature: If usage or pricing is unavailable, then the plugin UI shall distinguish unknown and incomplete values from zero

  Known partial values remain visible and are identified as incomplete with e.
  Unknown values are not represented as zero. A reported zero price or cost
  is not a guarantee that the provider charged nothing.

  Scenario: Missing usage and pricing remain unknown
    Given the usage details host fixture "unknown"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show unknown values and preserve partial reported cost

  Scenario: A missing token record does not erase the known token contribution
    Given the usage details host fixture "partial tokens"
    When the Agent stats session is displayed
    And the user clicks the usage details link
    Then the usage details modal shall show known partial tokens as incomplete
