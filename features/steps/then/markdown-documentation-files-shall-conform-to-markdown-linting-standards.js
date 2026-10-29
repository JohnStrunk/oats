import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('markdown documentation files shall conform to markdown linting standards', function () { assert(this.markdown_linter_executed, 'Markdown linter was not executed') })
