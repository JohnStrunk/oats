@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When a recorded usage event is available, the session data access shall expose the reported usage

  In OpenCode V2.0.32, these events are available only if durable log
  persistence supplies them; they are not live TUI data notifications.

  Scenario: Persisted title and compaction call usage is retained without counting the compaction summary twice
    Given the session data host fixture "usage events"
    When session data is refreshed twice
    Then title and compaction call records shall be present once each

  Scenario: Two persisted compaction calls are not counted again as their projected summary
    Given the session data host fixture "multi-call compaction"
    When session data is refreshed twice
    Then the persisted compaction calls shall not be duplicated by their summary
