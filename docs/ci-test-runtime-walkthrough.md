# CI Test Runtime Profile Walkthrough

<!-- markdownlint-disable MD036 -->
*2026-11-03T22:06:11Z by Showboat 0.6.1*
<!-- markdownlint-enable MD036 -->
<!-- showboat-id: 12a9b101-3c25-46be-8bc2-faf4f4a5e0a3 -->

## Why

Issue #50 adds an opt-in [feature-suite profiler](../scripts/profile-features.js#L81-L140) that reports timings from Cucumber messages. This walkthrough exercises the public `node scripts/profile-features.js` command; the [report formatter](../scripts/profile-report.js#L197-L240) supplies the scenario and component summary.

## Synthetic fixture and limits

The temporary fixture contains two scenarios tagged `@component:synthetic-alpha` and `@component:synthetic-beta`. Each has three short async steps and short Cucumber `Before`/`After` hooks. Its `scripts/` and `node_modules/` entries link to this checkout, so the demo uses the real profiler and installed dependencies. The fixture files and directory are removed when the command exits.

This fixture is synthetic and is **not performance evidence**. Captured millisecond values are normalized to `<measured> ms` because timings vary between runs; the report structure, scenario/component names, and actual command exit status are retained. The full-suite CI/local benchmark is documented separately in the PR body.

## Reproduce

From the repository root, run `uvx showboat verify docs/ci-test-runtime-walkthrough.md` to repeat the fixture. The filter keeps the concise profiler summary. It saves Node's status from Bash `PIPESTATUS` before returning it, so a failing profiler run cannot be masked by the output filter.

```bash
set -euo pipefail
repo="$(git rev-parse --show-toplevel)"
if [ -d /tmp/opencode ]; then
  temp_root=/tmp/opencode
else
  temp_root="${TMPDIR:-/tmp}"
fi
fixture="$(mktemp -d "$temp_root/oats-ci-runtime-demo.XXXXXX")"
trap 'rm -rf -- "$fixture"' EXIT

mkdir -p "$fixture/features/support"
ln -s "$repo/scripts" "$fixture/scripts"
ln -s "$repo/node_modules" "$fixture/node_modules"
cat > "$fixture/package.json" <<'EOF'
{"private":true,"type":"module","scripts":{"test:features":"cucumber-js"}}
EOF
cat > "$fixture/cucumber.js" <<'EOF'
export default {
  import: ['features/support/**/*.js'],
}
EOF
cat > "$fixture/features/synthetic.feature" <<'EOF'
Feature: Temporary synthetic profile fixture

  @component:synthetic-alpha
  Scenario: Alpha component timing
    Given a short synthetic setup
    When a short synthetic action runs
    Then the synthetic result is ready

  @component:synthetic-beta
  Scenario: Beta component timing
    Given a short synthetic setup
    When a short synthetic action runs
    Then the synthetic result is ready
EOF
cat > "$fixture/features/support/steps.js" <<'EOF'
import { After, Before, Given, Then, When } from '@cucumber/cucumber'

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

Before(async function () { await pause(2) })
After(async function () { await pause(2) })
Given('a short synthetic setup', async function () { await pause(2) })
When('a short synthetic action runs', async function () { await pause(2) })
Then('the synthetic result is ready', async function () { await pause(2) })
EOF

cd "$fixture"
set +e
node scripts/profile-features.js 2>&1 | awk '
  /^Feature-suite profile report$/ { in_report = 1 }
  !in_report { next }
  {
    line = $0
    gsub(/[0-9]+([.][0-9]+)? ms/, "<measured> ms", line)
    if (line ~ /^  Node\.js:/) sub(/^  Node\.js:.*/, "  Node.js: <runtime>", line)
    if (line ~ /^(Feature-suite profile report|  Test command exit:|Runtime context|  Cucumber\.js:|  Node\.js:|  CI provider:|Complete feature-suite elapsed:|Scenario elapsed total:|Residual setup\/framework overhead:|Per-scenario timings|Scenario elapsed|  Gherkin step time|  Scenario hook time|Component totals|Component total)/) print line
  }
'
pipeline_status=("${PIPESTATUS[@]}")
set -e
profiler_status="${pipeline_status[0]}"
filter_status="${pipeline_status[1]}"
printf '\nProfiler process exit: %s\n' "$profiler_status"
if [ "$filter_status" -ne 0 ]; then
  exit "$filter_status"
fi
exit "$profiler_status"

```

```output
Feature-suite profile report
  Test command exit: status 0
Runtime context
  Cucumber.js: 13.3.0 (cucumber-js)
  Node.js: <runtime>
  CI provider: not detected in this environment
Complete feature-suite elapsed: <measured> ms
Scenario elapsed total: <measured> ms
Residual setup/framework overhead: <measured> ms
Per-scenario timings
Scenario elapsed <measured> ms [component: synthetic-alpha] Alpha component timing
  Gherkin step time <measured> ms - Alpha component timing
  Scenario hook time <measured> ms - Alpha component timing
Scenario elapsed <measured> ms [component: synthetic-beta] Beta component timing
  Gherkin step time <measured> ms - Beta component timing
  Scenario hook time <measured> ms - Beta component timing
Component totals
Component total [synthetic-alpha] <measured> ms (1 scenario)
Component total [synthetic-beta] <measured> ms (1 scenario)

Profiler process exit: 0
```
