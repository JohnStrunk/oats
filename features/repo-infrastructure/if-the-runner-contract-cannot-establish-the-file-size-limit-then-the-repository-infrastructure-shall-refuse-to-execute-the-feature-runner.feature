@ears:unwanted-behavior @component:repo-infrastructure @interface:cli
Feature: If the runner contract cannot establish the file-size limit, then the repository infrastructure shall refuse to execute the feature runner

  Scenario: The inherited hard limit prevents establishing the required ceiling
    When the runner contract is invoked with a zero-byte hard file-size limit
    Then the feature runner shall not execute its sandbox scenario
