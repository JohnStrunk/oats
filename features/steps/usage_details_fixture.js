export const model = { providerID: 'fixture-provider', id: 'fixture-model' }
export const usage = { input: 400000, output: 300000, reasoning: 200000, cache: { write: 250000, read: 500000 } }
export const message = (id, agent, chosenModel = model, cost = 1, tokens = usage) => ({
  id, type: 'assistant', agent, model: chosenModel, cost, tokens,
  time: { created: 1, completed: 2 }, content: [],
})
export const modelInfo = (providerID = 'fixture-provider', id = 'fixture-model') => ({
  providerID, id, modelID: id, name: id, status: 'active', enabled: true,
  cost: [{ input: 5, output: 2, cache: { write: 6, read: 7 } }],
  variants: [], time: { released: 0 }, capabilities: { tools: true, input: ['text'], output: ['text'] },
  limit: { context: 1000000, output: 100000 },
})

const scrollAgent = index => `agent-${String(index).padStart(2, '0')}`
// The mixed label sorts first in its fixture and mixes narrow and wide glyphs,
// so it is the heading the overflow scenario must see rendered in full.
const MIXED_UNICODE_AGENT = '0' + 'é'.repeat(16) + '代'.repeat(8)

// Scroll fixtures sort by agent label, so this pins which label heads the
// first visible table. The scrollbar scenario asserts that label is rendered
// with its provider/model heading, so a fixture change cannot silently drift.
const FIRST_SCROLL_AGENT = {
  scroll: scrollAgent(0),
  'scroll mixed unicode': MIXED_UNICODE_AGENT,
}

export function firstScrollAgent(kind) {
  if (!Object.hasOwn(FIRST_SCROLL_AGENT, kind)) throw new Error(`No first table agent label is defined for the "${kind}" fixture`)
  return FIRST_SCROLL_AGENT[kind]
}

export function detailsFixture(kind) {
  const root = 'ses_oats_root', child = 'ses_oats_child', other = 'ses_oats_new_root'
  const fixture = {
    rootSession: root, route: root,
    sessions: [{ id: root }, { id: child, parentID: root }, { id: other }],
    messages: {
      [root]: [message('one', 'alpha')],
      [child]: [message('two', 'alpha', model, 2)],
      [other]: [message('other', 'other-agent', model, 99)],
    },
    models: [modelInfo()], failures: [], events: [], blockRoot: false,
  }
  if (kind === 'switch') fixture.messages[other] = [message('new', 'new-agent', model, 5)]
  else if (kind === 'providers') {
    fixture.messages[root] = ['provider-a', 'provider-b'].map((providerID, i) =>
      message(`p${i}`, 'alpha', { providerID, id: 'fixture-model' }, i + 1))
    fixture.messages[child] = []
    fixture.models = ['provider-a', 'provider-b'].map(id => modelInfo(id))
  } else if (kind === 'sorting') {
    fixture.messages[root] = [
      message('b', 'beta', { providerID: 'p', id: 'z-model' }),
      message('az', 'alpha', { providerID: 'p', id: 'z-model' }),
      message('aa', 'alpha', { providerID: 'p', id: 'a-model' }),
    ]
    fixture.messages[child] = []
    fixture.models = ['a-model', 'z-model'].map(id => modelInfo('p', id))
  } else if (kind === 'unknown') {
    fixture.messages[root] = [
      message('known', 'alpha', model, 2, null),
      message('missing', 'alpha', model, null, null),
      message('unknown-only', 'beta', model, null, usage),
    ]
    fixture.messages[child] = []
    fixture.models = []
  } else if (kind === 'partial reported cost') {
    fixture.messages[root] = [message('reported-known', 'alpha', model, 1), message('reported-missing', 'alpha', model, null)]
    fixture.messages[child] = []
  } else if (kind === 'negative reported cost') {
    fixture.messages[root] = [message('reported-negative', 'alpha', model, -1)]
    fixture.messages[child] = []
  } else if (kind === 'partial tokens') {
    fixture.messages[root] = [message('known', 'alpha'), message('missing', 'alpha', model, 2, null)]
    fixture.messages[child] = []
  } else if (kind === 'unattributed') {
    fixture.messages[root] = [message('no-agent', null, model, 1), message('no-model', 'alpha', null, 2)]
    fixture.messages[child] = []
  } else if (kind === 'scroll') {
    fixture.messages[root] = Array.from({ length: 25 }, (_, i) => message(`s${i}`, scrollAgent(i)))
    fixture.messages[child] = []
  } else if (kind === 'scroll mixed unicode') {
    // Sorts first, and its heading mixes narrow and wide glyphs so it is wider
    // than the fixed ASCII table header. It renders 73 cells (33 label cells
    // plus the 40-cell heading suffix), where UTF-16 .length predicts 65 and a
    // two-cells-per-non-ASCII estimate predicts 89, so the screen oracle must
    // measure cells rather than code units or a conservative substitution.
    fixture.messages[root] = [
      message('mixed', MIXED_UNICODE_AGENT),
      ...Array.from({ length: 24 }, (_, i) => message(`s${i}`, scrollAgent(i + 1))),
    ]
    fixture.messages[child] = []
  } else if (kind === 'long identity') {
    const agent = `overflow-agent-${'agent-'.repeat(20)}`
    const chosenModel = {
      providerID: 'overflow-provider',
      id: `overflow-model-${'model-'.repeat(20)}`,
    }
    fixture.messages[root] = [message('long-identity', agent, chosenModel, 1)]
    fixture.messages[child] = []
    fixture.models = [modelInfo(chosenModel.providerID, chosenModel.id)]
  } else if (kind === 'wide Unicode identity') {
    const agent = `wide-agent-${'代界'.repeat(30)}`
    const chosenModel = {
      providerID: 'wide-provider',
      id: `wide-model-${'模型'.repeat(30)}`,
    }
    fixture.messages[root] = [message('wide-unicode-identity', agent, chosenModel, 1)]
    fixture.messages[child] = []
    fixture.models = [modelInfo(chosenModel.providerID, chosenModel.id)]
  } else if (kind !== 'single pair' && kind !== 'switch') throw new Error(`Unknown fixture: ${kind}`)
  return fixture
}
