@ears:state-driven @component:session-data-access @interface:opencode-tui
Feature: While no session is displayed, the session data access shall expose an empty dataset

  Scenario: Leaving a session clears its previously visible records
    Given the session data host fixture "switch"
    When the displayed route changes to home and session data is refreshed
    Then the session data outcome shall match "empty"

  Scenario: A reactive switch to home clears the dataset without an explicit refresh
    When the reactive host route switches to home
    Then the route probe shall observe an empty dataset

  Scenario: A blocked prior load cannot repopulate the dataset after leaving a session
    When the reactive host route leaves during initial loading
    Then the route probe shall observe an empty dataset
