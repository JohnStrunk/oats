@ears:state-driven @component:session-data-access @interface:opencode-session-data
Feature: While a compaction usage summary is the only available record, the session data access shall expose the reported summary

  Scenario: The host retains the compaction message but no durable usage events
    Given the session data host fixture "compaction history"
    When session data is refreshed
    Then the available compaction summary shall be exposed without invented calls
