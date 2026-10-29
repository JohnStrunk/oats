@ears:event-driven @component:session-data-access @interface:opencode-session-data @followup-major
Feature: When a later compaction has equal usage, the session data access shall retain an unrelated earlier summary

  Scenario: Equal values do not establish operation identity
    Given an independent follow-up session host
    When the follow-up host runs the "unrelated equal usage" case
    Then the follow-up snapshot shall satisfy the "unrelated equal usage" case
