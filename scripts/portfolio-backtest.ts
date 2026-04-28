/**
 * scripts/portfolio-backtest.ts — Phase 11 C3, Loop 3.
 *
 * Runs a multi-instrument portfolio simulation across all loaded tickers.
 * Up to maxPositions concurrent holdings, ATR-adaptive stops, profit-taking
 * exits, sector attribution, exit-reason histogram, and 95/99 VaR.
 *
 * Output:
 *   scripts/portfolio-backtest-results.json
 *   docs/archive/PHASE_11_PORTFOLIO_REPORT.md
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { runPortfolioBacktest } from '../lib/backtest/portfolioBacktest'
import type { OhlcvRow } from './backtest/dataLoader'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, 'backtestData')
const archiveDir = join(__dirname, '..', 'docs', 'archive')

const SECTORS_MAP: Record<string, string> = {
  NVDA: 'Technology', MSFT: 'Technology', AAPL: 'Technology', AVGO: 'Technology', AMD: 'Technology',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', EOG: 'Energy', SLB: 'Energy',
  'BRK.B': 'Financials', JPM: 'Financials', V: 'Financials', MA: 'Financials', BAC: 'Financials',
  LLY: 'Healthcare', UNH: 'Healthcare', JNJ: 'Healthcare', ABBV: 'Healthcare', MRK: 'Healthcare',
  AMZN: 'Consumer Disc.', TSLA: 'Consumer Disc.', HD: 'Consumer Disc.', MCD: 'Consumer Disc.', NKE: 'Consumer Disc.',
  GE: 'Industrials', RTX: 'Industrials', CAT: 'Industrials', UNP: 'Industrials', HON: 'Industrials',
  META: 'Communication', GOOGL: 'Communication', NFLX: 'Communication', DIS: 'Communication', T: 'Communication',
  LIN: 'Materials', APD: 'Materials', FCX: 'Materials', NEM: 'Materials', DOW: 'Materials',
  NEE: 'Utilities', SO: 'Utilities', DUK: 'Utilities', AEP: 'Utilities', PCG: 'Utilities',
  PLD: 'Real Estate', AMT: 'Real Estate', EQIX: 'Real Estate', WELL: 'Real Estate', SPG: 'Real Estate',
  PG: 'Consumer Staples', COST: 'Consumer Staples', WMT: 'Consumer Staples', PEP: 'Consumer Staples', KO: 'Consumer Staples',
  BTC: 'Crypto',
}

interface CandleFile { ticker: string; sector?: string; candles: OhlcvRow[] }

function loadAllTickers(): { instrumentData: Record<string, OhlcvRow[]>; sectorMap: Record<string, string> } {
  if (!existsSync(dataDir)) {
    console.error('No backtestData directory. Run scripts/fetchBacktestData.mjs first.')
    process.exit(1)
  }
  const instrumentData: Record<string, OhlcvRow[]> = {}
  const sectorMap: Record<string, string> = {}
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))
  for (const f of files) {
    const raw = readFileSync(join(dataDir, f), 'utf-8')
    const data = JSON.parse(raw) as CandleFile
    const ticker = f.replace('.json', '').replace(/-/g, '.')
    const rows: OhlcvRow[] = (data.candles ?? []).filter(
      (c) => Number.isFinite(c.time) && Number.isFinite(c.open) &&
             Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close),
    )
    if (rows.length < 252) continue
    instrumentData[ticker] = rows
    sectorMap[ticker] = SECTORS_MAP[ticker] ?? data.sector ?? 'Unknown'
  }
  return { instrumentData, sectorMap }
}

const fmt = (n: number, dp = 2) => (Number.isFinite(n) ? n.toFixed(dp) : 'N/A')
const fmtPct = (n: number, dp = 2) => (Number.isFinite(n) ? `${(n * 100).toFixed(dp)}%` : 'N/A')

console.log('\n══════════════════════════════════════════════════')
console.log('  QUANTAN PORTFOLIO BACKTEST — Phase 11 Loop 3')
console.log('  Multi-instrument simulation, max 10 concurrent positions')
console.log('══════════════════════════════════════════════════\n')

const { instrumentData, sectorMap } = loadAllTickers()
const tickers = Object.keys(instrumentData)
console.log(`Loaded ${tickers.length} instruments`)

const t0 = Date.now()
const result = runPortfolioBacktest(instrumentData, sectorMap, {})
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

console.log('\n══════════════════════════════════════════════════')
console.log('  PORTFOLIO RESULTS')
console.log('══════════════════════════════════════════════════')
console.log(`  Initial capital:        $${result.initialCapital.toLocaleString()}`)
console.log(`  Final capital:          $${result.finalCapital.toLocaleString()}`)
console.log(`  Total return:           ${fmtPct(result.totalReturn)}`)
console.log(`  Annualized return:      ${fmtPct(result.annualizedReturn)}`)
console.log(`  Sharpe ratio:           ${result.sharpeRatio != null ? fmt(result.sharpeRatio) : 'N/A'}`)
console.log(`  Sortino ratio:          ${result.sortinoRatio != null ? fmt(result.sortinoRatio) : 'N/A'}`)
console.log(`  Max drawdown:           ${fmtPct(result.maxDrawdown)}`)
console.log(`  Win rate:               ${fmtPct(result.winRate)}`)
console.log(`  Profit factor:          ${fmt(result.profitFactor)}`)
console.log(`  Avg trade return:       ${fmtPct(result.avgTradeReturn)}`)
console.log(`  Total trades:           ${result.totalTrades}`)
console.log(`  Max concurrent posns:   ${result.maxConcurrentPositions}`)
console.log(`  Avg concurrent posns:   ${fmt(result.avgConcurrentPositions)}`)
console.log(`  VaR 95% (1d):           ${result.varMetrics.var95_1d != null ? fmtPct(result.varMetrics.var95_1d) : 'N/A'}`)
console.log(`  VaR 99% (1d):           ${result.varMetrics.var99_1d != null ? fmtPct(result.varMetrics.var99_1d) : 'N/A'}`)
console.log(`  Elapsed:                ${elapsed}s`)

console.log('\n  ── Sector attribution ──')
for (const [sector, attr] of Object.entries(result.sectorAttribution)) {
  console.log(`    ${sector.padEnd(20)} trades: ${String(attr.trades).padStart(3)}  WR: ${fmtPct(attr.winRate, 1).padStart(6)}  AvgRet: ${fmtPct(attr.avgReturn, 2).padStart(7)}`)
}

console.log('\n  ── Exit reason breakdown ──')
for (const [reason, count] of Object.entries(result.exitReasonBreakdown)) {
  if (count > 0) {
    console.log(`    ${reason.padEnd(20)} ${count}`)
  }
}

// ── Save JSON ────────────────────────────────────────────────────────────────
const jsonPath = join(__dirname, 'portfolio-backtest-results.json')
const output = {
  timestamp: new Date().toISOString(),
  loop: 3,
  config: {
    tickers,
    initialCapital: result.initialCapital,
    elapsedSeconds: Number(elapsed),
  },
  summary: {
    initialCapital: result.initialCapital,
    finalCapital: result.finalCapital,
    totalReturn: result.totalReturn,
    annualizedReturn: result.annualizedReturn,
    sharpeRatio: result.sharpeRatio,
    sortinoRatio: result.sortinoRatio,
    maxDrawdown: result.maxDrawdown,
    winRate: result.winRate,
    profitFactor: result.profitFactor,
    avgTradeReturn: result.avgTradeReturn,
    totalTrades: result.totalTrades,
    maxConcurrentPositions: result.maxConcurrentPositions,
    avgConcurrentPositions: result.avgConcurrentPositions,
    varMetrics: result.varMetrics,
  },
  sectorAttribution: result.sectorAttribution,
  exitReasonBreakdown: result.exitReasonBreakdown,
  trades: result.trades,
  // equity curve / dailyReturns omitted from JSON to keep file size sane;
  // sampled curve below for charting.
  equityCurveSampled: sampleEvery(result.equityCurve, 21),
}
writeFileSync(jsonPath, JSON.stringify(output, null, 2))
console.log(`\n✓ JSON saved → scripts/portfolio-backtest-results.json`)

function sampleEvery<T>(arr: T[], step: number): T[] {
  const out: T[] = []
  for (let i = 0; i < arr.length; i += step) out.push(arr[i])
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1])
  return out
}

// ── Render markdown ──────────────────────────────────────────────────────────
if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })
const mdPath = join(archiveDir, 'PHASE_11_PORTFOLIO_REPORT.md')

const lines: string[] = []
lines.push('# Phase 11 — Portfolio Backtest Report (Loop 3)')
lines.push('')
lines.push(`Run timestamp: \`${new Date().toISOString()}\``)
lines.push(`Instruments: **${tickers.length}**  ·  Elapsed: **${elapsed}s**`)
lines.push('')
lines.push('## Portfolio summary')
lines.push('')
lines.push('| Metric | Value |')
lines.push('| --- | --- |')
lines.push(`| Initial capital | $${result.initialCapital.toLocaleString()} |`)
lines.push(`| Final capital | $${result.finalCapital.toLocaleString()} |`)
lines.push(`| Total return | **${fmtPct(result.totalReturn)}** |`)
lines.push(`| Annualized return | ${fmtPct(result.annualizedReturn)} |`)
lines.push(`| Sharpe ratio | ${result.sharpeRatio != null ? fmt(result.sharpeRatio) : 'N/A'} |`)
lines.push(`| Sortino ratio | ${result.sortinoRatio != null ? fmt(result.sortinoRatio) : 'N/A'} |`)
lines.push(`| Max drawdown | ${fmtPct(result.maxDrawdown)} |`)
lines.push(`| Win rate | ${fmtPct(result.winRate)} |`)
lines.push(`| Profit factor | ${fmt(result.profitFactor)} |`)
lines.push(`| Total trades | ${result.totalTrades} |`)
lines.push(`| Max concurrent positions | ${result.maxConcurrentPositions} |`)
lines.push(`| Avg concurrent positions | ${fmt(result.avgConcurrentPositions)} |`)
lines.push(`| VaR 95% (1d) | ${result.varMetrics.var95_1d != null ? fmtPct(result.varMetrics.var95_1d) : 'N/A'} |`)
lines.push(`| VaR 99% (1d) | ${result.varMetrics.var99_1d != null ? fmtPct(result.varMetrics.var99_1d) : 'N/A'} |`)
lines.push('')

lines.push('## Sector attribution')
lines.push('')
lines.push('| Sector | Trades | Win rate | Avg return |')
lines.push('| --- | --- | --- | --- |')
const sortedSectors = Object.entries(result.sectorAttribution).sort((a, b) => b[1].trades - a[1].trades)
for (const [sector, attr] of sortedSectors) {
  lines.push(`| ${sector} | ${attr.trades} | ${fmtPct(attr.winRate, 1)} | ${fmtPct(attr.avgReturn, 2)} |`)
}
lines.push('')

lines.push('## Exit reason histogram')
lines.push('')
lines.push('| Reason | Count |')
lines.push('| --- | --- |')
for (const [reason, count] of Object.entries(result.exitReasonBreakdown)) {
  if (count > 0) lines.push(`| ${reason} | ${count} |`)
}
lines.push('')

lines.push('## Top 15 trades by P&L')
lines.push('')
const topTrades = [...result.trades].sort((a, b) => b.pnlDollar - a.pnlDollar).slice(0, 15)
lines.push('| Ticker | Sector | Entry | Exit | Shares | P&L $ | P&L % | Exit reason |')
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const t of topTrades) {
  lines.push(`| ${t.ticker} | ${t.sector} | ${t.entryDate} | ${t.exitDate} | ${t.shares} | $${t.pnlDollar.toFixed(0)} | ${fmtPct(t.pnlPct, 1)} | ${t.exitReason} |`)
}
lines.push('')

lines.push('## Notes')
lines.push('')
lines.push('- Default `maxPositions=10`, `maxSinglePositionPct=20%`, half-Kelly sizing, ATR-adaptive stops, profit-taking exits.')
lines.push('- Signal: `enhancedCombinedSignal` with `DEFAULT_CONFIG` (no per-sector profile in this run — see benchmark-enhanced for that).')
lines.push('- VaR uses the historical-simulation method on daily portfolio returns; Basel-conformant.')
lines.push('- Equity curve in JSON is sampled every 21 trading days to keep the file readable.')

writeFileSync(mdPath, lines.join('\n') + '\n')
console.log(`✓ Markdown saved → docs/archive/PHASE_11_PORTFOLIO_REPORT.md`)
