import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { writeSidebarAdapter } from '../steps/sidebar_adapter.js'
import { createSidebarTemp } from '../steps/sidebar_temp_helper.js'

test('sidebar adapter supplies controlled data while retaining the host UI', async () => {
  const root = await createSidebarTemp('sidebar-adapter-')
  let dispose
  try {
    const oats = join(root, 'oats')
    await mkdir(oats)
    await writeFile(join(oats, 'package.json'), '{"type":"module"}')
    await writeFile(join(oats, 'tui.js'), `export default { setup(context) { globalThis.sidebarAdapterContext = context; return () => { globalThis.sidebarAdapterCleaned = true } } }`)
    const controlPath = join(root, 'control.json')
    const state = {
      route: 'root', sessions: [{ id: 'root' }, { id: 'child', parentID: 'root' }],
      messages: { root: [{ id: 'first', type: 'assistant' }, { id: 'second', type: 'assistant' }] },
      failures: [], blockRoot: true, events: [],
    }
    const writeControl = () => writeFile(controlPath, JSON.stringify(state))
    await writeControl()
    const directory = join(root, 'adapter')
    await writeSidebarAdapter({ directory, controlPath, oatsPath: join(oats, 'tui.js') })
    const plugin = (await import(pathToFileURL(join(directory, 'tui.js')).href)).default
    let route
    const ui = { router: { navigate(value) { route = value }, current() { return route } } }
    dispose = await plugin.setup({ ui, data: {}, client: {} })
    const context = globalThis.sidebarAdapterContext
    assert.equal(context.ui, ui)
    assert.deepEqual(route, { type: 'session', sessionID: 'root' })
    assert.deepEqual((await context.client.session.list({ parentID: 'root' })).data, [{ id: 'child', parentID: 'root' }])
    let finished = false
    const pending = context.client.message.list({ sessionID: 'root', order: 'asc', limit: 1 }).then(value => { finished = true; return value })
    await new Promise(resolve => setTimeout(resolve, 80))
    assert.equal(finished, false)
    await assert.rejects(readFile(`${controlPath}.completed`), { code: 'ENOENT' })
    assert.equal(await readFile(`${controlPath}.read`, 'utf8'), 'root')
    await context.client.message.list({ sessionID: 'child', order: 'asc' })
    assert.equal(await readFile(`${controlPath}.read`, 'utf8'), 'root', 'a read for a session not displayed is not a route acknowledgment')
    route = { type: 'session', sessionID: 'child' }
    await context.client.message.list({ sessionID: 'child', order: 'asc' })
    assert.equal(await readFile(`${controlPath}.read`, 'utf8'), 'child')
    const events = []
    context.data.on('session.step.ended', event => events.push(event))
    context.data.listen(event => events.push(event.details))
    state.blockRoot = false
    state.route = { type: 'home' }
    state.events.push({ id: 'e1', type: 'session.step.ended' })
    await writeControl()
    const first = await pending
    assert.deepEqual(first.data.map(m => m.id), ['first'])
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(await readFile(`${controlPath}.completed`, 'utf8'), 'root')
    const second = await context.client.message.list({ sessionID: 'root', cursor: first.cursor.next, limit: 1 })
    assert.deepEqual(second.data.map(m => m.id), ['second'])
    await new Promise(resolve => setTimeout(resolve, 120))
    assert.deepEqual(route, { type: 'home' })
    assert.equal(events.length, 2, 'each subscriber receives the event once')
    await dispose()
    dispose = undefined
    assert.equal(globalThis.sidebarAdapterCleaned, true)
  } finally {
    await dispose?.()
    delete globalThis.sidebarAdapterContext
    delete globalThis.sidebarAdapterCleaned
    await rm(root, { recursive: true, force: true })
  }
})
