import { readFile, rm } from 'node:fs/promises'

export async function resetSidebarReadAck(controlPath) {
  await rm(`${controlPath}.read`, { force: true })
}

export async function waitForSidebarReadAck(controlPath, sessionID, { timeoutMs = 10000, pollMs = 40 } = {}) {
  const deadline = Date.now() + timeoutMs
  do {
    const value = await readFile(`${controlPath}.read`, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return ''
      throw error
    })
    if (value === sessionID) return
    if (Date.now() >= deadline) break
    await new Promise(resolve => setTimeout(resolve, pollMs))
  } while (true)
  throw new Error(`the displayed session ${sessionID} did not start a history read`)
}
