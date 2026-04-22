import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { backtestInstrument, aggregatePortfolio, type BacktestResult } from '@/lib/backtest/engine'
import { loadLongHistory } from '@/lib/backtest/dataLoader'
import { alignOhlcvSeries } from '@/lib/backtest/calendarAlign'
import { SECTORS } from '@/lib/sectors'
import { DEFAULT_CONFIG } from '@/lib/backtest/signals'

type WindowYears = 10 | 15 | 20 | 30

const WINDOWS: WindowYears[] = [10, 15, 20, 30]
const CORE_UNIVERSE = Array.from(new Set([
  ...SECTORS.slice(0, 6).flatMap((s) => s.topHoldings.slice(0, 2)),
  'SPY',
  'QQQ',
  'GLD',
  'BTC',
]))

interface WindowResult {
  years: WindowYears
  instruments: number
  alignedTradingDays: number
  coverageRatio: number
  totalReturn: number
  annualizedReturn: number
  winRate: number
  maxDrawdown: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  /** Median across names — comparable to portfolio row when histories differ in depth. */
  medianAnnualizedReturn: number
  medianSharpeRatio: number | null
  medianSortinoRatio: number | null
  historyDiagnostics: Array<{
    ticker: string
    requestedYears: number
    loadedRows: number
    alignedRows: number
  }>
}

function medianSorted(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function medianRisk(results: BacktestResult[]): {
  medianAnnualizedReturn: number
  medianSharpeRatio: number | null
  medianSortinoRatio: number | null
} {
  const ann = results.map((r) => r.annualizedReturn)
  const sh = results.map((r) => r.sharpeRatio).filter((x): x is number => x != null && Number.isFinite(x))
  const so = results.map((r) => r.sortinoRatio).filter((x): x is number => x != null && Number.isFinite(x))
  return {
    medianAnnualizedReturn: medianSorted(ann),
    medianSharpeRatio: sh.length ? medianSorted(sh) : null,
    medianSortinoRatio: so.length ? medianSorted(so) : null,
  }
}

function failedWindow(years: WindowYears, reason: string): WindowResult {
  console.warn(`[backtest:matrix] ${years}y window: ${reason}`)
  return {
    years,
    instruments: 0,
    alignedTradingDays: 0,
    coverageRatio: 0,
    totalReturn: 0,
    annualizedReturn: -1,
    winRate: 0,
    maxDrawdown: 1,
    sharpeRatio: null,
    sortinoRatio: null,
    medianAnnualizedReturn: -1,
    medianSharpeRatio: null,
    medianSortinoRatio: null,
    historyDiagnostics: [],
  }
}

function runWindow(years: WindowYears): WindowResult {
  const loaded: Record<string, ReturnType<typeof loadLongHistory>> = {}
  for (const ticker of CORE_UNIVERSE) {
    const rows = loadLongHistory(ticker, years)
    if (rows.length >= 280) loaded[ticker] = rows
  }
  const aligned = alignOhlcvSeries(loaded, { minTradingDays: 280 })
  if (!aligned) {
    return failedWindow(years, 'calendar alignment failed (insufficient common trading days across tickers)')
  }

  const results = Object.entries(aligned).map(([ticker, rows]) =>
    backtestInstrument(ticker, 'matrix', rows, DEFAULT_CONFIG),
  )

  const portfolio = aggregatePortfolio(results, DEFAULT_CONFIG.initialCapital)
  const med = medianRisk(results)
  const alignedTradingDays = results[0]?.equityCurve.length ?? 0
  const historyDiagnostics = Object.entries(loaded).map(([ticker, rows]) => ({
    ticker,
    requestedYears: years,
    loadedRows: rows.length,
    alignedRows: aligned[ticker]?.length ?? 0,
  }))
  const coverageRatio = CORE_UNIVERSE.length > 0 ? results.length / CORE_UNIVERSE.length : 0
  return {
    years,
    instruments: results.length,
    alignedTradingDays,
    coverageRatio,
    totalReturn: portfolio.totalReturn,
    annualizedReturn: portfolio.annualizedReturn,
    winRate: portfolio.winRate,
    maxDrawdown: portfolio.maxDrawdown,
    sharpeRatio: portfolio.sharpeRatio,
    sortinoRatio: portfolio.sortinoRatio,
    medianAnnualizedReturn: med.medianAnnualizedReturn,
    medianSharpeRatio: med.medianSharpeRatio,
    medianSortinoRatio: med.medianSortinoRatio,
    historyDiagnostics,
  }
}

function main() {
  const matrix = WINDOWS.map(runWindow)
  const outDir = join(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString(),
    universe: CORE_UNIVERSE,
    windows: matrix,
  }
  const outPath = join(outDir, 'backtest-matrix.json')
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`[backtest:matrix] wrote ${outPath}`)
}

main()
