/**
 * Cache 6 years of daily OHLCV for benchmark tickers to data/fixtures/*.json
 * Idempotent: skips tickers already cached.
 */
import YahooFinance from 'yahoo-finance2'
import type { OhlcvRow } from '@/lib/backtest/engine'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const yf = new YahooFinance()

async function fetchYahooDaily(ticker: string, lookbackDays: number): Promise<OhlcvRow[]> {
  const end = new Date()
  const start = new Date(end.getTime() - lookbackDays * 86400_000)
  const r = await yf.chart(ticker, {
    period1: Math.floor(start.getTime() / 1000),
    period2: Math.floor(end.getTime() / 1000),
    interval: '1d',
  })
  if (!r?.quotes) return []
  return r.quotes.map((q: any) => ({
    time: q.date ? Math.floor(new Date(q.date).getTime() / 1000) : 0,
    open: q.open ?? 0,
    high: q.high ?? 0,
    low: q.low ?? 0,
    close: q.close ?? 0,
    volume: q.volume ?? 0,
  }))
}

const TICKERS: { ticker: string; sector: string }[] = [
  { ticker: 'AAPL', sector: 'Technology' },
  { ticker: 'MSFT', sector: 'Technology' },
  { ticker: 'NVDA', sector: 'Technology' },
  { ticker: 'GOOG', sector: 'Communications' },
  { ticker: 'META', sector: 'Communications' },
  { ticker: 'AMZN', sector: 'Consumer Discretionary' },
  { ticker: 'SPY',  sector: 'Broad Market' },
  { ticker: 'QQQ',  sector: 'Broad Market' },
  { ticker: 'JPM',  sector: 'Financials' },
  { ticker: 'V',    sector: 'Financials' },
  { ticker: 'UNH',  sector: 'Healthcare' },
  { ticker: 'XOM',  sector: 'Energy' },
  { ticker: 'CVX',  sector: 'Energy' },
  { ticker: 'WMT',  sector: 'Consumer Staples' },
  { ticker: 'HD',   sector: 'Consumer Discretionary' },
  { ticker: 'PG',   sector: 'Consumer Staples' },
  { ticker: 'KO',   sector: 'Consumer Staples' },
  { ticker: 'JNJ',  sector: 'Healthcare' },
  { ticker: 'CAT',  sector: 'Industrials' },
  { ticker: 'BA',   sector: 'Industrials' },
]

const LOOKBACK_DAYS = 6 * 365 // ~6 years
const OUT_DIR = 'data/fixtures'

mkdirSync(OUT_DIR, { recursive: true })

async function main() {
  for (const { ticker, sector } of TICKERS) {
    const fp = join(OUT_DIR, `${ticker}.json`)
    if (existsSync(fp)) { console.log(`  [skip] ${ticker} (cached)`); continue }
    try {
      const rows = await fetchYahooDaily(ticker, LOOKBACK_DAYS)
      const clean = rows.filter(r => r.time > 0 && r.close > 0 && r.high >= r.low)
      writeFileSync(fp, JSON.stringify({ ticker, sector, rows: clean }))
      console.log(`  [ok]   ${ticker} ${clean.length} bars`)
      // Rate-limit: 120ms between requests
      await new Promise(r => setTimeout(r, 120))
    } catch (e) {
      console.log(`  [FAIL] ${ticker}: ${e instanceof Error ? e.message : e}`)
    }
  }
}

main().then(() => console.log('[cache-real-data] done')).catch(e => { console.error(e); process.exit(1) })
