@ears:complex @component:session-data-access @interface:opencode-session-data @regression-issue-4
Feature: While the displayed subtree is loading, when descendant usage settles, the session data access shall retain the settlement

  Scenario Outline: A child settles before its membership is committed
    Given an isolated regression session host
    When descendant usage settles during "<phase>" regression loading
    Then the regression descendant settlement shall remain visible

    Examples:
      | phase           |
      | initial subtree |
      | child creation  |
