/**
 * Market data provider abstraction (Phase 5).
 * Aligns daily bars with backtest `OhlcvRow` shape (unix day open, OHLCV).
 */

export type ChartInterval = '1d' | '1wk' | '1mo'

export interface DailyFetchOptions {
  period1: Date
  interval: ChartInterval
}

/** One daily (or weekly/monthly) bar — `time` is Unix seconds at bar open. */
export interface ProviderDailyBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ProviderQuote {
  symbol: string
  price: number
  regularMarketTime: Date | null
  /** Yahoo-only enrichments (optional). */
  dividendYield?: number | null
  averageDailyVolume3Month?: number | null
}

export interface DataProvider {
  readonly name: string
  isAvailable(): boolean
  /** Returns null if unavailable or no data. */
  fetchDaily(symbol: string, opts: DailyFetchOptions): Promise<ProviderDailyBar[] | null>
  fetchQuote(symbol: string): Promise<ProviderQuote | null>
}
