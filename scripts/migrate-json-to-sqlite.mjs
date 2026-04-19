/**
 * One-time migration: scripts/backtestData/*.json → SQLite warehouse.
 * Requires Node.js ≥ 22.5 (`node:sqlite` DatabaseSync).
 *
 * Usage: node scripts/migrate-json-to-sqlite.mjs [output.db]
 * Default DB: ./quantan-warehouse.db (project root)
 *
 * If the DB path lives on Google Drive / OneDrive, SQLite may report "database is locked";
 * write the file to a local path (e.g. %TEMP%\\quantan-warehouse.db) and set QUANTAN_SQLITE_PATH there.
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, isAbsolute } from 'path'

const root = process.cwd()
const dataDir = join(root, 'scripts', 'backtestData')
const outArg = process.argv[2]
const outPath = outArg ? (isAbsolute(outArg) ? outArg : join(root, outArg)) : join(root, 'quantan-warehouse.db')

if (!existsSync(dataDir)) {
  console.error('Missing directory:', dataDir)
  process.exit(1)
}

const db = new DatabaseSync(outPath, { timeout: 120_000 })
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS candles (
    ticker TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ticker, date)
  );
  CREATE TABLE IF NOT EXISTS quotes (
    ticker TEXT PRIMARY KEY,
    price REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))
const pending = []

for (const file of files) {
  const path = join(dataDir, file)
  const raw = JSON.parse(readFileSync(path, 'utf-8'))
  const ticker = String(raw.ticker ?? file.replace(/\.json$/i, '')).toUpperCase()
  const candles = Array.isArray(raw.candles) ? raw.candles : []
  for (const c of candles) {
    if (!Number.isFinite(c.time) || !Number.isFinite(c.close)) continue
    const d = new Date(c.time * 1000)
    const date = d.toISOString().slice(0, 10)
    pending.push({
      ticker,
      date,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number.isFinite(c.volume) ? Math.round(c.volume) : 0,
    })
  }
}

const BATCH = 400
function flushBatch(batch) {
  if (batch.length === 0) return
  const ph = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
  const sql = `INSERT OR REPLACE INTO candles (ticker, date, open, high, low, close, volume) VALUES ${ph}`
  const args = batch.flatMap((r) => [r.ticker, r.date, r.open, r.high, r.low, r.close, r.volume])
  db.prepare(sql).run(...args)
}

db.exec('BEGIN IMMEDIATE')
for (let i = 0; i < pending.length; i += BATCH) {
  flushBatch(pending.slice(i, i + BATCH))
}
db.exec('COMMIT')

db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('migratedAt', ?)`).run(new Date().toISOString())

db.close()
console.log('Wrote', pending.length, 'candle rows for', files.length, 'tickers →', outPath)
