@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data
Feature: If a host read does not terminate, then the session data access shall complete the refresh with an incomplete indication

  Scenario Outline: A stalled or unending host read is bounded
    Given a session host with known records and controlled read limits
    When the host has a <fault> during refresh
    Then the refresh shall finish within the test deadline and identify the incomplete <operation> read

    Examples:
      | fault                 | operation    |
      | endless message pages | message.list |
      | endless child pages   | session.list |
      | stalled message page  | message.list |
      | stalled child page    | session.list |
      | stalled session log   | session.log  |
      | endless session log   | session.log  |
