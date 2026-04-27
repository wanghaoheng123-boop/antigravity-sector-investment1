/**
 * Regime Switch — tests a regime-aware allocator that holds SPY when the
 * market is above its 200-SMA (HEALTHY_BULL) and switches to the swing
 * strategy when the market breaks below (defensive mode).
 *
 * This captures SPY beta in bull markets (where swing underperforms) while
 * reserving the strategy for downtrends where its mean-reversion edge applies.
 *
 * Commercial hypothesis: this allocator will have Sharpe > SPY on a window
 * that includes at least one drawdown period.
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
const spy = FIX.find(f => f.ticker === 'SPY')!

// Full history SMA200 for SPY
const closes = spy.rows.map(r => r.close)
const sma200: (number | null)[] = closes.map((_, i) => {
  if (i < 199) return null
  const slice = closes.slice(i - 199, i + 1)
  return slice.reduce((a, b) => a + b, 0) / 200
})

// OOS slice
const isN = Math.floor(spy.rows.length * 0.6)
const oosIdx = isN
const spyOos = spy.rows.slice(isN)
const regimeOos = sma200.slice(isN).map((s, i) => (s !== null && spyOos[i].close > s ? 'BULL' : 'DEFENSIVE'))

// SPY daily returns
const spyDaily = spyOos.slice(1).map((r, i) => (r.close - spyOos[i].close) / spyOos[i].close)

// Strategy combined daily returns
const oosResults = FIX.map(f => {
  const n = Math.floor(f.rows.length * 0.6)
  return backtestInstrument(f.ticker, f.sector, f.rows.slice(n), {})
})
const maxLen = Math.max(...oosResults.map(r => r.equityCurve.length))
const stratRaw = new Array(maxLen).fill(0)
for (const r of oosResults) {
  const last = r.equityCurve[r.equityCurve.length - 1]
  for (let i = 0; i < maxLen; i++) stratRaw[i] += i < r.equityCurve.length ? r.equityCurve[i] : last
}
const stratCurve = stratRaw.map(v => (v / stratRaw[0]) * 100_000)
const stratDaily = stratCurve.slice(1).map((v, i) => (v - stratCurve[i]) / stratCurve[i])

const N = Math.min(spyDaily.length, stratDaily.length, regimeOos.length - 1)

// Build switched returns
const switched: number[] = []
let bullDays = 0, defDays = 0
for (let i = 0; i < N; i++) {
  if (regimeOos[i + 1] === 'BULL') {
    switched.push(spyDaily[i]); bullDays++
  } else {
    switched.push(stratDaily[i]); defDays++
  }
}

function stats(daily: number[]) {
  const n = daily.length
  const mean = daily.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(daily.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, n - 1))
  const annRet = Math.pow(1 + mean, 252) - 1
  const annVol = sd * Math.sqrt(252)
  const sharpe = annVol > 0 ? (annRet - 0.04) / annVol : null
  let peak = 1, eq = 1, maxDD = 0
  for (const r of daily) { eq *= 1 + r; if (eq > peak) peak = eq; const dd = (peak - eq) / peak; if (dd > maxDD) maxDD = dd }
  return { annRet, annVol, sharpe, maxDD }
}

const spyS = stats(spyDaily.slice(0, N))
const stratS = stats(stratDaily.slice(0, N))
const switchedS = stats(switched)

console.log('\n── Regime-Switch Allocator (SPY when bull, Strategy when defensive) ──')
console.log(`  Window: ${(N / 252).toFixed(2)} years (${N} bars)`)
console.log(`  Regime split: ${bullDays} bull days (${((bullDays / N) * 100).toFixed(1)}%), ${defDays} defensive days (${((defDays / N) * 100).toFixed(1)}%)\n`)
const rows = [
  { name: 'SPY buy-and-hold   ', s: spyS },
  { name: 'Strategy only      ', s: stratS },
  { name: 'Regime-switch      ', s: switchedS },
]
console.log('  Portfolio             AnnRet  AnnVol  Sharpe  MaxDD   Alpha vs SPY')
for (const r of rows) {
  const alpha = r.s.annRet - spyS.annRet
  console.log(`  ${r.name}  ${(r.s.annRet * 100).toFixed(2)}%  ${(r.s.annVol * 100).toFixed(2)}%  ${(r.s.sharpe ?? 0).toFixed(2)}    ${(r.s.maxDD * 100).toFixed(1)}%   ${(alpha * 100).toFixed(2)}%`)
}

const alpha = switchedS.annRet - spyS.annRet
const pass = switchedS.sharpe !== null && spyS.sharpe !== null && switchedS.sharpe >= spyS.sharpe && switchedS.maxDD < spyS.maxDD
console.log(`\n  Regime-switch vs SPY: alpha=${(alpha * 100).toFixed(2)}%, Sharpe ${(switchedS.sharpe ?? 0).toFixed(2)} vs ${(spyS.sharpe ?? 0).toFixed(2)}, MaxDD ${(switchedS.maxDD * 100).toFixed(1)}% vs ${(spyS.maxDD * 100).toFixed(1)}%`)
console.log(`  Gate (Sharpe ≥ SPY AND MaxDD < SPY): ${pass ? '✓ PASS' : '✗ FAIL'}\n`)

mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/regime-switch.json', JSON.stringify({
  runAt: new Date().toISOString(),
  window: { years: Number((N / 252).toFixed(2)), bars: N },
  regimeSplit: { bullDays, defDays },
  spy: spyS,
  strategy: stratS,
  regimeSwitch: switchedS,
  alphaVsSpy: alpha,
  commercialGate: pass,
}, null, 2))
console.log('  Artifact: artifacts/regime-switch.json\n')
