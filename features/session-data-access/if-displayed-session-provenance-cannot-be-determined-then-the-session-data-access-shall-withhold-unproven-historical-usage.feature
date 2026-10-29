@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If displayed session provenance cannot be determined, then the session data access shall withhold unproven historical usage

  Scenario Outline: Missing fork metadata cannot turn copied history into fresh usage
    Given a displayed fork whose session lookup initially <lookup>
    When the fork is refreshed before and after session lookup recovery
    Then the uncertain fork snapshot shall withhold unproven historical usage

    Examples:
      | lookup    |
      | fails     |
      | is absent |

  Scenario Outline: Unavailable root metadata is explicitly identified as incomplete
    Given a displayed fork whose session lookup initially <lookup>
    When the fork is refreshed before and after session lookup recovery
    Then the uncertain fork snapshot shall identify the missing session lookup

    Examples:
      | lookup    |
      | fails     |
      | is absent |

  Scenario Outline: Successful lookup recovers descendant history while retaining fork uncertainty
    Given a displayed fork whose session lookup initially <lookup>
    When the fork is refreshed before and after session lookup recovery
    Then the recovered fork snapshot shall contain only proven descendant history

    Examples:
      | lookup    |
      | fails     |
      | is absent |
