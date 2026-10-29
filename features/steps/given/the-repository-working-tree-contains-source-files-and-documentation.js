import { Given } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository working tree contains source files and documentation', function () { assert(readdirSync(getRepoRoot()).length > 0, 'Repository root is unexpectedly empty') })
