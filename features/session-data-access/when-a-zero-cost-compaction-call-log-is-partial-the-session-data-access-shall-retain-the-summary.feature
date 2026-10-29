@ears:event-driven @component:session-data-access @interface:opencode-session-data @followup-major
Feature: When a zero-cost compaction call log is partial, the session data access shall retain the summary

  Scenario: Equal zero costs do not establish that all token usage is logged
    Given an independent follow-up session host
    When the follow-up host runs the "partial zero cost" case
    Then the follow-up snapshot shall satisfy the "partial zero cost" case
