@ears:complex @component:session-data-access @interface:opencode-session-data @refresh-coalescing
Feature: While a session tree load is pending, when structure events arrive, the session data access shall coalesce their refresh work

  Scenario: Bursts during a blocked load are bounded and eventually include the change
    Given a controlled traversal host for refresh coalescing
    When generated bursts of in-scope structure events arrive during a blocked load
    Then each burst shall require at most one follow-up load and expose the new descendant
