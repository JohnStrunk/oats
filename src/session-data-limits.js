const DEFAULTS = {
  timeoutMs: 2000,
  maxPages: 1000,
  maxLogEvents: 10000,
  maxSubtreeNodes: 1000,
}

const positive = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

export function resolveLimits(context) {
  const configured = context?.sessionDataLimits ?? {}
  return {
    timeoutMs: positive(configured.timeoutMs, DEFAULTS.timeoutMs),
    maxPages: Math.max(
      1,
      Math.floor(positive(configured.maxPages, DEFAULTS.maxPages)),
    ),
    maxLogEvents: Math.max(
      1,
      Math.floor(positive(configured.maxLogEvents, DEFAULTS.maxLogEvents)),
    ),
    maxSubtreeNodes: Math.max(
      1,
      Math.floor(
        positive(configured.maxSubtreeNodes, DEFAULTS.maxSubtreeNodes),
      ),
    ),
  }
}

export class ReadLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReadLimitError'
  }
}

export class ReadAbortError extends Error {
  constructor(message = 'read aborted') {
    super(message)
    this.name = 'AbortError'
  }
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw new ReadAbortError()
}

export function withTimeout(promise, timeoutMs, onTimeout, signal) {
  if (signal?.aborted) {
    try {
      onTimeout?.()
    } catch {
      // Best-effort.
    }
    return Promise.reject(new ReadAbortError())
  }

  let timer
  let onAbort
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.()
      } catch {
        // Aborting the underlying read is best-effort.
      }
      reject(new ReadLimitError(`read exceeded ${timeoutMs}ms`))
    }, timeoutMs)
    timer.unref?.()
  })
  const aborted = new Promise((_, reject) => {
    onAbort = () => {
      try {
        onTimeout?.()
      } catch {
        // Best-effort.
      }
      reject(new ReadAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
  return Promise.race([Promise.resolve(promise), timeout, aborted]).finally(() => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  })
}
