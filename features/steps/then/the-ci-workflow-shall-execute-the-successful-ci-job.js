import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the CI workflow shall execute the "Successful CI" job', function () { assert(this.gate_executed, "Expected 'Successful CI' job to be executed") })
