@ears:event-driven @component:session-data-access @interface:opencode-session-data
Feature: When only aggregate session usage is reported, the session data access shall preserve uncertainty about individual usage

  Scenario: An aggregate update cannot establish the cost of a title call
    Given an isolated regression session host
    When the host reports only an aggregate usage update
    Then no individual title cost shall be invented
