@ears:complex @component:session-data-access @interface:opencode-session-data @regression-issue-4-boundaries
Feature: While a subtree is loading, when usage settles, the session data access shall expose only that subtree's settlements

  Scenario: Nested descendant and unrelated sessions settle while the root loads
    Given an isolated host with a blockable message read
    When nested and unrelated settlements arrive during root loading
    Then only the nested settlement shall be retained in the root dataset
