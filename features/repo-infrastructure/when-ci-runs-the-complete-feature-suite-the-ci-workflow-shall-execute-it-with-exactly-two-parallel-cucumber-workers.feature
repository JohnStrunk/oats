@ears:event-driven
@component:repo-infrastructure
@interface:github-actions
@interface:cli
Feature: When CI runs the complete feature suite, the CI workflow shall execute it with exactly two parallel Cucumber workers

  As a repository maintainer
  I want CI to run the complete feature suite with two Cucumber workers
  So that verification wall-clock time drops without changing the local default run

  Parallelism is requested only by the CI invocation. The local
  `npm run test:features` default remains the unchanged, serial `cucumber-js`
  invocation, so contributors see the same local behavior as before.

  Scenario: The CI feature-test step requests exactly two Cucumber workers
    When the repository CI workflow is inspected
    Then the CI feature-test step shall run exactly npm run test:features -- --parallel 2 unconditionally
