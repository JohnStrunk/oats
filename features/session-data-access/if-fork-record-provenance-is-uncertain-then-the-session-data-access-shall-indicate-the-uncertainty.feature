@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If fork record provenance is uncertain, then the session data access shall indicate the uncertainty

  Scenario Outline: The source boundary is not a copied message identifier
    Given the session data host fixture "<fork>"
    When session data is refreshed
    Then fork provenance uncertainty shall be indicated

    Examples:
      | fork           |
      | fork before    |
      | fork through   |
      | ambiguous fork |
