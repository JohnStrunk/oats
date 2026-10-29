import { When } from '@cucumber/cucumber'
import { loadMergifyConfig } from '../mergify_helper.js'
When('the Mergify configuration is evaluated', function () { this.mergify_config = loadMergifyConfig() })
