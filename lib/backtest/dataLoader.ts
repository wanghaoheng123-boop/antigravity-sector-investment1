/**
 * Backtest data loaders — used by API routes.
 * Fetches historical OHLCV from Yahoo Finance (stocks) and CoinGecko (BTC).
 * All functions are pure (no side effects).
 */

import type { OhlcBar } from '@/lib/quant/technicals'

export interface OhlcvRow {
  time: number   // Unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function normalizeYahooCsv(csvText: string): OhlcvRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const rows: OhlcvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const parts = line.split(',')
    const dateStr = parts[0]
    const open = parseFloat(parts[1])
    const high = parseFloat(parts[2])
    const low = parseFloat(parts[3])
    const close = parseFloat(parts[4])
    const volume = parseFloat(parts[6] ?? '0')
    const time = Math.floor(new Date(dateStr!).getTime() / 1000)
    if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(high) ||
        !Number.isFinite(low) || !Number.isFinite(close)) continue
    rows.push({ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 })
  }
  rows.sort((a, b) => a.time - b.time)
  return rows
}

/**
 * Load daily OHLCV history for a stock ticker from Yahoo Finance.
 * Uses the free CSV download endpoint (no API key required).
 *
 * @param ticker  e.g. "AAPL", "NVDA"
 * @param days    Calendar days to fetch (default 1825 = ~5 years)
 */
export async function loadStockHistory(
  ticker: string,
  days = 1825,
): Promise<OhlcvRow[]> {
  const endMs = Date.now()
  const startMs = endMs - days * 86_400_000
  const url =
    `https://query1.finance.yahoo.com/v7/finance/download/${encodeURIComponent(ticker)}` +
    `?period1=${Math.floor(startMs / 1000)}&period2=${Math.floor(endMs / 1000)}` +
    `&interval=1d&events=history&includeAdjustedClose=true`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/csv',
    },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Yahoo Finance ${ticker} HTTP ${res.status}`)
  const text = await res.text()
  return normalizeYahooCsv(text)
}

/**
 * Load daily BTC/USD OHLCV from CoinGecko.
 * CoinGecko's OHLC endpoint returns [timestamp, open, high, low, close] in milliseconds.
 * Volume is not available from this endpoint.
 *
 * @param days  Calendar days (default 1825 = ~5 years)
 */
export async function loadBtcHistory(days = 1825): Promise<OhlcvRow[]> {
  const url =
    `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc` +
    `?vs_currency=usd&days=${days}`

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CoinGecko BTC OHLC HTTP ${res.status}`)
  const rows = (await res.json()) as [number, number, number, number, number][]
  if (!Array.isArray(rows) || rows.length === 0) return []

  const out: OhlcvRow[] = []
  for (const [t, o, h, l, c] of rows) {
    if (!Number.isFinite(t)) continue
    out.push({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c, volume: 0 })
  }
  out.sort((a, b) => a.time - b.time)
  return out
}

/** Convert OhlcvRow[] to close price array. */
export function closesFromRows(rows: OhlcvRow[]): number[] {
  return rows.map(r => r.close)
}

/** Convert OhlcvRow[] to OhlcBar[] (strip time/volume). */
export function barsFromRows(rows: OhlcvRow[]): OhlcBar[] {
  return rows.map(({ open, high, low, close }) => ({ open, high, low, close }))
}
