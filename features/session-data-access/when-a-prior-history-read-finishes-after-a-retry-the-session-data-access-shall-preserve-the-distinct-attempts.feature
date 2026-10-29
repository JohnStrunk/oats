@ears:event-driven @component:session-data-access @interface:opencode-session-data @followup-major
Feature: When a prior history read finishes after a retry, the session data access shall preserve the distinct attempts

  Scenario Outline: A stale initial response follows a retry terminal
    Given an independent follow-up session host
    When the follow-up host runs the "<case>" case
    Then the follow-up snapshot shall satisfy the "<case>" case

    Examples:
      | case                   |
      | delayed retry success  |
      | delayed retry failure  |
