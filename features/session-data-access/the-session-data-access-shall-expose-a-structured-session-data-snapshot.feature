@ears:ubiquitous @component:session-data-access @interface:opencode-tui @interface:opencode-session-data
Feature: The session data access shall expose a structured session data snapshot

  The snapshot identifies the displayed session by sessionID. Its records
  collection contains individual records with distinct stable IDs, their
  owning sessionID and recorded agent, model, cost and tokens. Missing values
  are not zeroes. The snapshot also has a complete indication and collections
  of structured errors and gaps; each gap identifies its kind, and a failed
  load identifies its session and operation. Known errors or gaps make the
  snapshot incomplete. Without a displayed session, sessionID is absent,
  records, errors and gaps are empty, and the snapshot is complete.

  Scenario: A snapshot preserves individual recorded values and identities
    Given the session data host fixture "recorded identities"
    When session data is refreshed
    Then the session data outcome shall match "recorded identities"
    And the snapshot shall expose structured completeness information

  Scenario: Individual record IDs remain associated with their records across refreshes
    Given the session data host fixture "tree with paginated history"
    When the session data snapshot is captured before and after refresh
    Then the record IDs shall remain associated with the same records

  Scenario: A failed descendant load is represented alongside known records
    Given the session data host fixture "partial failure"
    When a descendant history fails during refresh
    Then the session data outcome shall match "partial failure"
    And the snapshot shall expose structured completeness information
    And the snapshot shall identify the failed descendant load

  Scenario: An absent value remains distinct from a recorded zero
    Given the session data host fixture "missing and zero"
    When session data is refreshed
    Then the session data outcome shall match "missing and zero"
    And the snapshot shall expose structured completeness information

  Scenario: Leaving a session clears the snapshot scope
    Given the session data host fixture "switch"
    When the displayed route changes to home and session data is refreshed
    Then the session data outcome shall match "empty"
    And the snapshot shall expose structured completeness information
