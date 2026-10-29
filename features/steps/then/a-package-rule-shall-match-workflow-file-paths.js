import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('a package rule shall match workflow file paths', function () {
  const rules = this.renovate_config?.packageRules ?? []
  const rule = rules.find(rule => rule && typeof rule === 'object' && (rule.matchFileNames ?? []).some(name => name.includes('.github/workflows')))
  assert(rule, `No package rule matching matchFileNames with .github/workflows found in: ${JSON.stringify(rules)}`)
  this.workflow_package_rule = rule
})
