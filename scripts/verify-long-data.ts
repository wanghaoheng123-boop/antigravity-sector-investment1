/**
 * Phase 8 sanity check for long-history candles in SQLite warehouse.
 * Ensures OHLC constraints + major gap detection.
 */

import { DatabaseSync } from 'node:sqlite'
import { isAbsolute, join } from 'node:path'
import { listWarehouseTickers, readCandles } from '../lib/data/warehouse'

function resolveDbPath(): string {
  const env = process.env.QUANTAN_SQLITE_PATH?.trim()
  if (env) return env
  const arg = process.argv[2]?.trim()
  if (arg) return isAbsolute(arg) ? arg : join(process.cwd(), arg)
  return join(process.cwd(), 'quantan-warehouse.db')
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function main(): void {
  const requireWarehouse = process.env.QUANTAN_REQUIRE_WAREHOUSE === '1'
  let db: DatabaseSync
  try {
    db = new DatabaseSync(resolveDbPath(), { timeout: 120_000 })
  } catch (e) {
    if (requireWarehouse) throw e
    console.warn(`[verify:data:long] skip: cannot open SQLite (${String(resolveDbPath())})`, e)
    return
  }
  let tickers: string[] = []
  try {
    tickers = listWarehouseTickers(db)
  } catch (e) {
    db.close()
    if (requireWarehouse) throw e
    console.warn('[verify:data:long] skip: warehouse schema/tables not ready', e)
    return
  }
  if (!tickers.length) {
    db.close()
    if (requireWarehouse) {
      console.error('[verify:data:long] fail: no candles in warehouse (QUANTAN_REQUIRE_WAREHOUSE=1)')
      process.exit(1)
    }
    console.warn('[verify:data:long] skip: no candles in warehouse (use scripts/backtestData JSON or populate DB)')
    return
  }
  let failed = 0
  for (const ticker of tickers) {
    const rows = readCandles(db, ticker)
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i]
      const ohlcOk =
        Number.isFinite(r.open) &&
        Number.isFinite(r.high) &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.close) &&
        r.high >= Math.max(r.open, r.close) &&
        r.low <= Math.min(r.open, r.close)
      if (!ohlcOk) {
        failed += 1
        console.error(`[verify:data:long] ${ticker} bad ohlc ${r.date}`)
      }
      if (i > 0) {
        const gap = daysBetween(rows[i - 1].date, r.date)
        if (gap > 8) {
          failed += 1
          console.error(`[verify:data:long] ${ticker} large gap ${rows[i - 1].date} -> ${r.date} (${gap}d)`)
        }
      }
    }
  }
  db.close()
  if (failed > 0) process.exit(1)
  console.log(`[verify:data:long] ok tickers=${tickers.length}`)
}

main()

