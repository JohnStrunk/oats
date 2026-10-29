import { After } from '@cucumber/cucumber'
import { hostFixture, makeService } from './session_data_helper.js'

export async function lookupRegressionHost() {
  const { state, context } = hostFixture('recorded identities')
  state.route = { type: 'home' }
  state.lookupFails = false
  state.lookupCalls = []
  const get = context.client.session.get
  context.client.session.get = async (request) => {
    state.lookupCalls.push({ sessionID: request.sessionID, failed: state.lookupFails })
    if (state.lookupFails) throw new Error('session lookup unavailable')
    return get(request)
  }
  state.service = await makeService(context)
  return state
}

After(function () { this.lookupRegressionHost?.service.dispose() })
