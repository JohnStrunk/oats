// Syntactic scan of the repository's own JavaScript sources for external
// package imports. The repository manifest must declare every external
// package this scan finds: an import that resolves only through a hoisted
// transitive dependency breaks when the lock file changes.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

// Resolved without a trailing separator so relative scan results can be cut
// from the absolute paths with a fixed offset.
const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

// The repository's own sources only; dependency and tool checkouts such as
// node_modules and .github are never scanned.
const SCAN_DIRECTORIES = ['src', 'features', 'scripts']
const SCAN_FILES = ['tui.js', 'cucumber.js']
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs'])

// Every root the specification requires must contribute at least one source,
// or the declaration check could pass vacuously after a directory rename.
const REQUIRED_ROOTS = ['src', 'features/steps', 'features/real-host-tests', 'features/tests', 'scripts']
const REQUIRED_FILES = ['tui.js', 'cucumber.js']

// Import declarations are valid only at module top level and start a line in
// this repository's formatting, so anchoring the keyword at the start of a
// line keeps prose in comments and strings from being mistaken for an
// import. The clause between the keyword and `from` may contain only
// identifiers, braces, commas, stars, and whitespace, so ordinary statements
// cannot match. Dynamic imports and require calls are expression positions
// and cannot be anchored; matches that sit on a line beginning with a
// line-comment marker are discarded the same way. This is a syntactic scan,
// not module resolution: quoted specifiers inside string or template-literal
// content that begins a line cannot be told apart from code without a
// parser, and block comments are not recognized.
const STATIC_IMPORT = /^[ \t]*import\s+(?:type\s+)?[$\w{},*\s]+?from\s*(['"])([^'"]+)\1/gm
const BARE_IMPORT = /^[ \t]*import\s*(['"])([^'"]+)\1/gm
const EXPORT_FROM = /^[ \t]*export\s+(?:type\s+)?[$\w{},*\s]*?from\s*(['"])([^'"]+)\1/gm
const DYNAMIC_IMPORT = /(?<![.\w$])import\s*\(\s*(['"])([^'"]+)\1\s*\)/g
const REQUIRE_CALL = /(?<![.\w$])require\s*\(\s*(['"])([^'"]+)\1\s*\)/g
const PATTERNS = [STATIC_IMPORT, BARE_IMPORT, EXPORT_FROM, DYNAMIC_IMPORT, REQUIRE_CALL]

// True when the match position is preceded on its own line only by
// whitespace and a line-comment marker.
function onCommentLine(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  return /^[ \t]*\/\//.test(text.slice(lineStart, index))
}

export function extractImportSpecifiers(text) {
  const specifiers = []
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (onCommentLine(text, match.index)) continue
      specifiers.push(match[2])
    }
  }
  return specifiers
}

// Reduce an import specifier to its package name: the first two segments of
// a scoped name, or the first segment of an unscoped one. Relative and
// absolute paths, package.json import aliases, and Node built-ins are not
// external packages and reduce to null.
export function reduceToPackageName(specifier) {
  if (typeof specifier !== 'string' || specifier === '') return null
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) return null
  if (specifier.startsWith('node:')) return null
  const segments = specifier.split('/')
  const packageName = specifier.startsWith('@')
    ? (segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null)
    : segments[0]
  if (packageName === null || builtinModules.includes(packageName)) return null
  return packageName
}

function repositorySourceFiles() {
  const files = []
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      // Never descend into dependency or version-control checkouts.
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path)
    }
  }
  for (const directory of SCAN_DIRECTORIES) walk(join(REPO_ROOT, directory))
  return [...SCAN_FILES.map(name => join(REPO_ROOT, name)), ...files]
}

function assertScanCoverage(files) {
  const scanned = files.map(path => path.slice(REPO_ROOT.length + 1))
  for (const root of REQUIRED_ROOTS) {
    assert.ok(scanned.some(name => name.startsWith(`${root}/`)),
      `The import scan must cover the ${root}/ sources`)
  }
  for (const name of REQUIRED_FILES) {
    assert.ok(scanned.includes(name), `The import scan must cover ${name}`)
  }
}

export function scanRepositoryImports() {
  const files = repositorySourceFiles()
  assertScanCoverage(files)
  const imports = []
  for (const path of files) {
    const file = path.slice(REPO_ROOT.length + 1)
    for (const specifier of extractImportSpecifiers(readFileSync(path, 'utf8'))) {
      imports.push({ file, specifier })
    }
  }
  assert.ok(imports.length > 0, 'The import scan must find at least one import')
  return imports
}
