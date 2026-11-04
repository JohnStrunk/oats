@ears:state-driven @component:plugin-ui @interface:opencode-tui @interface:opencode-session-data @interface:opencode-model-pricing @sidebar-issue-47 @sidebar-issue-48 @sidebar-issue-56
Feature: While Model stats is expanded, the plugin UI shall label each recorded model ID row with the model catalogue name matching the earliest recorded usage provider or with the recorded model ID when no such name is available

  Model rows remain identified and aggregated by recorded model ID. The matching
  catalogue entry has that ID and the provider recorded on the earliest usage
  record for the row. Catalogue-only models do not create rows.

  Scenario: Catalogue names label recorded IDs while duplicate names stay distinct and unavailable names fall back
    Given the Agent stats host fixture "model catalogue labels"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model               | cost |
      | Shared Name #1      | 3    |
      | Shared Name #2      | 5    |
      | First Provider Name | 3   |
      | no-entry-id         | 9    |
      | no-name-id          | 11   |
      | empty-name-id       | 4    |
      | whitespace-name-id  | 6    |

  Scenario: The asynchronous client catalogue labels a grouped recorded ID after its response
    Given the Agent stats host fixture "async client model catalogue"
    When the Agent stats session is displayed
    Then the sidebar model rows shall be:
      | model                | cost |
      | Async Catalogue Name | 5    |
