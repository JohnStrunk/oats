import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the docker package rule shall specify a weekly schedule', function () {
  const rule = this.docker_rule ?? {}, schedules = rule.schedule ?? []
  assert(schedules.length > 0, `Expected non-empty schedule in docker rule: ${JSON.stringify(rule)}`)
  const text = schedules.join(' ').toLowerCase()
  assert(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'week'].some(day => text.includes(day)), `Schedule does not specify weekly timing: ${schedules}`)
})
