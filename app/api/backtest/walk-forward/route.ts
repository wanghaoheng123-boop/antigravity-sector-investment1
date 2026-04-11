/**
 * GET /api/backtest/walk-forward?ticker=AAPL&trainDays=252&testDays=63
 *
 * Runs a walk-forward analysis for a single ticker and returns the IS/OOS
 * performance windows plus the overfitting index.
 *
 * Walk-forward is the gold standard for detecting strategy overfitting:
 *   - In-sample (IS): train window where signals are calibrated
 *   - Out-of-sample (OOS): test window held out during training
 *   - OOS ratio ≈ 1.0: robust strategy; < 0.5: likely curve-fit
 *
 * Query params:
 *   ticker    — required, e.g. "AAPL"
 *   trainDays — IS window in bars (default: 252 = ~1 year)
 *   testDays  — OOS window in bars (default: 63 = ~1 quarter)
 */

import { NextResponse } from 'next/server'
import { loadStockHistory } from '@/lib/backtest/dataLoader'
import {
  walkForwardAnalysis,
  walkForwardSummary,
} from '@/lib/backtest/engine'
import { yahooSymbolFromParam } from '@/lib/quant/yahooSymbol'

export const runtime = 'nodejs'

// Cache walk-forward results for 1 hour (computation is expensive)
export const revalidate = 3600

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)

  const tickerParam = searchParams.get('ticker')
  if (!tickerParam) {
    return NextResponse.json({ error: 'ticker query param required' }, { status: 400 })
  }

  const ticker    = yahooSymbolFromParam(tickerParam).toUpperCase()
  const trainDays = Math.min(504, Math.max(63, parseInt(searchParams.get('trainDays') ?? '252', 10)))
  const testDays  = Math.min(126, Math.max(21, parseInt(searchParams.get('testDays')  ?? '63',  10)))

  const rows = loadStockHistory(ticker)
  if (rows.length < trainDays + testDays) {
    return NextResponse.json(
      {
        error: `Insufficient data for ${ticker}: ${rows.length} bars available, ` +
               `need at least ${trainDays + testDays} (trainDays=${trainDays} + testDays=${testDays}).`,
        availableBars: rows.length,
        requiredBars: trainDays + testDays,
      },
      { status: 422 }
    )
  }

  // Derive sector from ticker (best-effort)
  const SECTOR_MAP: Record<string, string> = {
    AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Technology', META: 'Technology',
    AMZN: 'Consumer Discretionary', TSLA: 'Consumer Discretionary',
    JPM: 'Financials', GS: 'Financials', BAC: 'Financials',
    XOM: 'Energy', CVX: 'Energy',
    JNJ: 'Healthcare', UNH: 'Healthcare',
    SPY: 'Broad Market', QQQ: 'Technology', BTC: 'Crypto',
  }
  const sector = SECTOR_MAP[ticker] ?? 'Unknown'

  const windows = walkForwardAnalysis(ticker, sector, rows, trainDays, testDays)
  const summary = walkForwardSummary(windows)

  // Interpret overfitting index
  let overfitLabel: string
  if (summary.overfittingIndex < 0.2)      overfitLabel = 'Robust — IS and OOS closely track'
  else if (summary.overfittingIndex < 0.5)  overfitLabel = 'Mild degradation — typical for trend strategies'
  else if (summary.overfittingIndex < 0.75) overfitLabel = 'Moderate overfitting — review signal parameters'
  else                                       overfitLabel = 'Significant overfitting — strategy may be curve-fit'

  return NextResponse.json(
    {
      ticker,
      trainDays,
      testDays,
      totalBars: rows.length,
      windowCount: windows.length,
      summary: {
        ...summary,
        overfitLabel,
      },
    },
    {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      },
    }
  )
}
