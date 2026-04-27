/**
 * Alpha vs SPY — compares strategy returns against SPY buy-and-hold on the
 * same fixture window. Commercial acceptance threshold: alpha > 0, IR > 0.4.
 */
import { backtestInstrument, aggregatePortfolio } from '@/lib/backtest/engine'
import type { OhlcvRow } from '@/lib/backtest/engine'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type Fixture = { ticker: string; sector: string; rows: OhlcvRow[] }

const FIX: Fixture[] = readdirSync('data/fixtures').map(f => {
  const d = JSON.parse(readFileSync(join('data/fixtures', f), 'utf8'))
  return { ticker: d.ticker, sector: d.sector, rows: d.rows }
})
const spy = FIX.find(f => f.ticker === 'SPY')
if (!spy) throw new Error('SPY fixture not found in data/fixtures')

// Compute strategy portfolio on OOS window
const oosResults = FIX.map(f => {
  const isN = Math.floor(f.rows.length * 0.6)
  return backtestInstrument(f.ticker, f.sector, f.rows.slice(isN), {})
})
const strat = aggregatePortfolio(oosResults, 100_000)

// SPY buy-and-hold over OOS window
const isN = Math.floor(spy.rows.length * 0.6)
const spyOos = spy.rows.slice(isN)
const spyStart = spyOos[0]?.close ?? 0
const spyEnd = spyOos[spyOos.length - 1]?.close ?? 0
const spyReturn = (spyEnd - spyStart) / spyStart
const years = spyOos.length / 252
const spyAnnualized = Math.pow(1 + spyReturn, 1 / years) - 1

// Daily SPY returns for IR calc
const spyDaily: number[] = []
for (let i = 1; i < spyOos.length; i++) {
  const r = (spyOos[i].close - spyOos[i - 1].close) / spyOos[i - 1].close
  if (Number.isFinite(r)) spyDaily.push(r)
}
const spyVolAnn = Math.sqrt(spyDaily.reduce((s, r) => s + r * r, 0) / spyDaily.length) * Math.sqrt(252)
const spyMeanD = spyDaily.reduce((s, r) => s + r, 0) / spyDaily.length
const spySharpe = spyVolAnn > 0 ? (spyMeanD * 252 - 0.04) / spyVolAnn : null

// Information ratio: (strategy annualized − SPY annualized) / tracking error
// PortfolioSummary doesn't expose dailyReturns; compute portfolio daily returns
// by averaging per-instrument daily returns at each time index.
const maxLen = Math.max(...oosResults.map(r => r.dailyReturns.length), 0)
const stratReturns: number[] = []
for (let i = 0; i < maxLen; i++) {
  let sum = 0
  let n = 0
  for (const r of oosResults) {
    const v = r.dailyReturns[i]
    if (Number.isFinite(v)) { sum += v; n++ }
  }
  stratReturns.push(n > 0 ? sum / n : 0)
}
const trackErr: number[] = []
for (let i = 0; i < Math.min(stratReturns.length, spyDaily.length); i++) {
  trackErr.push(stratReturns[i] - spyDaily[i])
}
const teMean = trackErr.reduce((s, r) => s + r, 0) / trackErr.length
const teStd = Math.sqrt(trackErr.reduce((s, r) => s + (r - teMean) ** 2, 0) / trackErr.length) * Math.sqrt(252)
const alpha = (strat.annualizedReturn ?? 0) - spyAnnualized
const ir = teStd > 0 ? alpha / teStd : null

const report = {
  runAt: new Date().toISOString(),
  window: { years: years.toFixed(2), bars: spyOos.length },
  strategy: {
    totalReturn: strat.totalReturn,
    annualizedReturn: strat.annualizedReturn,
    sharpe: strat.sharpeRatio,
    maxDrawdown: strat.maxDrawdown,
    trades: oosResults.reduce((s, r) => s + r.closedTrades.length, 0),
  },
  spy: {
    totalReturn: spyReturn,
    annualizedReturn: spyAnnualized,
    sharpe: spySharpe,
  },
  alpha: {
    annualized: alpha,
    informationRatio: ir,
    trackingErrorAnn: teStd,
  },
  commercialGate: {
    alphaPositive: alpha > 0,
    irAbove04: ir !== null && ir > 0.4,
    combined: alpha > 0 && ir !== null && ir > 0.4,
  },
}

console.log('\n── Alpha vs SPY (OOS window) ──')
console.log(`  Window: ${years.toFixed(2)} years (${spyOos.length} bars)`)
console.log(`  Strategy: ann=${(strat.annualizedReturn * 100).toFixed(2)}% sharpe=${(strat.sharpeRatio ?? 0).toFixed(2)} maxDD=${(strat.maxDrawdown * 100).toFixed(1)}%`)
console.log(`  SPY B&H:  ann=${(spyAnnualized * 100).toFixed(2)}% sharpe=${(spySharpe ?? 0).toFixed(2)}`)
console.log(`  Alpha:    ${(alpha * 100).toFixed(2)}%/yr`)
console.log(`  IR:       ${ir?.toFixed(3) ?? 'n/a'}`)
console.log(`\n  Commercial gate: alpha>0 [${alpha > 0 ? '✓' : '✗'}]  IR>0.4 [${ir !== null && ir > 0.4 ? '✓' : '✗'}]\n`)

mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/alpha-vs-spy.json', JSON.stringify(report, null, 2))
console.log(`  Artifact: artifacts/alpha-vs-spy.json`)
