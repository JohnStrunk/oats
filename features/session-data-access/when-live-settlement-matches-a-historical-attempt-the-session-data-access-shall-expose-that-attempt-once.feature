@ears:event-driven @component:session-data-access @interface:opencode-session-data @regression-issue-4-boundaries
Feature: When live settlement matches a historical attempt, the session data access shall expose that attempt once

  Scenario: A terminal event and completed assistant message describe the same attempt
    Given an isolated regression session host
    When a historical completion is also delivered as a live settlement
    Then the matching historical and live settlement shall be represented once
