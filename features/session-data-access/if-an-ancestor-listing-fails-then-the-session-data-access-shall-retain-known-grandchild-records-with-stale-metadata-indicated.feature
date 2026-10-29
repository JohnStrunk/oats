@ears:unwanted-behavior
@component:session-data-access
@interface:opencode-session-data
Feature: If an ancestor listing fails, then the session data access shall retain known grandchild records with stale metadata indicated

  Scenario: An unverified child no longer lists a previously confirmed grandchild
    Given an isolated retention regression host for "stale grandchild"
    When the root listing fails and the stale child no longer lists the grandchild
    Then the known grandchild record shall remain with a stale metadata gap
