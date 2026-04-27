import { backtestInstrument, aggregatePortfolio } from '@/lib/backtest/engine'
import type { OhlcvRow } from '@/lib/backtest/engine'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

type Fixture = { ticker: string; sector: string; rows: OhlcvRow[] }
const FIX: Fixture[] = readdirSync('data/fixtures').map(f => {
  const d = JSON.parse(readFileSync(join('data/fixtures', f), 'utf8'))
  return { ticker: d.ticker, sector: d.sector, rows: d.rows }
})

function run(cfg: any) {
  const oos = FIX.map(f => {
    const isN = Math.floor(f.rows.length * 0.6)
    return backtestInstrument(f.ticker, f.sector, f.rows.slice(isN), cfg)
  })
  const p = aggregatePortfolio(oos, 100_000)
  return { sharpe: p.sharpeRatio ?? -99, ret: p.totalReturn, trades: oos.reduce((s, r) => s + r.closedTrades.length, 0) }
}

const mins = [0, 1, 2, 4, 6]
const maxs = [8, 12, 15, 20, 25]
for (const mn of mins) for (const mx of maxs) {
  if (mn >= mx) continue
  const r = run({ breakoutMinPullbackPct: mn, breakoutMaxPullbackPct: mx })
  console.log(`  min=${mn} max=${mx} OOS Sharpe=${r.sharpe.toFixed(3)} ret=${(r.ret*100).toFixed(2)}% trades=${r.trades}`)
}
