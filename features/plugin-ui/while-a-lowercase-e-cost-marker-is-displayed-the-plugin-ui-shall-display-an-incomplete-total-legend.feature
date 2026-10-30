@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @sidebar-issue-34
Feature: While a lowercase e cost marker is displayed, the plugin UI shall display an incomplete total legend

  The legend is exactly "e = incomplete total" and appears only when at least
  one cost row has an e marker. Summary-level gaps alone do not add a legend.

  Scenario: A partial cost has a legend
    Given the Agent stats host fixture "aligned mixed"
    When the Agent stats session is displayed
    Then the sidebar shall show the e legend exactly once

  Scenario Outline: No marker means no legend
    Given the Agent stats host fixture "<fixture>"
    When the Agent stats session is displayed
    Then the sidebar shall not show an e legend

    Examples:
      | fixture          |
      | aligned complete |
      | aligned unknown  |
