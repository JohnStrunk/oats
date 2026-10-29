@ears:unwanted-behavior
@component:session-data-access
@interface:opencode-session-data
Feature: If the subtree node limit displaces a known child, then the session data access shall preserve its known record

  Scenario: A newly listed sibling consumes the final node before a previously confirmed child
    Given an isolated retention regression host for "node limit"
    When a new sibling displaces the confirmed child at the node limit
    Then the displaced child's record shall remain with an incomplete traversal indication
