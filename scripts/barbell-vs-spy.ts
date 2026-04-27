/**
 * Barbell vs SPY — tests the hypothesis that blending the swing strategy
 * with a SPY beta base closes the -19%/yr alpha gap identified in the
 * previous session while keeping drawdown/vol acceptable.
 *
 * Blends tested: 0/100, 25/75, 50/50, 70/30, 100/0 (strategy / SPY).
 * For each blend we compute: ann return, vol, Sharpe, maxDD, alpha vs SPY.
 *
 * Commercial gate: a blend must show alpha > 0 AND Sharpe > SPY Sharpe.
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

// OOS slice
const isN = Math.floor(spy.rows.length * 0.6)
const spyOos = spy.rows.slice(isN)
const years = spyOos.length / 252

// Build SPY equity curve (buy-and-hold, $100k)
const spyStart = spyOos[0].close
const spyCurve: number[] = spyOos.map(r => (r.close / spyStart) * 100_000)

// Strategy portfolio curve
const oosResults = FIX.map(f => {
  const n = Math.floor(f.rows.length * 0.6)
  return backtestInstrument(f.ticker, f.sector, f.rows.slice(n), {})
})
const strat = aggregatePortfolio(oosResults, 100_000)

// Build strategy combined equity (equal-weight sum scaled to $100k start)
const maxLen = Math.max(...oosResults.map(r => r.equityCurve.length))
const stratCurveRaw = new Array(maxLen).fill(0)
for (const r of oosResults) {
  const last = r.equityCurve[r.equityCurve.length - 1]
  for (let i = 0; i < maxLen; i++) stratCurveRaw[i] += i < r.equityCurve.length ? r.equityCurve[i] : last
}
const stratStart = stratCurveRaw[0]
const stratCurve = stratCurveRaw.map(v => (v / stratStart) * 100_000)

// Align lengths
const N = Math.min(stratCurve.length, spyCurve.length)
const s = stratCurve.slice(0, N)
const p = spyCurve.slice(0, N)

// Daily returns
function dailyReturns(curve: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < curve.length; i++) {
    const r = (curve[i] - curve[i - 1]) / curve[i - 1]
    if (Number.isFinite(r)) out.push(r)
  }
  return out
}
const sDaily = dailyReturns(s)
const pDaily = dailyReturns(p)

function metrics(daily: number[], label: string) {
  const n = daily.length
  const mean = daily.reduce((a, b) => a + b, 0) / n
  const variance = daily.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, n - 1)
  const sd = Math.sqrt(variance)
  const annRet = Math.pow(1 + mean, 252) - 1
  const annVol = sd * Math.sqrt(252)
  const sharpe = annVol > 0 ? (annRet - 0.04) / annVol : null
  // Max drawdown from cumulative compounded path
  let peak = 1, equity = 1, maxDD = 0
  for (const r of daily) { equity *= 1 + r; if (equity > peak) peak = equity; const dd = (peak - equity) / peak; if (dd > maxDD) maxDD = dd }
  return { label, annRet, annVol, sharpe, maxDD, n }
}

const blends = [
  { w: 0.0, name: '  0% strat / 100% SPY' },
  { w: 0.25, name: ' 25% strat /  75% SPY' },
  { w: 0.5, name: ' 50% strat /  50% SPY' },
  { w: 0.7, name: ' 70% strat /  30% SPY' },
  { w: 1.0, name: '100% strat /   0% SPY' },
]

const rows = blends.map(b => {
  const blended = sDaily.map((r, i) => b.w * r + (1 - b.w) * (pDaily[i] ?? 0))
  const m = metrics(blended, b.name)
  const spyAnn = Math.pow(1 + pDaily.reduce((a, r) => a + r, 0) / pDaily.length, 252) - 1
  const alpha = m.annRet - spyAnn
  // tracking error vs SPY
  const te = blended.map((r, i) => r - pDaily[i])
  const teMean = te.reduce((a, b) => a + b, 0) / te.length
  const teStd = Math.sqrt(te.reduce((a, r) => a + (r - teMean) ** 2, 0) / te.length) * Math.sqrt(252)
  const ir = teStd > 0 ? alpha / teStd : null
  return { ...m, alpha, ir }
})

const spyMetrics = metrics(pDaily, 'SPY buy-and-hold')

console.log('\n── Barbell blends over OOS window ──')
console.log(`  Window: ${years.toFixed(2)} years (${N} bars)\n`)
console.log('  Blend                   AnnRet  AnnVol  Sharpe  MaxDD   Alpha   IR')
for (const r of rows) {
  const alphaPct = (r.alpha * 100).toFixed(2)
  const ann = (r.annRet * 100).toFixed(2)
  const vol = (r.annVol * 100).toFixed(2)
  const sh = (r.sharpe ?? 0).toFixed(2)
  const dd = (r.maxDD * 100).toFixed(1)
  const ir = r.ir?.toFixed(2) ?? 'n/a'
  console.log(`  ${r.label}  ${ann}%  ${vol}%  ${sh}    ${dd}%   ${alphaPct}% ${ir}`)
}
console.log(`\n  SPY Sharpe: ${(spyMetrics.sharpe ?? 0).toFixed(2)}`)

// Pick best by Sharpe
const best = rows.reduce((a, b) => ((b.sharpe ?? -Infinity) > (a.sharpe ?? -Infinity) ? b : a))
console.log(`\n  Best blend by Sharpe: ${best.label} (Sharpe=${(best.sharpe ?? 0).toFixed(2)}, alpha=${(best.alpha * 100).toFixed(2)}%)`)

const passGate = best.sharpe !== null && spyMetrics.sharpe !== null && best.sharpe > spyMetrics.sharpe && best.alpha > 0
console.log(`  Commercial gate (blend Sharpe > SPY Sharpe AND alpha > 0): ${passGate ? '✓ PASS' : '✗ FAIL'}\n`)

mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/barbell-vs-spy.json', JSON.stringify({
  runAt: new Date().toISOString(),
  window: { years: Number(years.toFixed(2)), bars: N },
  spy: spyMetrics,
  blends: rows,
  best: best.label,
  commercialGate: passGate,
}, null, 2))
console.log('  Artifact: artifacts/barbell-vs-spy.json\n')
