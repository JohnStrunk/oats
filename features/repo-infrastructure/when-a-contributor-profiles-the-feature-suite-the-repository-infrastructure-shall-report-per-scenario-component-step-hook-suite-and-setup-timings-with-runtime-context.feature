@ears:event-driven
@component:repo-infrastructure
@interface:cli
Feature: When a contributor profiles the feature suite, the repository infrastructure shall report per-scenario, component, step, hook, suite, and setup timings with runtime context

  As a repository contributor
  I want to profile a feature suite on demand
  So that I can locate slow scenarios without changing routine CI output

  The public invocation is `node scripts/profile-features.js` from the checkout
  being profiled. This opt-in command is separate from the routine
  `npm run test:features` invocation and does not change its CI output.

  Per-scenario elapsed time is derived from each `TestCaseStarted` and
  `TestCaseFinished` timestamp pair. Component totals are the sum of elapsed
  scenario times grouped by the scenarios' `@component` tags. Per-scenario
  Gherkin-step times are the sum of Cucumber step-result durations;
  scenario-hook times are the sum of separate before/after scenario-hook
  results. The pinned Cucumber.js version folds `BeforeStep` and `AfterStep`
  hook durations into their Gherkin step result. The report distinguishes those
  included step-hook costs from the separately measured scenario-hook totals
  and does not claim separate before/after-step measurements.
  Each report metric is associated with its scenario or component and a
  unit-bearing duration value.

  The complete-suite elapsed time is measured around `npm run test:features`.
  Residual setup/framework overhead is the nonnegative difference, clamped at
  zero when required, between that elapsed time and the sum of scenario elapsed
  times. Cucumber message timestamps
  alone do not cover Node startup, support-code loading, or feature parsing,
  because `TestRunStarted` is emitted after that setup; the complete-suite
  elapsed time therefore uses the child-process wall-clock boundary.

  Cucumber message metadata provides the Cucumber.js and Node versions, OS
  name/release, CPU architecture, and optional CI provider name, build URL and
  number, and Git remote, revision, branch, or tag when detected. The report
  includes detected metadata. Cucumber messages do not identify a hosted runner
  image or runner label, so those values are not claimed from that source.

  # One-time issue #50 comparison evidence (not routine CI): collect at least
  # three comparable CI runs for each revision using the same job, runner image,
  # runtime/tool versions, suite scope, and profiler invocation. Retain every
  # timing from every run; for each timing metric, report all run values, the
  # median, and the observed min-to-max range. Record the method, revision,
  # runner image/label, and runtime context; capture runner details from the CI
  # job because Cucumber messages do not expose them. Call an improvement clear
  # only when the optimized median is below the fastest baseline run.

  Scenario: The profiler reports the full breakdown for a temporary suite
    Given a temporary feature-suite checkout with two components, three timed scenarios, and before and after hooks
    When the contributor runs the on-demand profiler in that checkout
    Then the routine-suite control shall expose timing metrics and the profiler shall return a zero exit status
    And the profile report shall include scenario and component timing totals
    And the profile report shall include per-scenario step and scenario-hook costs, suite residual timing, and runtime context
