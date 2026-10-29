import { Given } from '@cucumber/cucumber'
import { createMigrationFixture } from '../../tests/migration-step-support.js'

Given('an isolated feature with an undefined step', async function () {
  this.migrationFixture = await createMigrationFixture('undefined')
})
