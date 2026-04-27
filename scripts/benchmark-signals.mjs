/**
 * Signal / data quality gate (stub benchmark).
 * Full multi-instrument win-rate benchmark can extend this script later.
 */

import { spawnSync } from 'node:child_process'

console.log('[benchmark-signals] Running npm run verify:data …')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const r = spawnSync(npmCmd, ['run', 'verify:data'], { stdio: 'inherit', shell: false })
process.exit(r.status === 0 ? 0 : 1)
