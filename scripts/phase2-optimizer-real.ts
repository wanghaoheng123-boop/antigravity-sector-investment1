/**
 * Phase 2 Optimizer — REAL-DATA grid search.
 * Uses cached daily OHLCV from data/fixtures/*.json (6y × 20 S&P names).
 * Walk-forward IS/OOS split 60/40. Ranks by OOS Sharpe − overfitting penalty.
 */
import { backtestInstrument, aggregatePortfolio } from '@/lib/backtest/engine'
import type { BacktestConfig } from '@/lib/backtest/signals'
import type { OhlcvRow } from '@/lib/backtest/engine'
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Load fixtures ─────────────────────────────────────────────────────────────

type Fixture = { ticker: string; sector: string; rows: OhlcvRow[] }
const FIXTURES: Fixture[] = readdirSync('data/fixtures').map(f => {
  const data = JSON.parse(readFileSync(join('data/fixtures', f), 'utf8'))
  return { ticker: data.ticker, sector: data.sector, rows: data.rows }
})
console.log(`[phase2-optimizer-real] ${FIXTURES.length} tickers loaded`)

// ─── Grid ─────────────────────────────────────────────────────────────────────

const GRID = {
  adxThreshold:        [0, 15, 20, 25],
  stochRsiOversold:    [0.20, 0.30, 0.40],
  rvolThreshold:       [0, 0.8, 1.2],
  enableHealthyBullDip: [true, false],
} as const

// ─── Harness ──────────────────────────────────────────────────────────────────

type RunOutcome = {
  isSharpe: number; oosSharpe: number
  isRet: number; oosRet: number
  isTrades: number; oosTrades: number
  isWin: number; oosWin: number
  maxDD: number
}

function runConfig(cfg: Partial<BacktestConfig>): RunOutcome {
  const isResults = FIXTURES.map(f => {
    const isN = Math.floor(f.rows.length * 0.6)
    return backtestInstrument(f.ticker, f.sector, f.rows.slice(0, isN), cfg)
  })
  const oosResults = FIXTURES.map(f => {
    const isN = Math.floor(f.rows.length * 0.6)
    return backtestInstrument(f.ticker, f.sector, f.rows.slice(isN), cfg)
  })

  const isPort  = aggregatePortfolio(isResults, 100_000)
  const oosPort = aggregatePortfolio(oosResults, 100_000)

  const countTrades = (rs: typeof isResults) => rs.reduce((s, r) => s + r.closedTrades.length, 0)
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
    isTrades:  countTrades(isResults),
    oosTrades: countTrades(oosResults),
    isWin:     winRate(isResults),
    oosWin:    winRate(oosResults),
    maxDD:     Math.max(isPort.maxDrawdown, oosPort.maxDrawdown),
  }
}

// ─── Baseline ──────────────────────────────────────────────────────────────────

console.log('\n── Baseline (DEFAULT_CONFIG) ──')
const baseline = runConfig({})
console.log(`  IS  Sharpe=${baseline.isSharpe.toFixed(3)} ret=${(baseline.isRet*100).toFixed(2)}% trades=${baseline.isTrades} win=${(baseline.isWin*100).toFixed(1)}%`)
console.log(`  OOS Sharpe=${baseline.oosSharpe.toFixed(3)} ret=${(baseline.oosRet*100).toFixed(2)}% trades=${baseline.oosTrades} win=${(baseline.oosWin*100).toFixed(1)}% maxDD=${(baseline.maxDD*100).toFixed(2)}%`)

// ─── Grid enumerate ────────────────────────────────────────────────────────────

type ConfigRun = { params: Partial<BacktestConfig>; out: RunOutcome; score: number; overfitting: number }
const configs: Partial<BacktestConfig>[] = []
for (const adx of GRID.adxThreshold)
  for (const stoch of GRID.stochRsiOversold)
    for (const rvol of GRID.rvolThreshold)
      for (const hbdip of GRID.enableHealthyBullDip)
        configs.push({ adxThreshold: adx, stochRsiOversold: stoch, rvolThreshold: rvol, enableHealthyBullDip: hbdip })

console.log(`\n[phase2-optimizer-real] sweeping ${configs.length} configs…`)
const t0 = Date.now()
const results: ConfigRun[] = []
for (let i = 0; i < configs.length; i++) {
  const params = configs[i]
  const out = runConfig(params)
  const overfitting = Math.max(0, out.isSharpe - out.oosSharpe)
  const score = out.oosSharpe - 0.3 * overfitting
  results.push({ params, out, score, overfitting })
  if (i % 12 === 0) process.stdout.write(`  [${i}/${configs.length}] ${((Date.now() - t0)/1000).toFixed(1)}s\n`)
}
results.sort((a, b) => b.score - a.score)

console.log('\n── Top 10 (OOS-ranked with overfitting penalty) ──')
for (let i = 0; i < Math.min(10, results.length); i++) {
  const r = results[i], p = r.params, o = r.out
  console.log(`  #${i+1} adx=${p.adxThreshold} stoch=${p.stochRsiOversold} rvol=${p.rvolThreshold} HBD=${p.enableHealthyBullDip?'Y':'N'}`
    + ` | score=${r.score.toFixed(3)} oosSharpe=${o.oosSharpe.toFixed(3)} oosRet=${(o.oosRet*100).toFixed(1)}% trades=${o.oosTrades} win=${(o.oosWin*100).toFixed(1)}% DD=${(o.maxDD*100).toFixed(1)}% overfit=${r.overfitting.toFixed(2)}`)
}

// ─── Artifact ──────────────────────────────────────────────────────────────────

const artifact = {
  runAt: new Date().toISOString(),
  dataSource: 'Yahoo Finance daily OHLCV (data/fixtures/*.json)',
  tickerCount: FIXTURES.length,
  barsPerTicker: FIXTURES[0]?.rows.length ?? 0,
  splitRatio: { inSample: 0.6, outOfSample: 0.4 },
  grid: GRID,
  scoring: 'score = OOS_Sharpe − 0.3 × max(0, IS_Sharpe − OOS_Sharpe)',
  baseline: { params: 'DEFAULT_CONFIG', out: baseline },
  totalCandidates: results.length,
  top10: results.slice(0, 10),
  bottom5: results.slice(-5),
}
mkdirSync('artifacts', { recursive: true })
const out = join('artifacts', 'signal-param-optimization-phase2-real.json')
writeFileSync(out, JSON.stringify(artifact, null, 2))
console.log(`\n[phase2-optimizer-real] wrote ${out}`)
