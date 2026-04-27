/**
 * Align multiple OHLCV series to the same UTC trading-day calendar so that
 * downstream portfolio aggregation (equal-weight sum of equity curves) sums
 * index i only when all instruments refer to the same calendar date.
 */

import type { OhlcvRow } from '@/lib/backtest/engine'

export function utcDayKey(timeSec: number): string {
  return new Date(timeSec * 1000).toISOString().slice(0, 10)
}

/** One row per UTC calendar day; if duplicates exist, last row wins. */
function dedupeLastPerUtcDay(rows: OhlcvRow[]): OhlcvRow[] {
  const byDay = new Map<string, OhlcvRow>()
  for (const r of rows) {
    byDay.set(utcDayKey(r.time), r)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)
}

/**
 * Inner-join all tickers on dates present in every series (deduped to one bar/day).
 * Returns null if fewer than `minTradingDays` common days or any ticker lacks a bar on a common day.
 */
export function alignOhlcvSeries(
  seriesByTicker: Record<string, OhlcvRow[]>,
  opts?: { minTradingDays?: number },
): Record<string, OhlcvRow[]> | null {
  const minDays = opts?.minTradingDays ?? 252
  const tickers = Object.keys(seriesByTicker).filter((t) => (seriesByTicker[t]?.length ?? 0) > 0)
  if (tickers.length === 0) return null

  const deduped: Record<string, OhlcvRow[]> = {}
  for (const t of tickers) {
    deduped[t] = dedupeLastPerUtcDay(seriesByTicker[t]!)
  }

  let common: Set<string> | null = null
  for (const t of tickers) {
    const daySet = new Set(deduped[t].map((r) => utcDayKey(r.time)))
    if (common == null) {
      common = daySet
    } else {
      const next = new Set<string>()
      for (const d of common) {
        if (daySet.has(d)) next.add(d)
      }
      common = next
    }
  }
  if (!common || common.size < minDays) return null

  const sortedDays = [...common].sort()
  const out: Record<string, OhlcvRow[]> = {}
  for (const t of tickers) {
    const byDay = new Map(deduped[t].map((r) => [utcDayKey(r.time), r] as const))
    const aligned: OhlcvRow[] = []
    for (const d of sortedDays) {
      const row = byDay.get(d)
      if (!row) return null
      aligned.push(row)
    }
    out[t] = aligned
  }
  return out
}
