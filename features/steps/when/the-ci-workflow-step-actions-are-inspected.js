import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'
When('the CI workflow step actions are inspected', function () {
  const dir = join(getRepoRoot(), '.github/workflows')
  assert(existsSync(dir), `Workflows directory not found at ${dir}`)
  const files = readdirSync(dir).filter(file => /\.ya?ml$/.test(file))
  assert(files.length, `No workflow files found in ${dir}`)
  const actions = []
  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      const match = line.match(/^\s*(?:-\s+.*)?uses:\s*([^\s#]+)(?:\s+#\s*(.*))?$/)
      if (!match || match[1].startsWith('./') || match[1].startsWith('/')) continue
      actions.push({ file, line: index + 1, action_ref: match[1], comment: (match[2] ?? '').trim(), raw_line: line.trim() })
    }
  }
  assert(actions.length, 'No external GitHub Actions references found across workflow files')
  this.workflow_actions = actions
})
