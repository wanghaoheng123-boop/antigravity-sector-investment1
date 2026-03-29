/**
 * Shared types for the dark pool analytics API.
 * Imported by DarkPoolPanel and the sector/stock pages.
 */

export interface DarkPoolMetric {
  offExchangePct: number | null
  onExchangePct: number | null
  offExchangeShares: number | null
  totalShares: number | null
  sharesShorted: number | null
  shortFloatPct: number | null
  daysToCover: number | null
  avgDailyVolume: number | null
  sharesOutstanding: number | null
  sharesFloat: number | null
}

export interface PricePoint {
  price: number
  change: number
  changePct: number
  quoteTime: string | null
}

export interface DarkPoolAnalysis {
  ticker: string
  fetchedAt: string
  quote: PricePoint
  metrics: DarkPoolMetric
  hasRealData: boolean
  statusNote: string | null
}
