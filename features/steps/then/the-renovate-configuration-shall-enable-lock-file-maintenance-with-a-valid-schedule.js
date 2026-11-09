import { Then } from '@cucumber/cucumber'
import { checkLockFileMaintenance } from '../lock_file_maintenance_helper.js'

Then('the Renovate configuration shall enable lock file maintenance with a valid schedule', function () {
  checkLockFileMaintenance(this.renovate_config)
})
