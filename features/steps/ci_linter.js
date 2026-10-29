import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, fstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const tools = {
  markdownlint: { command: join(root, 'node_modules/.bin/markdownlint-cli2'), matches: path => /\.md$/i.test(path) },
  yamllint: { command: 'yamllint', matches: path => /\.ya?ml$/i.test(path) },
  actionlint: { command: 'actionlint', matches: path => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path) },
  shellcheck: { command: 'shellcheck', matches: path => /\.(?:sh|bash|dash|ksh)$/i.test(path) },
}

function toolFor(kind) {
  if (!Object.hasOwn(tools, kind)) throw new Error('Invalid linter')
  return tools[kind]
}

// Tests use this to decide whether a fixture can run. Resolve exactly the
// command `runCiLinter` invokes: an installed Node tool is checked on disk, a
// PATH tool is looked up the same way the spawn will resolve it.
export function linterAvailable(kind) {
  const { command } = toolFor(kind)
  if (isAbsolute(command)) return existsSync(command)
  return (process.env.PATH ?? '').split(':').some(directory => directory && existsSync(join(directory, command)))
}

function hasShellShebang(cwd, path) {
  const target = join(cwd, path)
  if (!existsSync(target)) return false
  const fd = openSync(target, 'r')
  try {
    if (!fstatSync(fd).isFile()) return false
    const buffer = Buffer.alloc(256)
    const length = readSync(fd, buffer, 0, buffer.length, 0)
    return /^#![^\n]*\b(?:ba|da|k)?sh(?:\s|$)/.test(buffer.toString('utf8', 0, length).split('\n', 1)[0])
  } finally {
    closeSync(fd)
  }
}

function discoverFiles(cwd, kind, matches) {
  const scan = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (scan.error || scan.status !== 0) return { failure: { status: scan.status ?? 1, stdout: scan.stdout ?? '', stderr: scan.stderr || String(scan.error) } }
  const files = [...new Set(scan.stdout.split('\0').filter(path => path && existsSync(join(cwd, path)) && (matches(path) || (kind === 'shellcheck' && hasShellShebang(cwd, path)))))]
  // Linting nothing is a vacuous pass. Report it as a failure so a broken or
  // empty Git scan cannot silently satisfy the requirement.
  if (files.length === 0) return { failure: { status: 1, stdout: '', stderr: `No ${kind} files discovered in ${cwd}\n` } }
  return { files }
}

// Prefix every path so a filename can never be read as a glob or option. This
// matters for names such as "!evil.md" (globby negation) or "-dash.sh".
// markdownlint-cli2 additionally treats ":"-prefixed arguments as literal paths.
function literalFileArgs(kind, files) {
  return files.map(path => kind === 'markdownlint' ? `:${path}` : `./${path}`)
}

function validateFiles(files) {
  if (!Array.isArray(files)) throw new Error('Invalid linter file list')
  return files.map(path => {
    if (typeof path !== 'string' || !path || path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
      throw new Error('Invalid linter file list')
    }
    return path.replace(/^\.\//, '')
  })
}

// Identical entry point for CI and acceptance tests. Explicit fixture files are
// passed without shell expansion; the repository scan respects git ignores.
export function runCiLinter(kind, { cwd, files } = {}) {
  const tool = toolFor(kind)
  if (typeof cwd !== 'string') throw new Error('Invalid linter or working directory')
  if (files === undefined) {
    const discovery = discoverFiles(cwd, kind, tool.matches)
    if (discovery.failure) return discovery.failure
    files = discovery.files
  }
  files = validateFiles(files)
  const missing = files.filter(path => !existsSync(join(cwd, path)))
  if (missing.length) return { status: 1, stdout: '', stderr: `Missing linter files: ${missing.join(', ')}\n` }
  const args = literalFileArgs(kind, files)
  // Explicitly empty input still verifies that the tool is installed.
  const result = spawnSync(tool.command, args.length ? args : ['--version'], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: (result.stderr ?? '') + (result.error ? String(result.error) : '') }
}
