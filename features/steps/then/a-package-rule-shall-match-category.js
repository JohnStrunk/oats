import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('a package rule shall match the {string} category', function (category) {
  const rules = this.renovate_config?.packageRules ?? []
  const rule = rules.find(rule => rule && typeof rule === 'object' && (rule.matchCategories ?? []).includes(category))
  assert(rule, `No package rule matching matchCategories: ['${category}'] found in ${JSON.stringify(rules)}`)
  this.docker_rule = rule
})
