/**
 * Signal parameter optimizer — grid search over regime + confirmation thresholds.
 * Runs backtestInstrument across a grid and reports top configurations by
 * risk-adjusted objective (Sharpe-first with drawdown/return tie-breakers).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { backtestInstrument } from '@/lib/backtest/engine'
import { loadStockHistory } from '@/lib/backtest/dataLoader'
import { DEFAULT_CONFIG, type BacktestConfig } from '@/lib/backtest/signals'

const UNIVERSE = ['NVDA', 'MSFT', 'XOM', 'CVX', 'BRK-B', 'JPM', 'LLY', 'UNH', 'AMZN', 'TSLA', 'GE', 'RTX', 'SPY', 'QQQ', 'GLD', 'BTC']

type ParamGrid = {
  rsiBullThreshold: number[]
  smaSlopeThreshold: number[]
  priceProximityPct: number[]
  minBullishConfirms: number[]
  atrPctThreshold: number[]
}

const GRID: ParamGrid = {
  rsiBullThreshold:    [35, 40, 45, 50],
  smaSlopeThreshold:   [0.001, 0.003, 0.005],
  priceProximityPct:   [5, 10, 15, 20],
  minBullishConfirms:  [1, 2],
  atrPctThreshold:     [1.5, 2.0, 2.5],
}

interface GridResult {
  params: Record<string, number>
  totalTrades: number
  winRate: number
  annReturn: number
  maxDD: number
  sharpe: number | null
  score: number
  instruments: number
}

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap(a => arr.map(b => [...a, b])),
    [[]]
  )
}

function main() {
  console.log('[optimize] Loading OHLCV data...')
  const allRows: Record<string, ReturnType<typeof loadStockHistory>> = {}
  for (const t of UNIVERSE) {
    const rows = loadStockHistory(t)
    if (rows.length >= 252) allRows[t] = rows
  }
  const loaded = Object.keys(allRows)
  console.log(`[optimize] ${loaded.length} tickers with sufficient history`)

  const keys = Object.keys(GRID) as (keyof ParamGrid)[]
  const axes = keys.map(k => GRID[k])
  const combos = cartesian(axes)
  console.log(`[optimize] Testing ${combos.length} parameter combinations × ${loaded.length} tickers`)

  const results: GridResult[] = []
  let done = 0

  for (const combo of combos) {
    const params: Record<string, number> = {}
    keys.forEach((k, i) => { params[k] = combo[i]! })

    const cfg: BacktestConfig = {
      ...DEFAULT_CONFIG,
      rsiOversold: params.rsiBullThreshold!,
      smaSlopeThreshold: params.smaSlopeThreshold!,
      priceProximityPct: params.priceProximityPct!,
      minBullishConfirms: params.minBullishConfirms!,
      atrPctThreshold: params.atrPctThreshold!,
    }

    const backtests = loaded.map(t => backtestInstrument(t, 'matrix', allRows[t]!, cfg))
    const withTrades = backtests.filter(r => r.totalTrades > 0)
    if (withTrades.length === 0) {
      done++; continue
    }

    const avgWinRate = withTrades.reduce((s, r) => s + r.winRate, 0) / withTrades.length
    const avgAnn     = backtests.reduce((s, r) => s + r.annualizedReturn, 0) / backtests.length
    const avgDD      = backtests.reduce((s, r) => s + r.maxDrawdown, 0) / backtests.length
    const sharpes    = backtests.map(r => r.sharpeRatio).filter((x): x is number => x != null && Number.isFinite(x))
    const avgSharpe  = sharpes.length ? sharpes.reduce((s, x) => s + x, 0) / sharpes.length : null
    const totalTrades = withTrades.reduce((s, r) => s + r.totalTrades, 0)

    const sharpeScore = avgSharpe ?? -5
    const score = sharpeScore * 100 + avgAnn * 20 - avgDD * 25 + avgWinRate * 5
    results.push({
      params,
      totalTrades,
      winRate: avgWinRate,
      annReturn: avgAnn,
      maxDD: avgDD,
      sharpe: avgSharpe,
      score,
      instruments: withTrades.length,
    })
    done++
    if (done % 20 === 0) process.stdout.write(`  ${done}/${combos.length}...\r`)
  }

  // Sort by risk-adjusted score (Sharpe-first), then by drawdown control.
  results.sort(
    (a, b) =>
      b.score - a.score ||
      (b.sharpe ?? -5) - (a.sharpe ?? -5) ||
      a.maxDD - b.maxDD,
  )

  console.log(`\n[optimize] Top 20 configurations by risk-adjusted objective:\n`)
  console.log('Rank  Score  WinRate  AnnRet  MaxDD  Sharpe  Trades  Inst | Params')
  console.log('─'.repeat(100))
  for (const [i, r] of results.slice(0, 20).entries()) {
    const p = Object.entries(r.params).map(([k, v]) => `${k.replace('BullishConfirms','Conf').replace('priceProximityPct','prox').replace('smaSlopeThreshold','slope').replace('atrPctThreshold','atr').replace('rsiBullThreshold','rsi')}=${v}`).join(' ')
    console.log(
      `#${String(i+1).padStart(2)}   ${r.score.toFixed(1).padStart(6)}  ${(r.winRate*100).toFixed(1)}%  ${(r.annReturn*100).toFixed(2)}%  ${(r.maxDD*100).toFixed(1)}%  ${r.sharpe != null ? r.sharpe.toFixed(2) : 'n/a'}  ${String(r.totalTrades).padStart(6)}  ${r.instruments}/${loaded.length}  | ${p}`
    )
  }

  const outDir = join(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'signal-param-optimization.json')
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    universe: loaded,
    totalCombos: combos.length,
    topConfigs: results.slice(0, 30),
  }, null, 2))
  console.log(`\n[optimize] wrote ${outPath}`)

  // Print recommendation
  const best = results[0]
  if (best) {
    console.log('\n[optimize] RECOMMENDED PARAMETERS (best risk-adjusted objective):')
    console.log(JSON.stringify(best.params, null, 2))
  }
}

main()
