import { When } from '@cucumber/cucumber'
When('session data is refreshed', async function () { await this.service.refresh() })
