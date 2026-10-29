import { Given } from '@cucumber/cucumber'
import { originalScenarios } from '../../tests/migration-step-support.js'

Given('the repository contains the existing acceptance scenarios', function () {
  this.migrationExpected = originalScenarios
})
