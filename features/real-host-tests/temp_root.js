import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The workspace prefers /tmp/opencode so long-running debugging trees are easy
// to find, but fresh CI runners and other users' machines may not have it. Never
// create or delete the shared preferred root here: use it only when it is an
// existing directory, otherwise fall back to the OS temporary directory.
export const PREFERRED_TEMP_ROOT = '/tmp/opencode'

export function tempRootBase({ preferred = PREFERRED_TEMP_ROOT, fallback = tmpdir() } = {}) {
  try {
    if (statSync(preferred).isDirectory()) return preferred
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
  }
  return fallback
}

export function createTempDir(prefix, options = {}) {
  const preferred = options.preferred ?? PREFERRED_TEMP_ROOT
  const fallback = options.fallback ?? tmpdir()
  const base = tempRootBase({ preferred, fallback })
  try {
    return mkdtempSync(join(base, prefix))
  } catch (error) {
    if (base === fallback) throw error
    return mkdtempSync(join(fallback, prefix))
  }
}
