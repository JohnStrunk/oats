import { Given } from '@cucumber/cucumber'
import { hostFixture, makeService } from '../session_data_helper.js'
import { message, session } from '../regression_session_helper.js'
import '../session_data_hooks.js'

Given('a session tree with a known descendant under a sibling', async function () {
  const { state, context } = hostFixture('tree with paginated history')
  // The fake lists in reverse order: a is traversed before b.
  state.sessions = [session('root'), session('b', 'root'), session('a', 'root'), session('g', 'b')]
  state.messages = Object.fromEntries(['root', 'a', 'b', 'g'].map((id) => [id, [message(`${id}-message`, 1)]]))
  const list = context.client.session.list
  state.listings = []
  context.client.session.list = async (input) => {
    try {
      const result = await list(input)
      state.listings.push({ parent: input.parentID, ids: result.data.map((child) => child.id) })
      return result
    } catch (error) {
      state.listings.push({ parent: input.parentID, failed: true })
      throw error
    }
  }
  this.host = state
  this.service = await makeService(context)
  await this.service.refresh()
  this.lineageBaseline = structuredClone(this.service.getSnapshot())
  this.lineageBaselineListings = structuredClone(state.listings)
})
