import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const r = spawnSync(process.execPath, [join(dir, 'smoke-production.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_EXTENDED: '1' },
})
process.exit(r.status ?? 1)
