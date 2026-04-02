/**
 * Data loaders for backtest engine.
 * Fetches historical OHLCV from Yahoo Finance (stocks) and CoinGecko (BTC).
 */

import type { OhlcBar } from '@/lib/quant/technicals'

export interface OhlcvRow extends OhlcBar {
  time: number   // Unix seconds (not ms)
  volume: number
}

/** Normalize Yahoo Finance result to OhlcvRow[]. */
function normalizeYahooResult(rows: unknown[]): OhlcvRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return []
  return rows
    .filter((r: unknown): r is Record<string, unknown> => r !== null && typeof r === 'object')
    .map((r) => ({
      time: Math.floor(Number(r.timestamp) / 1000),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.time) &&
        Number.isFinite(r.open) &&
        Number.isFinite(r.high) &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.close) &&
        Number.isFinite(r.volume) &&
        r.volume >= 0 &&
        r.high >= r.low &&
        r.high >= r.open &&
        r.high >= r.close &&
        r.low <= r.open &&
        r.low <= r.close,
    )
    .sort((a, b) => a.time - b.time)
}

/**
 * Load historical daily OHLCV for a stock ticker via Yahoo Finance.
 * Uses the query1/query2 endpoint which is free and requires no API key.
 *
 * @param ticker  e.g. "AAPL", "NVDA"
 * @param days    Number of calendar days to load (default 1825 = ~5 years)
 */
export async function loadStockHistory(
  ticker: string,
  days = 1825,
): Promise<OhlcvRow[]> {
  const endMs = Date.now()
  const startMs = endMs - days * 86_400 * 1000
  const period1 = Math.floor(startMs / 1000)
  const period2 = Math.floor(endMs / 1000)

  const url =
    `https://query1.finance.yahoo.com/v7/finance/download/${encodeURIComponent(ticker)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/csv',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Yahoo Finance ${ticker} HTTP ${res.status}`)
  }

  const text = await res.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Skip header
  const dataRows = lines.slice(1).map((line) => {
    const [dateStr, openStr, highStr, lowStr, closeStr, adjCloseStr, volumeStr] =
      line.split(',')
    return {
      timestamp: new Date(dateStr!).getTime(),
      open: parseFloat(openStr!),
      high: parseFloat(highStr!),
      low: parseFloat(lowStr!),
      close: parseFloat(closeStr!),
      volume: parseFloat(volumeStr!),
    }
  })

  return normalizeYahooResult(dataRows)
}

/**
 * Load historical daily BTC/USD OHLCV from CoinGecko.
 * CoinGecko's /coins/bitcoin/ohlc endpoint returns [timestamp, open, high, low, close] in ms.
 *
 * @param days  Number of days (default 1825 = ~5 years)
 */
export async function loadBtcHistory(days = 1825): Promise<OhlcvRow[]> {
  const url =
    `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc` +
    `?vs_currency=usd&days=${days}`

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CoinGecko BTC OHLC HTTP ${res.status}`)

  const raw = await res.json()
  const rows = (Array.isArray(raw) ? raw : []) as [number, number, number, number, number][]
  if (rows.length === 0) return []

  return rows
    .map(([t, o, h, l, c]) => ({
      time: Math.floor(t / 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: 0, // CoinGecko OHLC endpoint doesn't include volume
    }))
    .filter(
      (r) =>
        Number.isFinite(r.time) &&
        Number.isFinite(r.open) &&
        Number.isFinite(r.high) &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.close),
    )
    .sort((a, b) => a.time - b.time)
}

/** Convert OhlcvRow[] to array of close prices for indicator functions. */
export function closesFromRows(rows: OhlcvRow[]): number[] {
  return rows.map((r) => r.close)
}

/** Convert OhlcvRow[] to OhlcBar[] (no time/volume). */
export function barsFromRows(rows: OhlcvRow[]): OhlcBar[] {
  return rows.map(({ open, high, low, close }) => ({ open, high, low, close }))
}
