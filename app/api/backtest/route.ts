/**
 * GET /api/backtest
 * Returns full backtest results for all 56 instruments (55 sector stocks + BTC).
 * Cached for 1 hour. Filter with ?tickers=AAPL,NVDA
 *
 * POST /api/backtest — recompute (invalidates cache)
 */

import { NextResponse } from 'next/server'
import { SECTORS } from '@/lib/sectors'
import { loadStockHistory, loadBtcHistory } from '@/lib/backtest/dataLoader'
import { backtestInstrument, aggregatePortfolio } from '@/lib/backtest/engine'

// ─── In-memory cache ──────────────────────────────────────────────────────────

let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ─── Run backtest ────────────────────────────────────────────────────────────

async function runBacktest(filterTickers?: string[]): Promise<{
  runId: string
  computedAt: string
  instruments: { ticker: string; sector: string; candles: number }[]
  results: ReturnType<typeof backtestInstrument>[]
  portfolio: ReturnType<typeof aggregatePortfolio>
}> {
  const instruments: { ticker: string; sector: string; candles: number }[] = []
  const results: ReturnType<typeof backtestInstrument>[] = []

  for (const sector of SECTORS) {
    for (const ticker of sector.topHoldings) {
      if (filterTickers && !filterTickers.includes(ticker)) continue
      try {
        const rows = await loadStockHistory(ticker, 1825)
        instruments.push({ ticker, sector: sector.name, candles: rows.length })
        if (rows.length >= 100) {
          results.push(backtestInstrument(ticker, sector.name, rows))
        }
      } catch (e) {
        console.error(`[backtest] ${ticker}:`, e)
        instruments.push({ ticker, sector: sector.name, candles: 0 })
      }
    }
  }

  // BTC
  if (!filterTickers || filterTickers.includes('BTC')) {
    try {
      const btcRows = await loadBtcHistory(1825)
      if (btcRows.length > 0) {
        instruments.push({ ticker: 'BTC', sector: 'Crypto', candles: btcRows.length })
        results.push(backtestInstrument('BTC', 'Crypto', btcRows))
      }
    } catch (e) {
      console.error('[backtest] BTC:', e)
    }
  }

  const portfolio = aggregatePortfolio(results, 100_000)

  return {
    runId: `run_${Date.now()}`,
    computedAt: new Date().toISOString(),
    instruments,
    results,
    portfolio,
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tickersParam = searchParams.get('tickers')
  const filterTickers = tickersParam
    ? tickersParam.split(',').map(t => t.trim().toUpperCase())
    : undefined

  // Serve from cache only for full (unfiltered) runs
  if (!filterTickers && cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data)
  }

  try {
    const data = await runBacktest(filterTickers)
    if (!filterTickers) cache = { data, timestamp: Date.now() }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/backtest] error:', e)
    return NextResponse.json(
      { error: 'Backtest failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function POST() {
  cache = null
  try {
    const data = await runBacktest()
    cache = { data, timestamp: Date.now() }
    return NextResponse.json({ status: 'ok', computedAt: data.computedAt })
  } catch (e) {
    return NextResponse.json(
      { error: 'Recompute failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
