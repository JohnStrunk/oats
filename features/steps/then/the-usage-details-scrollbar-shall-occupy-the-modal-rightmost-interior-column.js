import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually } from '../usage_details_helper.js'
import { firstScrollAgent, model } from '../usage_details_fixture.js'
import { panelFrame, terminalCells } from '../usage_details_screen.js'

const SCROLLBAR_GLYPHS = new Set(['█', '▀', '▄'])
const MODEL_HEADING = `${model.providerID}/${model.id}`

// The pinned-host dialog frame supplies the right boundary. Confirm the first
// visible table by its full fixture heading, then require a contiguous scrollbar
// thumb in the panel's rightmost interior cell (not merely beside table text).
function scrollbarAtModalRightEdge(text, fixtureName) {
  const agentLabel = firstScrollAgent(fixtureName)
  const lines = text.split('\n')
  const frame = panelFrame(text)
  if (!frame) return { ready: false, reason: 'the bordered usage details modal is not visible' }
  const heading = `${agentLabel} - ${MODEL_HEADING}`
  const headingRow = lines.findIndex(line => line.includes(heading) && /\$\d/.test(line))
  if (headingRow === -1) return { ready: false, reason: `the first usage details table heading "${heading}" is not yet visible` }

  const headerRow = lines.findIndex((line, index) => index > headingRow && /input\s+output\s+cache write\s+cache read/i.test(line))
  if (headerRow === -1) return { ready: false, reason: 'the first usage details table headings are not yet visible' }
  const scrollbarColumn = frame.right - 1
  if (scrollbarColumn <= frame.left) return { ready: false, reason: 'the modal has no rightmost interior column' }

  const firstVisibleRow = Math.max(frame.top + 1, headingRow - 2)
  const lastVisibleRow = Math.min(frame.bottom, Math.max(headerRow + 4, headingRow + 5))
  for (let row = firstVisibleRow; row + 1 < lastVisibleRow; row++) {
    const current = terminalCells(lines[row])
    const next = terminalCells(lines[row + 1])
    if (SCROLLBAR_GLYPHS.has(current[scrollbarColumn]) && SCROLLBAR_GLYPHS.has(next[scrollbarColumn])) {
      return { ready: true }
    }
  }
  return { ready: false, reason: 'the vertical scrollbar thumb is not in the modal rightmost interior column beside the visible table' }
}

// Only the "scroll" host fixtures have enough pair tables to overflow the modal
// viewport, so this screen-based check observes their first visible table
// rather than a general sidebar layout.
Then('the usage details scrollbar shall occupy the modal rightmost interior column', { timeout: 15000 }, async function () {
  let reason = 'the vertical scrollbar thumb is not present in the modal rightmost interior column'
  try {
    await eventually(this, text => {
      const layout = scrollbarAtModalRightEdge(text, this.detailsFixtureName)
      reason = layout.reason
      return layout.ready
    }, 'the usage details scrollbar layout must become visible')
  } catch (error) {
    if (error.code === 'ERR_ASSERTION' && error.message.includes('Last terminal screen:')) {
      assert.fail(`${reason}\n${error.message}`)
    }
    throw error
  }
})
