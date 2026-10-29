import { Given } from '@cucumber/cucumber'
import { createMigrationFixture } from '../../tests/migration-step-support.js'

Given('an isolated feature with a failing scenario', async function () {
  this.migrationFixture = await createMigrationFixture('failure')
})
