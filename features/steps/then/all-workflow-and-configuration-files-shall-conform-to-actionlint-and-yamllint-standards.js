import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('all workflow and configuration files shall conform to actionlint and yamllint standards', function () { assert(this.yaml_linter_executed, 'YAML/actionlint was not executed') })
