import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Write a local TUI plugin package. Only the client and event inputs are
 * controlled; OATS's plugin and the host's UI, router and renderer are real.
 * The control file's events are an append-only sequence for one run.
 */
export async function writeSidebarAdapter({ directory, controlPath, oatsPath }) {
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    name: 'oats-sidebar-adapter',
    private: true,
    type: 'module',
    exports: { './tui': './tui.js' },
  }, null, 2))
  const oatsEntry = resolve(oatsPath)
  const oatsUrl = pathToFileURL((await stat(oatsEntry)).isDirectory() ? join(oatsEntry, 'tui.js') : oatsEntry).href
  const source = `import { readFileSync, writeFileSync } from 'node:fs'
import oats from ${JSON.stringify(oatsUrl)}

const controlPath = ${JSON.stringify(resolve(controlPath))}
const read = () => JSON.parse(readFileSync(controlPath, 'utf8'))
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const decode = (value) => {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString()) }
  catch { throw new Error('invalid cursor') }
}
const page = (items, query, limit) => {
  const ordered = query.order === 'desc' ? [...items].reverse() : items
  const offset = query.offset
  return { data: ordered.slice(offset, offset + limit), cursor: {
    ...(offset > 0 ? { previous: encode({ ...query, offset: Math.max(0, offset - limit) }) } : {}),
    ...(offset + limit < ordered.length ? { next: encode({ ...query, offset: offset + limit }) } : {}),
  } }
}

export default {
  id: 'oats.sidebar.fixture',
  async setup(host) {
    let control = read()
    let disposed = false
    let delivered = 0
    let lastRoute
    const listeners = new Map()
    const allListeners = new Set()
    const blocked = new Map()
    const failures = () => new Set(control.failures ?? [])
    const isBlocked = (sessionID) => !disposed &&
      ((control.blockRoot && sessionID === (control.rootSession ?? 'root')) || (control.blockSessions ?? []).includes(sessionID))
    const release = () => {
      for (const [resolve, sessionID] of blocked) {
        if (isBlocked(sessionID)) continue
        blocked.delete(resolve)
        resolve()
      }
    }
    const on = (type, callback) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(callback)
      return () => listeners.get(type)?.delete(callback)
    }
    const listen = (callback) => {
      allListeners.add(callback)
      return () => allListeners.delete(callback)
    }
    const data = new Proxy(host.data, {
      get(target, key) {
        if (key === 'on') return on
        if (key === 'listen') return listen
        return Reflect.get(target, key, target)
      },
    })
    const session = {
      async get({ sessionID }) {
        return structuredClone((control.sessions ?? []).find((s) => s.id === sessionID))
      },
      async list({ parentID, cursor, order, limit = 50 } = {}) {
        if (cursor !== undefined && order !== undefined) throw new Error('cursor cannot be combined with order')
        if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid limit')
        const query = cursor === undefined ? { kind: 'session', parentID, order: order ?? 'desc', offset: 0 } : decode(cursor)
        if (query.kind !== 'session' || (parentID !== undefined && parentID !== query.parentID)) throw new Error('cursor filter mismatch')
        if (failures().has('session:' + query.parentID + ':' + query.offset)) throw new Error('session list unavailable')
        return structuredClone(page((control.sessions ?? []).filter((s) => query.parentID === undefined || (query.parentID === null ? !s.parentID : s.parentID === query.parentID)), query, limit))
      },
      async *log({ sessionID }) {
        if (failures().has('log:' + sessionID)) throw new Error('log unavailable')
        yield { type: 'log.synced', aggregateID: sessionID }
      },
    }
    const message = {
      async list({ sessionID, cursor, type, order, limit = 50 }) {
        if (cursor !== undefined && order !== undefined) throw new Error('cursor cannot be combined with order')
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('invalid limit')
        const query = cursor === undefined ? { kind: 'message', sessionID, type, order: order ?? 'desc', offset: 0 } : decode(cursor)
        if (query.kind !== 'message' || query.sessionID !== sessionID || query.type !== type) throw new Error('cursor filter mismatch')
        // A read counts as a route acknowledgment only when the real TUI
        // router already reports that same session; prefetch is not enough.
        const route = host.ui.router.current?.()
        if (route?.type === 'session' && route.sessionID === sessionID) writeFileSync(controlPath + '.read', sessionID)
        const result = structuredClone(page((control.messages?.[sessionID] ?? []).filter((m) => !type || m.type === type), query, limit))
        const wasBlocked = isBlocked(sessionID)
        if (wasBlocked) {
          writeFileSync(controlPath + '.blocked', sessionID)
          await new Promise((resolve) => blocked.set(resolve, sessionID))
        }
        try {
          if (failures().has('message:' + sessionID + ':' + query.offset) || (query.offset > 0 && failures().has('message:' + sessionID + ':later'))) throw new Error('history unavailable')
          return result
        } finally {
          // The next event-loop turn follows settlement of the read promise and
          // its microtask continuations, rather than merely acknowledging that
          // the test requested a release.
          if (wasBlocked) setImmediate(() => writeFileSync(controlPath + '.completed', sessionID))
        }
      },
    }
    const client = new Proxy(host.client, {
      get(target, key) {
        if (key === 'session') return session
        if (key === 'message') return message
        return Reflect.get(target, key, target)
      },
    })
    const context = new Proxy(host, {
      get(target, key) {
        if (key === 'client') return client
        if (key === 'data') return data
        return Reflect.get(target, key, target)
      },
    })
    const navigate = () => {
      if (control.route === undefined) return
      const next = JSON.stringify(control.route)
      if (next === lastRoute) return
      lastRoute = next
      const route = typeof control.route === 'string'
        ? { type: 'session', sessionID: control.route }
        : control.route ?? { type: 'home' }
      host.ui.router.navigate(route)
    }
    const emitEvents = () => {
      const events = control.events ?? []
      // A shortened list starts a new sequence. Normally events are appended.
      if (events.length < delivered) delivered = 0
      while (delivered < events.length) {
        const event = events[delivered++]
        for (const callback of listeners.get(event.type) ?? []) callback(event)
        for (const callback of allListeners) callback({ details: event })
      }
    }
    const poll = () => {
      if (disposed) return
      // A writer may be between truncate and write; keep the last complete
      // control document and try again on the next tick.
      try { control = read() } catch { return }
      release()
      navigate()
      emitEvents()
    }
    const cleanup = () => {
      disposed = true
      clearInterval(timer)
      release()
      listeners.clear()
      allListeners.clear()
    }
    navigate()
    const timer = setInterval(poll, 50)
    try {
      const disposeOats = await oats.setup(context)
      emitEvents()
      return async () => {
        cleanup()
        if (typeof disposeOats === 'function') await disposeOats()
      }
    } catch (error) {
      cleanup()
      throw error
    }
  },
}
`
  await writeFile(join(directory, 'tui.js'), source)
}
