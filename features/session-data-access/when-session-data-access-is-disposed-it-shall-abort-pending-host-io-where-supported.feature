@ears:event-driven @component:session-data-access @interface:opencode-session-data @refresh-coalescing
Feature: When session data access is disposed, it shall abort pending host IO where supported

  Scenario Outline: A pending host read supports abort signals
    Given a controlled traversal host for refresh coalescing
    When session data access is disposed during an abortable "<operation>" host read
    Then the pending host read shall receive an abort signal

    Examples:
      | operation |
      | get       |
      | list      |
      | messages  |
      | log       |
