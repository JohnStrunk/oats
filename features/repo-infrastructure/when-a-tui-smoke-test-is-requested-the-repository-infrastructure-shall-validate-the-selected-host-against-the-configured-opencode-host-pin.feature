@ears:event-driven
@component:repo-infrastructure
@interface:cli
@interface:opencode-tui
Feature: When a TUI smoke test is requested, the repository infrastructure shall validate the selected host against the configured OpenCode host pin

  Scenario: A changed host pin governs TUI smoke test version selection
    When a TUI smoke test is requested against an updated OpenCode host pin and selected host versions
    Then the TUI smoke test shall accept the matching version and reject mismatching versions before host startup

  Scenario: Leading-zero declarations are rejected even when the host reports the same version
    When a TUI smoke test is requested with leading-zero host pins and identically reporting hosts
    Then the host commands shall reject every leading-zero pin before host startup

  Scenario: Each maximum safe version component is accepted and each larger component is rejected
    When a TUI smoke test is requested with version components at and beyond the safe integer limit
    Then the host commands shall accept the safe limit and reject each overlarge component before host startup
