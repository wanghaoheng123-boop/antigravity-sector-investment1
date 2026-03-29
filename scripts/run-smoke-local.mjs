/**
 * Run smoke tests against local Next dev (default http://127.0.0.1:3000).
 * Start the app first: npm run dev -- --hostname 127.0.0.1 --port 3000
 * Override port: SMOKE_LOCAL_PORT=3001 node scripts/run-smoke-local.mjs
 * If /api/search is broken on an old dev build: SMOKE_SKIP_SEARCH=1 node scripts/run-smoke-local.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const port = process.env.SMOKE_LOCAL_PORT || '3000'
const base = `http://127.0.0.1:${port}`
const dir = dirname(fileURLToPath(import.meta.url))

const r = spawnSync(process.execPath, [join(dir, 'smoke-production.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_BASE_URL: base },
})
process.exit(r.status ?? 1)
