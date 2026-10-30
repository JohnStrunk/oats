@ears:event-driven
@component:repo-infrastructure
@interface:cli
Feature: When the real-host contract is requested, the repository infrastructure shall validate the selected host against the configured OpenCode host pin

  Scenario: Matching and mismatching versions are distinguished after a host pin update
    When the real-host contract is requested against generated OpenCode host pins and selected host versions
    Then the real-host contract shall accept each matching version and reject each mismatching version before host startup

  Scenario: Leading-zero declarations are rejected even when the host reports the same version
    When the real-host contract is requested with leading-zero host pins and identically reporting hosts
    Then the host commands shall reject every leading-zero pin before host startup

  Scenario: Each maximum safe version component is accepted and each larger component is rejected
    When the real-host contract is requested with version components at and beyond the safe integer limit
    Then the host commands shall accept the safe limit and reject each overlarge component before host startup
