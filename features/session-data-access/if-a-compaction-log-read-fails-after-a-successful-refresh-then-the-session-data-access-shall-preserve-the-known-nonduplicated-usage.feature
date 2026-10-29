@ears:unwanted-behavior @component:session-data-access @interface:opencode-session-data @regression-compaction-log-failure
Feature: If a compaction log read fails after a successful refresh, then the session data access shall preserve the known nonduplicated usage

  Scenario Outline: A later transient log failure does not recount a previously resolved compaction
    Given an independent follow-up session host
    And a persisted multi-call compaction and its completed summary
    When the completed compaction is initially refreshed
    Then the initial compaction snapshot shall contain the two individual calls without their aggregate
    When the next compaction log read has a transient "<failure>"
    Then the failed compaction log read shall be visible as incomplete
    And the known compaction calls shall remain without counting their aggregate again

    Examples:
      | failure |
      | error   |
      | stall   |
