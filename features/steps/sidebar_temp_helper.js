import { statSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Prefer the workspace's approved temporary root, but CI runners may not have
// it. Do not create the shared root; use the OS-provided temporary directory.
export function sidebarTempRoot({ preferred = '/tmp/opencode', fallback = tmpdir() } = {}) {
  try {
    if (statSync(preferred).isDirectory()) return preferred
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
  }
  return fallback
}

export async function createSidebarTemp(prefix, options) {
  return mkdtemp(join(sidebarTempRoot(options), prefix))
}
