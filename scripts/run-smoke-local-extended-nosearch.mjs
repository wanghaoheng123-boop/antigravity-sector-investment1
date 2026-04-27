import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const port = process.env.SMOKE_LOCAL_PORT || '3000'
const base = `http://127.0.0.1:${port}`
const dir = dirname(fileURLToPath(import.meta.url))

const r = spawnSync(process.execPath, [join(dir, 'smoke-production.mjs')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SMOKE_BASE_URL: base,
    SMOKE_EXTENDED: '1',
    SMOKE_SKIP_SEARCH: '1',
  },
})
process.exit(r.status ?? 1)
