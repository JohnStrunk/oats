@ears:event-driven
@component:session-data-access
@interface:opencode-session-data
Feature: When an unrelated child compaction call is recorded, the session data access shall expose it alongside the root summary

  Scenario: A root compaction summary does not suppress an unframed child event
    Given an isolated retention regression host for "separate compactions"
    When a root compaction summary and unrelated child compaction event are refreshed
    Then both the root summary and the child event shall remain independently countable
