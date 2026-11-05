import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { assertOverlongPairHeading, eventually, modal, panelHasPairHeadingPrefix, refreshPairIdentity } from '../usage_details_helper.js'

const identityCharacter = fc.constantFrom('a', 'b', '0', 'é', '代', '界')
const identityText = (minLength, maxLength) =>
  fc.array(identityCharacter, { minLength, maxLength }).map(characters => characters.join(''))

Then('generated overlong pair identities shall keep their reported costs right-justified on one ellipsized heading line', { timeout: 180000 }, async function () {
  await modal(this)
  const providerID = 'generated-provider'
  let sequence = 0

  await fc.assert(fc.asyncProperty(
    fc.record({ agentSuffix: identityText(1, 24), modelSuffix: identityText(55, 100) }),
    async ({ agentSuffix, modelSuffix }) => {
      const caseNumber = sequence++
      const identityPrefix = `generated-agent-${caseNumber}-`
      const agent = `${identityPrefix}${agentSuffix}`
      const modelID = `generated-model-${modelSuffix}`
      const fullIdentity = `${agent} - ${providerID}/${modelID}`

      await refreshPairIdentity(this, { agent, providerID, modelID, sequence: caseNumber })
      const text = await eventually(this, screen => panelHasPairHeadingPrefix(screen, identityPrefix),
        `the real host must render generated identity ${identityPrefix}`)
      assertOverlongPairHeading(text, { identityPrefix, fullIdentity, reportedCost: '$1.00' })
    },
  ), { numRuns: 12, seed: 641064, endOnFailure: true })
})
