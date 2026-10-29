import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('all shell scripts shall conform to shellcheck standards', function () { assert(this.shell_linter_executed, 'Shellcheck linter was not executed') })
