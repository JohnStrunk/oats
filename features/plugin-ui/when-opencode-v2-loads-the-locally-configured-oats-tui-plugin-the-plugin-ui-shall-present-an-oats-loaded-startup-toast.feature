@ears:event-driven
@component:plugin-ui
@interface:opencode-tui
Feature: When OpenCode V2 loads the locally configured OATS TUI plugin, the plugin UI shall present an "OATS loaded" startup toast

  As an OATS developer
  I want confirmation that the locally configured plugin started
  So that I can verify the plugin is loaded by the real TUI host

  Scenario: The locally configured plugin starts in the TUI
    Given the OATS plugin is locally configured for an isolated OpenCode V2 TUI
    When the isolated OpenCode TUI starts
    Then the TUI shall display the "OATS loaded" startup toast

  Scenario: The smoke test does not observe the toast without the plugin
    Given no plugin is configured for an isolated OpenCode V2 TUI
    When the isolated OpenCode TUI starts
    Then the TUI shall start without displaying the "OATS loaded" startup toast

  Scenario: An ancestor plugin cannot impersonate the configured OATS plugin
    Given a hostile ancestor plugin displays the same startup toast
    And the OATS plugin is locally configured for an isolated OpenCode V2 TUI
    When the isolated OpenCode TUI starts
    Then the TUI shall display the "OATS loaded" startup toast
    Given no plugin is configured for an isolated OpenCode V2 TUI
    When the isolated OpenCode TUI starts
    Then the TUI shall start without displaying the "OATS loaded" startup toast
    When the isolated OpenCode TUI starts with the OATS entrypoint removed
    Then the TUI shall start without displaying the "OATS loaded" startup toast
    When the OpenCode TUI explicitly loads the hostile plugin without OATS
    Then the TUI shall display the "OATS loaded" startup toast
