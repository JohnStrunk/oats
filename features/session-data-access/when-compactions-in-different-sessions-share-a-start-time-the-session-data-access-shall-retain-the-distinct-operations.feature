@ears:event-driven @component:session-data-access @interface:opencode-session-data @followup-major
Feature: When compactions in different sessions share a start time, the session data access shall retain the distinct operations

  Scenario Outline: Independent compactions remain associated with their sessions
    Given an independent follow-up session host
    When the follow-up host runs the "<case>" case
    Then the follow-up snapshot shall satisfy the "<case>" case

    Examples:
      | case                          |
      | cross-session timestamp       |
      | cross-session live projection |
