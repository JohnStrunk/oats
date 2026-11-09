import { When } from '@cucumber/cucumber'
import { scanRepositoryImports } from '../source_import_scanner.js'

When('the repository JavaScript sources are scanned for package imports', function () {
  this.source_imports = scanRepositoryImports()
})
