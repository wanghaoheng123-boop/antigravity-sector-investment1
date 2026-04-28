/**
 * scripts/optimize-grid.ts — Phase 11 C1, Loop 1.
 *
 * Walk-forward grid search across all instruments. For each ticker, sweep the
 * LOOP1_GRID (768 combos) and pick the parameter set that maximizes OOS
 * Sharpe with overfitting guard (IS-OOS gap < 15pp, ≥ 5 OOS trades).
 *
 * Usage: npm run optimize:grid
 * Output:
 *   scripts/optimization-grid-results.json
 *   docs/archive/PHASE_11_GRID_RESULTS.md
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { gridSearch, aggregateGridResults, type GridSearchSummary } from '../lib/optimize/gridSearch'
import { LOOP1_GRID, OPTIMIZATION_TARGETS } from '../lib/optimize/parameterSets'
import { getProfileForTicker } from '../lib/optimize/sectorProfiles'
import type { OhlcvRow } from './backtest/dataLoader'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, 'backtestData')
const archiveDir = join(__dirname, '..', 'docs', 'archive')

// Mirrors scripts/benchmark-enhanced.ts SECTORS_MAP — kept locally to avoid
// importing the whole benchmark module into a runner script.
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

function loadAllTickers(): Array<{ ticker: string; sector: string; rows: OhlcvRow[] }> {
  if (!existsSync(dataDir)) {
    console.error('No backtestData directory. Run scripts/fetchBacktestData.mjs first.')
    process.exit(1)
  }
  return readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = readFileSync(join(dataDir, f), 'utf-8')
      const data = JSON.parse(raw) as CandleFile
      const ticker = f.replace('.json', '').replace(/-/g, '.')
      const sector = SECTORS_MAP[ticker] ?? data.sector ?? 'Unknown'
      const rows: OhlcvRow[] = (data.candles ?? []).filter(
        (c) => Number.isFinite(c.time) && Number.isFinite(c.open) &&
               Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close),
      )
      return { ticker, sector, rows, raw: data }
    })
    // Phase 11 D: drop macro proxies that the fetcher saved alongside stocks.
    .filter((d) => d.rows.length >= 252 && (d.raw.sector ?? '') !== 'Macro')
    .map(({ raw: _ignored, ...rest }) => rest)
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '   N/A'
  return `${(n * 100).toFixed(1)}%`.padStart(6)
}

function fmtSharpe(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ' N/A'
  return n.toFixed(2).padStart(5)
}

console.log('\n══════════════════════════════════════════════════')
console.log('  QUANTAN OPTIMIZE GRID — Phase 11 Loop 1')
console.log(`  Grid size: ${LOOP1_GRID.slopeThreshold.length} × ${LOOP1_GRID.buyWScoreThreshold.length} × ${LOOP1_GRID.sellWScoreThreshold.length} × ${LOOP1_GRID.confidenceThreshold.length} × ${LOOP1_GRID.atrStopMultiplier.length} = 768 combos / ticker`)
console.log('══════════════════════════════════════════════════\n')

const all = loadAllTickers()
console.log(`Loaded ${all.length} instruments`)

const summaries: GridSearchSummary[] = []
const t0 = Date.now()

for (const { ticker, sector, rows } of all) {
  process.stdout.write(`  [${sector.padEnd(18)}] ${ticker.padEnd(8)} `)
  const summary = gridSearch(rows, LOOP1_GRID, ticker, sector)
  summaries.push(summary)
  if (summary.validCombinations === 0) {
    console.log('NO VALID COMBOS (insufficient OOS trades)')
    continue
  }
  const b = summary.best
  console.log(
    `valid=${String(summary.validCombinations).padStart(3)} | ` +
    `IS:${fmtPct(b.isWinRate)} OOS:${fmtPct(b.oosWinRate)} gap:${fmtPct(b.overfitGap)} ` +
    `Sharpe:${fmtSharpe(b.oosSharpe)} | ` +
    `slope=${b.params.slopeThreshold} buy=${b.params.buyWScoreThreshold} ` +
    `sell=${b.params.sellWScoreThreshold} atr=${b.params.atrStopMultiplier}`,
  )
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

// ── Aggregate ────────────────────────────────────────────────────────────────
const aggregate = aggregateGridResults(summaries)

console.log('\n══════════════════════════════════════════════════')
console.log('  AGGREGATE RESULTS')
console.log('══════════════════════════════════════════════════')
console.log(`  Avg OOS Win Rate (best params): ${(aggregate.avgOOSWinRate * 100).toFixed(2)}%`)
console.log(`  Most-frequent best params:`)
for (const [k, v] of Object.entries(aggregate.bestGlobalParams)) {
  console.log(`    ${k.padEnd(22)} = ${v}`)
}
console.log(`  Elapsed: ${elapsed}s`)

const targetMet =
  aggregate.avgOOSWinRate >= OPTIMIZATION_TARGETS.loop1.minAggregateWinRate
console.log(`  Target met (≥ ${OPTIMIZATION_TARGETS.loop1.minAggregateWinRate * 100}%): ${targetMet ? 'YES ✓' : 'NO ✗'}`)

// ── Save JSON ────────────────────────────────────────────────────────────────
const jsonPath = join(__dirname, 'optimization-grid-results.json')
const output = {
  timestamp: new Date().toISOString(),
  loop: 1,
  grid: LOOP1_GRID,
  totalCombosPerTicker: 768,
  elapsedSeconds: Number(elapsed),
  aggregate,
  perTicker: summaries.map((s) => ({
    ticker: s.ticker,
    sector: s.sector,
    profileNotes: getProfileForTicker(s.ticker).optimizationNotes,
    validCombinations: s.validCombinations,
    splitDate: s.splitDate,
    best: s.best,
    top5: s.top5,
    robustParams: s.robustParams,
  })),
}
writeFileSync(jsonPath, JSON.stringify(output, null, 2))
console.log(`\n✓ JSON saved → scripts/optimization-grid-results.json`)

// ── Render markdown ──────────────────────────────────────────────────────────
if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })
const mdPath = join(archiveDir, 'PHASE_11_GRID_RESULTS.md')

const lines: string[] = []
lines.push('# Phase 11 — Grid Search Results (Loop 1)')
lines.push('')
lines.push(`Run timestamp: \`${new Date().toISOString()}\``)
lines.push(`Total combinations per ticker: **768**  ·  Elapsed: **${elapsed}s**  ·  Instruments: **${summaries.length}**`)
lines.push('')
lines.push(`Aggregate avg OOS win rate (per-ticker best params): **${(aggregate.avgOOSWinRate * 100).toFixed(2)}%**`)
lines.push(`Loop 1 target (≥ ${OPTIMIZATION_TARGETS.loop1.minAggregateWinRate * 100}%): **${targetMet ? 'MET' : 'NOT MET'}**`)
lines.push('')
lines.push('## Most-frequent best params across instruments')
lines.push('')
lines.push('| Parameter | Value |')
lines.push('| --- | --- |')
for (const [k, v] of Object.entries(aggregate.bestGlobalParams)) {
  lines.push(`| \`${k}\` | ${v} |`)
}
lines.push('')

// Group per-ticker results by sector for readability
const bySector: Record<string, GridSearchSummary[]> = {}
for (const s of summaries) {
  if (!bySector[s.sector]) bySector[s.sector] = []
  bySector[s.sector].push(s)
}

lines.push('## Per-sector breakdown')
lines.push('')
for (const [sector, list] of Object.entries(bySector)) {
  lines.push(`### ${sector}`)
  lines.push('')
  lines.push('| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const s of list) {
    if (s.validCombinations === 0) {
      lines.push(`| ${s.ticker} | 0 | — | — | — | — | _no valid combos_ |`)
      continue
    }
    const b = s.best
    const params = `slope=${b.params.slopeThreshold}, buy=${b.params.buyWScoreThreshold}, sell=${b.params.sellWScoreThreshold}, conf=${b.params.confidenceThreshold}, atr=${b.params.atrStopMultiplier}`
    lines.push(
      `| ${s.ticker} | ${s.validCombinations} | ` +
      `${(b.isWinRate * 100).toFixed(1)}% | ${(b.oosWinRate * 100).toFixed(1)}% | ` +
      `${(b.overfitGap * 100).toFixed(1)}pp | ` +
      `${b.oosSharpe != null ? b.oosSharpe.toFixed(2) : '—'} | ` +
      `\`${params}\` |`,
    )
  }
  lines.push('')
}

lines.push('## How to interpret')
lines.push('')
lines.push('- **Valid** = number of grid combinations that produced ≥ 5 OOS trades AND IS-OOS gap < 15pp.')
lines.push('- **OOS WR** = win rate on the held-out 30% of bars (not seen during parameter selection).')
lines.push('- **Gap** = IS WR − OOS WR. Gaps > 8pp suggest overfitting risk.')
lines.push('- **OOS Sharpe** is the primary objective; ties broken by OOS WR.')
lines.push('- Tickers with `_no valid combos_` need broader parameter ranges or richer signals (Phase D gates).')
lines.push('')
lines.push('## Next steps')
lines.push('')
lines.push('1. Compare per-sector best params with the static profile in `lib/optimize/sectorProfiles.ts` and update where the data disagrees.')
lines.push('2. Promote Loop 2 (`scripts/benchmark-enhanced.ts`) which already wires `getProfileForTicker`.')
lines.push('3. Run Loop 3 (`scripts/portfolio-backtest.ts`) with these tuned per-ticker params.')

writeFileSync(mdPath, lines.join('\n') + '\n')
console.log(`✓ Markdown saved → docs/archive/PHASE_11_GRID_RESULTS.md`)
