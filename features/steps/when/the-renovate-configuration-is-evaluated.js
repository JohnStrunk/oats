import { When } from '@cucumber/cucumber'
import { loadRenovateConfig } from '../renovate_helper.js'
When('the Renovate configuration is evaluated', function () { this.renovate_config = loadRenovateConfig() })
