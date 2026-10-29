export const cloneModel = (model) =>
  model
    ? {
        providerID: model.providerID,
        id: model.id,
        ...(model.variant !== undefined ? { variant: model.variant } : {}),
      }
    : null

export const cloneTokens = (tokens) => {
  if (!tokens) return null
  return {
    input: tokens.input,
    output: tokens.output,
    reasoning: tokens.reasoning,
    cache: tokens.cache
      ? { read: tokens.cache.read, write: tokens.cache.write }
      : null,
  }
}

export const numberOrNull = (value) =>
  typeof value === 'number' ? value : null

export const messageKey = (sessionID, messageID) => `${sessionID}/${messageID}`

const sameTokens = (left, right) => {
  if (left == null || right == null) return left == null && right == null
  return (
    left.input === right.input &&
    left.output === right.output &&
    left.reasoning === right.reasoning &&
    left.cache?.read === right.cache?.read &&
    left.cache?.write === right.cache?.write
  )
}

export const sameUsage = (left, right) =>
  left.cost === right.cost && sameTokens(left.tokens, right.tokens)

export const recordGaps = (records) => {
  const gaps = []
  for (const record of records) {
    if (record.agent == null || record.model == null) {
      gaps.push({
        kind: 'missing-identity',
        sessionID: record.sessionID,
        messageID: record.messageID,
        source: record.source,
      })
    }
    if (record.cost == null || record.tokens == null) {
      gaps.push({
        kind: 'missing-usage',
        sessionID: record.sessionID,
        messageID: record.messageID,
        source: record.source,
      })
    }
  }
  return gaps
}

export function buildMessageRecords(
  sessionID,
  messages,
  summarizedCompactions = [],
) {
  const summarizedIDs = new Set(
    summarizedCompactions.map((entry) => entry.id).filter(Boolean),
  )
  const summarizedStartedAt = new Set(
    summarizedCompactions
      .map((entry) => entry.startedAt)
      .filter((value) => typeof value === 'number'),
  )
  const records = new Map()
  for (const message of messages) {
    // A compaction message is a summary. When the log exposes the individual
    // provider calls for that compaction, the calls are the records and the
    // summary must not become an extra one.
    if (
      message.type === 'compaction' &&
      (summarizedIDs.has(message.id) ||
        summarizedStartedAt.has(message.time?.created))
    ) {
      continue
    }
    const assistant = message.type === 'assistant'
    const compaction =
      message.type === 'compaction' &&
      (message.cost !== undefined || message.tokens !== undefined)
    if (!assistant && !compaction) continue

    const key = messageKey(sessionID, message.id)
    records.set(key, {
      id: key,
      sessionID,
      messageID: message.id,
      agent: assistant ? message.agent ?? null : null,
      model: assistant ? cloneModel(message.model) : null,
      cost: numberOrNull(message.cost),
      tokens: cloneTokens(message.tokens),
      source: assistant ? 'assistant' : 'compaction',
      provenance: 'own',
      origin: 'history',
      // Wall-clock creation/completion lets a live terminal or compaction
      // projection be recognized as the same record rather than a duplicate.
      // These timestamps are not private content.
      startedAt: message.time?.created ?? null,
      completedAt: message.time?.completed ?? null,
    })
  }
  return records
}

export function latestAttempt(attempts) {
  let latest = null
  for (const attempt of attempts.values()) {
    if (!latest || attempt.seq >= latest.seq) latest = attempt
  }
  return latest
}

export function mergeHistoryIntoRecord(record, history, includeUsage = true) {
  if (record.agent == null && history.agent != null) record.agent = history.agent
  if (record.model == null && history.model != null) record.model = history.model
  if (includeUsage) {
    if (record.cost == null && history.cost != null) record.cost = history.cost
    if (record.tokens == null && history.tokens != null) {
      record.tokens = history.tokens
    }
  }
  if (history.provenance === 'uncertain') record.provenance = 'uncertain'
}
