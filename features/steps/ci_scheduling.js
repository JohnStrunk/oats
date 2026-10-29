import assert from 'node:assert/strict'

// This deliberately models only the subset of Actions scheduling used here.
// Unknown filters and expressions must not be mistaken for a scheduled job.
const EVENTS = ['pull_request', 'push', 'workflow_dispatch']
const SUPPORTED_FILTERS = {
  pull_request: ['branches', 'types'],
  push: ['branches'],
  workflow_dispatch: [],
}
const DEFAULT_PULL_REQUEST_TYPES = ['opened', 'synchronize', 'reopened']
const SUPPORTED_CONDITIONS = ['true', 'false', 'always()']
const BRANCH_NAME = /^[a-zA-Z0-9_./-]+$/

const notTriggered = () => ({ triggered: false, scheduledJobIds: [] })

function assertMapping(value, message) {
  assert(value && typeof value === 'object' && !Array.isArray(value), message)
}

function assertSupportedEvent(event) {
  assert(event && EVENTS.includes(event.type), 'Unsupported event')
}

// `undefined` means the workflow does not select this event. `null` means it
// does, with no event-specific filter mapping.
function selectedTrigger(on, eventType) {
  if (typeof on === 'string') return on === eventType ? null : undefined
  if (Array.isArray(on)) return on.includes(eventType) ? null : undefined
  assertMapping(on, 'Invalid workflow trigger')
  return Object.hasOwn(on, eventType) ? on[eventType] : undefined
}

function matchesBranchFilter(filters, event) {
  if (event.type === 'workflow_dispatch') return true
  assert(typeof event.branch === 'string' && event.branch.length > 0, 'Event branch required')
  if (filters.branches === undefined) return true
  assert(Array.isArray(filters.branches) && filters.branches.every(branch => typeof branch === 'string' && BRANCH_NAME.test(branch)), 'Unsupported branch filter')
  return filters.branches.includes(event.branch)
}

function matchesPullRequestFilter(filters, event) {
  if (event.type !== 'pull_request') return true
  assert(typeof event.action === 'string' && event.action.length > 0, 'Pull request action required')
  const types = filters.types ?? DEFAULT_PULL_REQUEST_TYPES
  assert(Array.isArray(types) && types.every(type => typeof type === 'string'), 'Invalid pull request types')
  return types.includes(event.action)
}

function isEventSelected(trigger, event) {
  if (trigger === undefined) return false
  const filters = trigger ?? {}
  assertMapping(filters, 'Unsupported trigger configuration')
  const allowed = SUPPORTED_FILTERS[event.type]
  assert(Object.keys(filters).every(key => allowed.includes(key)), 'Unsupported event filter')
  return matchesBranchFilter(filters, event) && matchesPullRequestFilter(filters, event)
}

function jobNeeds(job, id) {
  const needs = job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs
  assert(Array.isArray(needs) && needs.every(need => typeof need === 'string'), `Invalid dependencies: ${id}`)
  return needs
}

function jobCondition(job) {
  const raw = job.if === undefined ? 'true' : String(job.if).trim()
  const condition = raw.startsWith('${{') && raw.endsWith('}}') ? raw.slice(3, -2).trim() : raw
  assert(SUPPORTED_CONDITIONS.includes(condition), `Unsupported job condition: ${condition}`)
  return condition
}

function evaluateJob(jobs, id, scheduled, visiting) {
  if (scheduled.has(id)) return scheduled.get(id)
  assert(!visiting.has(id), 'Circular job dependencies')
  assert(Object.hasOwn(jobs, id), `Unknown job dependency: ${id}`)
  assertMapping(jobs[id], `Invalid job: ${id}`)
  const job = jobs[id]
  assert(!Object.hasOwn(job, 'strategy') && !Object.hasOwn(job, 'uses'), `Unsupported job scheduling: ${id}`)
  const needs = jobNeeds(job, id)
  visiting.add(id)
  const dependencies = needs.map(need => evaluateJob(jobs, need, scheduled, visiting))
  visiting.delete(id)
  const condition = jobCondition(job)
  scheduled.set(id, condition !== 'false' && (condition === 'always()' || dependencies.every(Boolean)))
  return scheduled.get(id)
}

// Evaluate every job once, following `needs`. Unsupported constructs throw so a
// scheduling check can never pass by assuming a job would run.
function scheduleJobs(jobs) {
  const scheduled = new Map()
  const visiting = new Set()
  for (const id of Object.keys(jobs)) evaluateJob(jobs, id, scheduled, visiting)
  return scheduled
}

export function evaluateCiScheduling(workflow, event) {
  assertMapping(workflow, 'Invalid workflow')
  assertSupportedEvent(event)
  if (!isEventSelected(selectedTrigger(workflow.on, event.type), event)) return notTriggered()
  assertMapping(workflow.jobs, 'Invalid jobs')
  const scheduled = scheduleJobs(workflow.jobs)
  const ids = Object.keys(workflow.jobs)
  return { triggered: true, scheduledJobIds: ids.filter(id => scheduled.get(id)) }
}
