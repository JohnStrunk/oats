@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @sidebar-issue-48
Feature: While Model stats is expanded, the plugin UI shall show one row per recorded model identifier in the displayed session subtree regardless of provider or agent

  Model rows are identified and aggregated by recorded model ID. A matching
  catalogue name may supply the visible label, but catalogue-only models and
  the currently selected model do not add or replace recorded-usage rows.

  Scenario: Repeated recorded identifiers combine while catalogue-only models stay absent
    Given the Agent stats host fixture "model history"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model        | cost |
      | shared-model | 6    |
      | root-model   | 2    |
      | nested-model | 4    |
      | sibling-model | 5   |
