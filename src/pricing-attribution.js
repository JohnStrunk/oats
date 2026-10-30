import { sumExactDecimals, formatExactCents } from './usage-aggregation.js'

export function sanitizeText(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu, '')
}

export function findModel(models, recordModel) {
  if (!models || !Array.isArray(models) || !recordModel) return null
  const providerID = typeof recordModel === 'object' ? recordModel?.providerID : null
  const modelID = typeof recordModel === 'object'
    ? (recordModel?.id ?? recordModel?.modelID ?? recordModel?.name)
    : (typeof recordModel === 'string' ? recordModel : null)

  if (!modelID) return null

  if (providerID) {
    const match = models.find(m =>
      m.providerID === providerID &&
      (m.id === modelID || m.modelID === modelID || m.name === modelID)
    )
    if (match) return match
  }

  const match = models.find(m =>
    m.id === modelID || m.modelID === modelID || m.name === modelID
  )
  if (match) return match

  if (typeof recordModel === 'string' && recordModel.includes('/')) {
    const [p, m] = recordModel.split('/')
    return models.find(item => item.providerID === p && (item.id === m || item.modelID === m || item.name === m)) ?? null
  }

  return null
}

export function evaluateCallTierRate(costList, tokens) {
  if (!costList) return null
  let list = Array.isArray(costList) ? costList : [costList]
  if (list.length === 0) return null

  // Context tokens for tier evaluation: context = input + cache.read + cache.write
  const input = typeof tokens?.input === 'number' && Number.isFinite(tokens.input) ? tokens.input : 0
  const cacheRead = typeof tokens?.cache?.read === 'number' && Number.isFinite(tokens.cache.read) ? tokens.cache.read : 0
  const cacheWrite = typeof tokens?.cache?.write === 'number' && Number.isFinite(tokens.cache.write) ? tokens.cache.write : 0
  const context = input + cacheRead + cacheWrite

  // Qualifying tiers with strict > tier.size
  const qualifyingTiers = list.filter(item => {
    if (item?.tier?.type === 'context' && typeof item.tier.size === 'number') {
      return context > item.tier.size
    }
    return false
  })

  if (qualifyingTiers.length > 0) {
    // Select highest qualifying tier (maximum tier.size)
    qualifyingTiers.sort((a, b) => b.tier.size - a.tier.size)
    return extractRates(qualifyingTiers[0])
  }

  // Fallback to untiered
  const untiered = list.find(item => !item?.tier || item.tier.type !== 'context' || typeof item.tier.size !== 'number')
  if (untiered) return extractRates(untiered)

  // Fallback to smallest tier size
  const sorted = [...list].sort((a, b) => (a.tier?.size ?? 0) - (b.tier?.size ?? 0))
  return extractRates(sorted[0])
}

function extractRates(costItem) {
  if (!costItem) return null
  const input = typeof costItem.input === 'number' && Number.isFinite(costItem.input) ? costItem.input : null
  const output = typeof costItem.output === 'number' && Number.isFinite(costItem.output) ? costItem.output : null
  const cacheWrite = typeof costItem.cache?.write === 'number' && Number.isFinite(costItem.cache.write) ? costItem.cache.write : null
  const cacheRead = typeof costItem.cache?.read === 'number' && Number.isFinite(costItem.cache.read) ? costItem.cache.read : null
  return { input, output, cacheWrite, cacheRead }
}

export function extractCallTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') {
    return {
      input: null,
      output: null,
      cacheWrite: null,
      cacheRead: null,
      known: false,
    }
  }

  const input = typeof tokens.input === 'number' && Number.isFinite(tokens.input) ? tokens.input : null
  const outputVal = typeof tokens.output === 'number' && Number.isFinite(tokens.output) ? tokens.output : null
  const reasoningVal = typeof tokens.reasoning === 'number' && Number.isFinite(tokens.reasoning) ? tokens.reasoning : null

  let output = null
  if (outputVal !== null || reasoningVal !== null) {
    output = (outputVal ?? 0) + (reasoningVal ?? 0)
  }

  const cacheWrite = typeof tokens.cache?.write === 'number' && Number.isFinite(tokens.cache.write) ? tokens.cache.write : null
  const cacheRead = typeof tokens.cache?.read === 'number' && Number.isFinite(tokens.cache.read) ? tokens.cache.read : null

  const known = input !== null || output !== null || cacheWrite !== null || cacheRead !== null
  return { input, output, cacheWrite, cacheRead, known }
}

export function aggregateUsageDetails(records, models) {
  const pairMap = new Map()

  for (const record of records ?? []) {
    const rawAgent = typeof record?.agent === 'string' && record.agent.trim().length > 0 ? record.agent : null
    const agentDisplay = rawAgent ? sanitizeText(rawAgent) : 'Unattributed'

    let providerID = null
    let modelID = null
    if (record?.model && typeof record.model === 'object') {
      providerID = record.model.providerID ?? null
      modelID = record.model.id ?? record.model.modelID ?? record.model.name ?? null
    } else if (typeof record?.model === 'string' && record.model.trim().length > 0) {
      if (record.model.includes('/')) {
        const parts = record.model.split('/')
        providerID = parts[0]
        modelID = parts.slice(1).join('/')
      } else {
        modelID = record.model
      }
    }

    let modelDisplay
    if (providerID && modelID) {
      modelDisplay = `${sanitizeText(providerID)}/${sanitizeText(modelID)}`
    } else if (modelID) {
      modelDisplay = sanitizeText(modelID)
    } else if (providerID) {
      modelDisplay = `${sanitizeText(providerID)}/Unattributed`
    } else {
      modelDisplay = 'Unattributed'
    }

    const pairKey = `${agentDisplay}__sep__${modelDisplay}`
    let pair = pairMap.get(pairKey)
    if (!pair) {
      pair = {
        agent: rawAgent,
        agentDisplay,
        providerID,
        modelID,
        modelDisplay,
        records: [],
      }
      pairMap.set(pairKey, pair)
    }
    pair.records.push(record)
  }

  const pairs = Array.from(pairMap.values())

  pairs.sort((a, b) => {
    const agentCmp = a.agentDisplay.localeCompare(b.agentDisplay)
    if (agentCmp !== 0) return agentCmp
    return a.modelDisplay.localeCompare(b.modelDisplay)
  })

  return pairs.map(pair => computePairDetails(pair, models))
}

function computePairDetails(pair, models) {
  const records = pair.records
  const modelInfo = findModel(models, { providerID: pair.providerID, id: pair.modelID })

  // 1. Reported cost calculation
  const knownCosts = []
  let costIncomplete = false

  for (const record of records) {
    if (typeof record.cost === 'number' && Number.isFinite(record.cost)) {
      knownCosts.push(record.cost)
    } else {
      costIncomplete = true
    }
  }

  let reportedCost
  if (knownCosts.length === 0) {
    reportedCost = costIncomplete ? 'unavailablee' : 'unavailable'
  } else {
    const exact = sumExactDecimals(knownCosts)
    const formatted = formatExactCents(exact)
    if (formatted !== null) {
      reportedCost = costIncomplete ? `${formatted}e` : formatted
    } else {
      const bound = exact.units < 0n ? '<-$9999.99' : '>$9999.99'
      reportedCost = costIncomplete ? `${bound}e` : bound
    }
  }

  // 2. Token, Price, and Cost breakdown for the 4 categories
  const categories = ['input', 'output', 'cacheWrite', 'cacheRead']
  const tokenBreakdown = {}
  const priceBreakdown = {}
  const costBreakdown = {}

  for (const cat of categories) {
    const catKnownTokens = []
    let catHasMissingTokens = false
    const catRates = []
    const catEstimates = []

    for (const record of records) {
      const callToks = extractCallTokens(record.tokens)
      const val = callToks[cat]
      if (val !== null) {
        catKnownTokens.push(val)
      } else {
        catHasMissingTokens = true
      }

      const rateObj = evaluateCallTierRate(modelInfo?.cost, record.tokens)
      const rate = rateObj?.[cat] ?? null
      if (rate !== null) {
        catRates.push(rate)
      }

      if (val !== null && rate !== null) {
        catEstimates.push((val * rate) / 1_000_000)
      }
    }

    // If no records with rate evaluated, check default rate from modelInfo
    if (catRates.length === 0 && modelInfo?.cost) {
      const defaultRate = evaluateCallTierRate(modelInfo.cost, null)?.[cat] ?? null
      if (defaultRate !== null) catRates.push(defaultRate)
    }

    // Price row
    if (catRates.length === 0) {
      priceBreakdown[cat] = '—'
    } else {
      const allSame = catRates.every(r => r === catRates[0])
      if (allSame) {
        priceBreakdown[cat] = `$${catRates[0].toFixed(2)}`
      } else {
        priceBreakdown[cat] = 'mixed'
      }
    }

    // Tokens row
    if (catKnownTokens.length === 0) {
      tokenBreakdown[cat] = '—'
    } else {
      const sum = catKnownTokens.reduce((a, b) => a + b, 0)
      const formatted = sum.toLocaleString('en-US')
      tokenBreakdown[cat] = catHasMissingTokens ? `${formatted}e` : formatted
    }

    // Cost row
    if (catEstimates.length === 0) {
      costBreakdown[cat] = '—'
    } else {
      const sum = catEstimates.reduce((a, b) => a + b, 0)
      costBreakdown[cat] = `$${sum.toFixed(2)}e`
    }
  }

  return {
    agentDisplay: pair.agentDisplay,
    modelDisplay: pair.modelDisplay,
    reportedCost,
    price: priceBreakdown,
    tokens: tokenBreakdown,
    cost: costBreakdown,
  }
}

function formatCell(val, width) {
  return String(val ?? '—').padEnd(width, ' ')
}

export function renderPairTable(pair) {
  const col0Width = 8
  const col1Width = 15
  const col2Width = 15
  const col3Width = 16

  const heading = `${pair.agentDisplay} - ${pair.modelDisplay}  ${pair.reportedCost}`

  const header =
    ' '.repeat(col0Width) +
    formatCell('input', col1Width) +
    formatCell('output', col2Width) +
    formatCell('cache write', col3Width) +
    'cache read'

  const priceRow =
    formatCell('Price', col0Width) +
    formatCell(pair.price.input, col1Width) +
    formatCell(pair.price.output, col2Width) +
    formatCell(pair.price.cacheWrite, col3Width) +
    pair.price.cacheRead

  const tokensRow =
    formatCell('Tokens', col0Width) +
    formatCell(pair.tokens.input, col1Width) +
    formatCell(pair.tokens.output, col2Width) +
    formatCell(pair.tokens.cacheWrite, col3Width) +
    pair.tokens.cacheRead

  const costRow =
    formatCell('Cost', col0Width) +
    formatCell(pair.cost.input, col1Width) +
    formatCell(pair.cost.output, col2Width) +
    formatCell(pair.cost.cacheWrite, col3Width) +
    pair.cost.cacheRead

  return [heading, header, priceRow, tokensRow, costRow].join('\n')
}
