/**
 * SQLite warehouse schema + helpers (local backtests & scripts).
 * Callers supply a DB handle (e.g. `node:sqlite` `DatabaseSync` on Node ≥ 22.5).
 * On Vercel, omit `QUANTAN_SQLITE_PATH` so `dataLoader` keeps using JSON.
 */

export const WAREHOUSE_ENV_PATH = 'QUANTAN_SQLITE_PATH'

/** Minimal DB surface used by backtest loaders. */
export type WarehouseDb = {
  prepare(sql: string): {
    run(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }
  exec(sql: string): void
  close(): void
}

/** Match `loadLocalData` file slug: `BRK.B` → `BRK-B`. */
export function warehouseTickerKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\./g, '-')
}

export function initWarehouseSchema(db: WarehouseDb): void {
  db.exec(`
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
}

export type WarehouseCandleRow = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function readCandles(db: WarehouseDb, tickerKey: string): WarehouseCandleRow[] {
  const stmt = db.prepare(
    `SELECT date, open, high, low, close, volume FROM candles WHERE ticker = ? ORDER BY date ASC`
  )
  return stmt.all(tickerKey) as WarehouseCandleRow[]
}

export function listWarehouseTickers(db: WarehouseDb): string[] {
  const rows = db.prepare(`SELECT DISTINCT ticker FROM candles ORDER BY ticker`).all() as { ticker: string }[]
  return rows.map((r) => r.ticker)
}
