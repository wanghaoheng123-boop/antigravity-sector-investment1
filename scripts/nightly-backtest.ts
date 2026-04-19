/**
 * Nightly institutional backtest — local JSON history only (no network).
 * Fails if portfolio win rate < 55% (same philosophy as AGENTS.md).
 *
 * Run: npm run nightly
 */

import { SECTORS } from '../lib/sectors'
import { loadStockHistory, loadBtcHistory, availableTickers } from '../lib/backtest/dataLoader'
import { backtestInstrument, aggregatePortfolio } from '../lib/backtest/engine'

function main() {
  const results = []
  const localSet = new Set(availableTickers().map((t) => t.toUpperCase()))

  for (const sector of SECTORS) {
    for (const ticker of sector.topHoldings) {
      if (!localSet.has(ticker.toUpperCase())) continue
      const rows = loadStockHistory(ticker)
      if (rows.length >= 100) {
        results.push(backtestInstrument(ticker, sector.name, rows))
      }
    }
  }

  const btcRows = loadBtcHistory()
  if (btcRows.length >= 100) {
    results.push(backtestInstrument('BTC', 'Crypto', btcRows))
  }

  if (results.length === 0) {
    console.error('[nightly-backtest] No instruments with sufficient local history.')
    process.exit(1)
  }

  const p = aggregatePortfolio(results, 100_000)
  console.log(
    `[nightly-backtest] instruments=${results.length} winRate=${(p.winRate * 100).toFixed(2)}% trades=${p.totalTrades} return=${(p.totalReturn * 100).toFixed(2)}%`,
  )

  if (p.winRate < 0.55) {
    console.error('[nightly-backtest] FAIL: portfolio win rate below 55%.')
    process.exit(1)
  }
}

main()
