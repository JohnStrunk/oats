@ears:event-driven @component:session-data-access @interface:opencode-session-data @issue-4-stale-lineage-regression
Feature: When authoritative lineage places a known descendant under a removed child, the session data access shall exclude its records

  # This defensive fixture models a hierarchy change between reads; OpenCode
  # v2.0.32 has no supported API to reparent an existing session.
  Scenario Outline: A failed sibling listing cannot override a known removed lineage
    Given a session tree with a known descendant under a sibling
    When the synthetic hierarchy is refreshed in the "<case>" case
    Then the resulting lineage snapshots shall satisfy the "<case>" case

    Examples:
      | case                         |
      | authoritative moved lineage  |
      | no authoritative exclusion   |
