@ears:unwanted-behavior
@component:repo-infrastructure
@interface:cli
Feature: If a real-host contract test cannot run, then the repository infrastructure shall return a nonzero test command exit status

  Scenario Outline: An explicitly selected host cannot be used
    When the real-host contract test is requested with <host> host
    Then the real-host test command shall fail without launching another host

    Examples:
      | host    |
      | no      |
      | missing |
      | wrong   |
      | relative |
