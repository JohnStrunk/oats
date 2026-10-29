@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If a host pagination cursor repeats before completion, then the session data access shall indicate the incomplete read

  Scenario Outline: A repeated nonterminal cursor does not imply complete history
    Given a session host with known records and controlled read limits
    When the host has a <fault> during refresh
    Then the refresh shall finish within the test deadline and identify the incomplete <operation> read

    Examples:
      | fault                  | operation    |
      | repeated message page  | message.list |
      | repeated child page    | session.list |

  Scenario: Repeated opaque cursors of varied values do not imply completion
    When the host repeats generated nonterminal message cursors across refreshes
    Then every generated cursor read shall be incomplete without losing known records
