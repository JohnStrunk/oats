@ears:ubiquitous
@component:repo-infrastructure
@interface:cli
Feature: The repository documentation shall identify the configured OpenCode host pin as the supported host version

  Scenario: The architecture and developer prerequisites identify the current supported host
    When the repository host pin and supported host documentation are consulted
    Then the supported host documentation shall identify the configured OpenCode host pin
