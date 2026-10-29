import { Given } from '@cucumber/cucumber'
import { createMigrationFixture } from '../../tests/migration-step-support.js'

Given('a sandbox containing scenarios for both components', async function () {
  this.migrationFixture = await createMigrationFixture()
})
