import { PROCESS_MAX_CLEANUP_MS } from './migration-process.js'

export const MIGRATION_RUN_TIMEOUT_MS = 120000
// Allow bounded supervisor cleanup plus a margin for sandbox setup and reports.
export const MIGRATION_STEP_TIMEOUT_MS = MIGRATION_RUN_TIMEOUT_MS + PROCESS_MAX_CLEANUP_MS + 10000
