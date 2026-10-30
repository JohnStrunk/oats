import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'

Then('the sidebar shall contain the section title {string}', { timeout: 15000 }, async function (title) {
  await eventually(this, text => text.split('\n').some(line => {
    const index = line.indexOf(title)
    return index >= 0 && !/[A-Za-z]/.test(line[index + title.length] ?? '')
  }), `the exact section title ${title} was not rendered`)
})
