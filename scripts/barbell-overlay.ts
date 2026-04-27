/**
 * Barbell Overlay — models the "SPY base + swing overlay" structure
 * institutional long/short desks use. Capital is 100% SPY always; swing
 * positions are funded via margin (short-term financing at rf + spread).
 *
 * This tests whether the strategy is ADDITIVE on top of SPY beta, even if
 * it's not a standalone replacement. Key metric: does overlayed portfolio
 * beat pure SPY on a Sharpe basis?
 *
 * Assumptions: margin cost = rf + 1.5% = 5.5% annualized on swing exposure.
 */
import { backtestInstrument } from '@/lib/backtest/engine'
import type { OhlcvRow } from '@/lib/backtest/engine'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type Fixture = { ticker: string; sector: string; rows: OhlcvRow[] }

const FIX: Fixture[] = readdirSync('data/fixtures').map(f => {
  const d = JSON.parse(readFileSync(join('data/fixtures', f), 'utf8'))
  return { ticker: d.ticker, sector: d.sector, rows: d.rows }
})
const spy = FIX.find(f => f.ticker === 'SPY')
if (!spy) throw new Error('SPY fixture not found')

const isN = Math.floor(spy.rows.length * 0.6)
const spyOos = spy.rows.slice(isN)
const spyStart = spyOos[0].close
const spyCurve = spyOos.map(r => (r.close / spyStart) * 100_000)

const oosResults = FIX.map(f => {
  const n = Math.floor(f.rows.length * 0.6)
  return backtestInstrument(f.ticker, f.sector, f.rows.slice(n), {})
})

// Build combined strategy equity (dollar sum, scaled to $100k)
const maxLen = Math.max(...oosResults.map(r => r.equityCurve.length))
const stratRaw = new Array(maxLen).fill(0)
for (const r of oosResults) {
  const last = r.equityCurve[r.equityCurve.length - 1]
  for (let i = 0; i < maxLen; i++) stratRaw[i] += i < r.equityCurve.length ? r.equityCurve[i] : last
}
const stratStart = stratRaw[0]
const stratCurve = stratRaw.map(v => (v / stratStart) * 100_000)

const N = Math.min(stratCurve.length, spyCurve.length)
function daily(c: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < Math.min(c.length, N); i++) {
    const r = (c[i] - c[i - 1]) / c[i - 1]
    if (Number.isFinite(r)) out.push(r)
  }
  return out
}
const spyD = daily(spyCurve)
const stratD = daily(stratCurve)

// Margin cost per day (rf + 1.5% spread)
const marginCostD = 0.055 / 252

// Overlay: daily return = SPY return + overlay_weight * (strat return - margin cost)
const overlayWeights = [0.0, 0.25, 0.5, 1.0, 1.5]

function stats(daily: number[]) {
  const n = daily.length
  const mean = daily.reduce((a, b) => a + b, 0) / n
  const variance = daily.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, n - 1)
  const sd = Math.sqrt(variance)
  const annRet = Math.pow(1 + mean, 252) - 1
  const annVol = sd * Math.sqrt(252)
  const sharpe = annVol > 0 ? (annRet - 0.04) / annVol : null
  let peak = 1, eq = 1, maxDD = 0
  for (const r of daily) { eq *= 1 + r; if (eq > peak) peak = eq; const dd = (peak - eq) / peak; if (dd > maxDD) maxDD = dd }
  return { annRet, annVol, sharpe, maxDD }
}

console.log('\n── Barbell Overlay: 100% SPY + W × Swing ──')
console.log(`  Window: ${(N / 252).toFixed(2)} years, margin cost 5.5%/yr\n`)
console.log('  Overlay W   AnnRet  AnnVol  Sharpe  MaxDD   Alpha vs SPY')
const spyStats = stats(spyD)
const rows: { w: number; annRet: number; annVol: number; sharpe: number | null; maxDD: number; alpha: number }[] = []
for (const w of overlayWeights) {
  const combined = spyD.map((r, i) => r + w * ((stratD[i] ?? 0) - marginCostD))
  const s = stats(combined)
  const alpha = s.annRet - spyStats.annRet
  rows.push({ w, ...s, alpha })
  console.log(`  ${w.toFixed(2).padStart(9)}  ${(s.annRet * 100).toFixed(2)}%  ${(s.annVol * 100).toFixed(2)}%  ${(s.sharpe ?? 0).toFixed(2)}    ${(s.maxDD * 100).toFixed(1)}%   ${(alpha * 100).toFixed(2)}%`)
}
const best = rows.reduce((a, b) => ((b.sharpe ?? -Infinity) > (a.sharpe ?? -Infinity) ? b : a))
console.log(`\n  Best W = ${best.w.toFixed(2)} (Sharpe=${(best.sharpe ?? 0).toFixed(2)}, alpha=${(best.alpha * 100).toFixed(2)}%)`)
const pass = best.sharpe !== null && spyStats.sharpe !== null && best.sharpe > spyStats.sharpe && best.alpha > 0
console.log(`  Gate (Sharpe > SPY AND alpha > 0): ${pass ? '✓ PASS' : '✗ FAIL'}\n`)

mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/barbell-overlay.json', JSON.stringify({
  runAt: new Date().toISOString(),
  window: { years: Number((N / 252).toFixed(2)), bars: N },
  marginCost: 0.055,
  spy: spyStats,
  overlays: rows,
  bestWeight: best.w,
  commercialGate: pass,
}, null, 2))
console.log('  Artifact: artifacts/barbell-overlay.json\n')
