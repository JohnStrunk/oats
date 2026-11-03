import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { legendCount } from '../sidebar_alignment_helper.js'
import { sidebarAgentRows } from '../sidebar_section_helper.js'

Then('the Agent stats e legend shall appear exactly once', { timeout: 15000 }, async function () {
  const hasMarkedAgentRow = text => sidebarAgentRows(text).some(({ tail }) =>
    /^[<>]?-?\$-?\d+\.\d{2}e\s*[│┃]?\s*$/i.test(tail))
  await eventually(this, text => hasMarkedAgentRow(text) && legendCount(text) === 1,
    'Agent stats must have a marked row and exactly one legend within its section')
})
