/**
 * Phase 2 Optimizer — grid search over Phase 2 signal gates.
 *
 * Sweeps: adxThreshold × stochRsiOversold × rvolThreshold × enableHealthyBullDip
 * Splits synthetic data IS/OOS (60/40), ranks configs by OOS Sharpe with
 * overfitting penalty. Emits artifacts/signal-param-optimization-phase2.json.
 */

import { backtestInstrument, aggregatePortfolio } from '@/lib/backtest/engine'
import type { BacktestConfig } from '@/lib/backtest/signals'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Synthetic fixture: realistic mean-reverting w/ trend ─────────────────────

type Bar = { time: number; date: string; open: number; high: number; low: number; close: number; volume: number }

function makeFixture(seed: number, n: number, trendBps: number, volPct: number): Bar[] {
  let rng = seed
  const next = () => { rng = (rng * 1103515245 + 12345) % 2147483647; return rng / 2147483647 }
  const bars: Bar[] = []
  let px = 100
  const start = new Date('2020-01-01').getTime()
  for (let i = 0; i < n; i++) {
    const mr = (100 - px) * 0.002
    const shock = (next() - 0.5) * volPct * 2
    const ret = trendBps / 10000 + mr + shock / 100
    const newPx = Math.max(1, px * (1 + ret))
    const hi = Math.max(px, newPx) * (1 + Math.abs(next()) * 0.01)
    const lo = Math.min(px, newPx) * (1 - Math.abs(next()) * 0.01)
    const ts = start + i * 86400000
    bars.push({
      time: Math.floor(ts / 1000),
      date: new Date(ts).toISOString().slice(0, 10),
      open: px, high: hi, low: lo, close: newPx,
      volume: 1_000_000 + Math.floor(next() * 500_000),
    })
    px = newPx
  }
  return bars
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

const GRID = {
  adxThreshold:        [0, 15, 20, 25],
  stochRsiOversold:    [0.20, 0.30, 0.40],
  rvolThreshold:       [0, 0.8, 1.2],
  enableHealthyBullDip: [true, false],
} as const

const TICKERS = [
  { ticker: 'SYN_BULL',    sector: 'Tech',       seed: 101, trend: 8,  vol: 1.2 },
  { ticker: 'SYN_CHOP',    sector: 'Financials', seed: 202, trend: 2,  vol: 1.8 },
  { ticker: 'SYN_VOLBULL', sector: 'Energy',     seed: 303, trend: 6,  vol: 2.5 },
  { ticker: 'SYN_WEAK',    sector: 'Utilities',  seed: 404, trend: -1, vol: 1.0 },
]

// ─── Harness ──────────────────────────────────────────────────────────────────

type RunOutcome = {
  isSharpe: number; oosSharpe: number
  isRet: number; oosRet: number
  isTrades: number; oosTrades: number
  isWin: number; oosWin: number
  maxDD: number
}

function runConfig(cfg: Partial<BacktestConfig>): RunOutcome {
  const N = 800
  const isN = Math.floor(N * 0.6)

  const isResults = TICKERS.map(t => {
    const bars = makeFixture(t.seed, N, t.trend, t.vol).slice(0, isN)
    return backtestInstrument(t.ticker, t.sector, bars, cfg)
  })
  const oosResults = TICKERS.map(t => {
    const bars = makeFixture(t.seed, N, t.trend, t.vol).slice(isN)
    return backtestInstrument(t.ticker, t.sector, bars, cfg)
  })

  const isPort = aggregatePortfolio(isResults, 100_000)
  const oosPort = aggregatePortfolio(oosResults, 100_000)

  const isTrades = isResults.reduce((s, r) => s + r.closedTrades.length, 0)
  const oosTrades = oosResults.reduce((s, r) => s + r.closedTrades.length, 0)

  const winRate = (rs: typeof isResults) => {
    let wins = 0, total = 0
    for (const r of rs) for (const t of r.closedTrades) {
      total++; if ((t.pnlPct ?? 0) > 0) wins++
    }
    return total > 0 ? wins / total : 0
  }

  return {
    isSharpe:  isPort.sharpeRatio ?? -99,
    oosSharpe: oosPort.sharpeRatio ?? -99,
    isRet:     isPort.totalReturn,
    oosRet:    oosPort.totalReturn,
    isTrades, oosTrades,
    isWin:  winRate(isResults),
    oosWin: winRate(oosResults),
    maxDD:  Math.max(isPort.maxDrawdown, oosPort.maxDrawdown),
  }
}

// ─── Enumerate ────────────────────────────────────────────────────────────────

type ConfigRun = { params: Partial<BacktestConfig>; out: RunOutcome; score: number; overfitting: number }

const configs: Partial<BacktestConfig>[] = []
for (const adx of GRID.adxThreshold)
  for (const stoch of GRID.stochRsiOversold)
    for (const rvol of GRID.rvolThreshold)
      for (const hbdip of GRID.enableHealthyBullDip)
        configs.push({ adxThreshold: adx, stochRsiOversold: stoch, rvolThreshold: rvol, enableHealthyBullDip: hbdip })

console.log(`[phase2-optimizer] ${configs.length} configs × ${TICKERS.length} tickers × 2 (IS/OOS)…`)

const results: ConfigRun[] = []
const t0 = Date.now()
for (let i = 0; i < configs.length; i++) {
  const params = configs[i]
  const out = runConfig(params)
  // Score: OOS Sharpe, penalized by overfitting (IS-OOS gap)
  const overfitting = Math.max(0, out.isSharpe - out.oosSharpe)
  const score = out.oosSharpe - 0.3 * overfitting
  results.push({ params, out, score, overfitting })
  if (i % 12 === 0) process.stdout.write(`  [${i}/${configs.length}] ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
}

results.sort((a, b) => b.score - a.score)

// ─── Baseline (current defaults) ─────────────────────────────────────────────

const baseline = runConfig({})
console.log('\n── Baseline (current defaults) ──')
console.log(`  OOS Sharpe: ${baseline.oosSharpe.toFixed(3)}, OOS ret: ${(baseline.oosRet * 100).toFixed(2)}%, trades: ${baseline.oosTrades}, winRate: ${(baseline.oosWin * 100).toFixed(1)}%`)

console.log('\n── Top 10 configs (by OOS Sharpe − 0.3 × overfitting) ──')
for (let i = 0; i < Math.min(10, results.length); i++) {
  const r = results[i]
  const p = r.params
  console.log(`  #${i + 1}  adx=${p.adxThreshold} stoch=${p.stochRsiOversold} rvol=${p.rvolThreshold} HBD=${p.enableHealthyBullDip ? 'Y' : 'N'}` +
    ` | score=${r.score.toFixed(3)} oosSharpe=${r.out.oosSharpe.toFixed(3)} oosRet=${(r.out.oosRet * 100).toFixed(2)}% trades=${r.out.oosTrades} win=${(r.out.oosWin * 100).toFixed(1)}% overfit=${r.overfitting.toFixed(2)}`)
}

// ─── Artifact ─────────────────────────────────────────────────────────────────

const artifact = {
  runAt: new Date().toISOString(),
  grid: GRID,
  fixtures: TICKERS.map(t => ({ ticker: t.ticker, sector: t.sector, trendBps: t.trend, volPct: t.vol })),
  splitRatio: { inSample: 0.6, outOfSample: 0.4 },
  scoring: 'score = OOS_Sharpe − 0.3 × max(0, IS_Sharpe − OOS_Sharpe)',
  baseline: { params: 'DEFAULT_CONFIG', out: baseline },
  totalCandidates: results.length,
  top10: results.slice(0, 10),
  bottom5: results.slice(-5),
}

mkdirSync('artifacts', { recursive: true })
const outPath = join('artifacts', 'signal-param-optimization-phase2.json')
writeFileSync(outPath, JSON.stringify(artifact, null, 2))
console.log(`\n[phase2-optimizer] wrote ${outPath}`)
