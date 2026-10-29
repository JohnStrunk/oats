@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When separate step attempts settle, the session data access shall expose them as distinct records

  Scenario: A failed attempt and its retry reuse one assistant message identifier
    Given the session data host fixture "retry attempts"
    When a failed step and a retry settle for the same assistant message
    Then both step attempt records shall remain distinct after a refresh
