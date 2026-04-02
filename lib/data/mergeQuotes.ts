import type { BloombergQuoteNormalized } from './bloomberg/bridgeClient'

export type UnifiedQuote = {
  ticker: string
  price: number
  change: number
  changePct: number
  volume: number
  high52w: number
  low52w: number
  pe: number
  marketCap: string
  /** Vendor last trade / regular session time when available (ISO). */
  quoteTime?: string | null
  bid?: number
  ask?: number
  dataSource: 'bloomberg' | 'yahoo' | 'mixed'
}

export type YahooQuoteLike = Omit<UnifiedQuote, 'dataSource'> & { dataSource?: 'yahoo' }

/**
 * Prefer Bloomberg for overlapping tickers; fill gaps from Yahoo.
 * If Bloomberg only provides subset, `mixed` per row when both used (not typical — usually one source per ticker).
 */
export function mergeYahooAndBloomberg(
  yahoo: YahooQuoteLike[],
  bloomberg: Map<string, BloombergQuoteNormalized> | null
): UnifiedQuote[] {
  if (!bloomberg || bloomberg.size === 0) {
    return yahoo.map((q) => ({ ...q, dataSource: 'yahoo' as const }))
  }

  const out: UnifiedQuote[] = []
  const seen = new Set<string>()

  for (const y of yahoo) {
    const bb = bloomberg.get(y.ticker)
    if (bb) {
      out.push({
        ticker: y.ticker,
        price: bb.price,
        change: bb.change,
        changePct: bb.changePct,
        volume: bb.volume || y.volume,
        high52w: bb.high52w || y.high52w,
        low52w: bb.low52w || y.low52w,
        pe: bb.pe || y.pe,
        marketCap: bb.marketCap !== 'N/A' ? bb.marketCap : y.marketCap,
        quoteTime: y.quoteTime ?? null,
        bid: bb.bid,
        ask: bb.ask,
        dataSource: 'bloomberg',
      })
      seen.add(y.ticker)
    } else {
      out.push({ ...y, dataSource: 'yahoo' })
      seen.add(y.ticker)
    }
  }

  for (const [t, bb] of bloomberg) {
    if (seen.has(t)) continue
    out.push({
      ticker: t,
      price: bb.price,
      change: bb.change,
      changePct: bb.changePct,
      volume: bb.volume,
      high52w: bb.high52w,
      low52w: bb.low52w,
      pe: bb.pe,
      marketCap: bb.marketCap,
      bid: bb.bid,
      ask: bb.ask,
      dataSource: 'bloomberg',
    })
  }

  return out
}
