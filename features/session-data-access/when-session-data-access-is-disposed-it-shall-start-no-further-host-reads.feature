@ears:event-driven @component:session-data-access @interface:opencode-session-data @refresh-coalescing
Feature: When session data access is disposed, it shall start no further host reads

  Scenario Outline: A pending read completes after disposal
    Given a controlled traversal host for refresh coalescing
    When session data access is disposed during a blocked "<operation>" host read
    Then no further traversal reads shall start after disposal

    Examples:
      | operation |
      | get       |
      | list      |
      | messages  |
      | log       |
