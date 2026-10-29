@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data @issue-4-followup-boundaries
Feature: If a parent listing fails, then the session data access shall withhold new unverified descendant history

  Scenario: A stale child link does not establish a newly found grandchild is in scope
    Given a session tree host with confirmed prior records
    When the root listing fails after its child gains a new grandchild
    Then previously confirmed records shall remain without the unverified grandchild history
