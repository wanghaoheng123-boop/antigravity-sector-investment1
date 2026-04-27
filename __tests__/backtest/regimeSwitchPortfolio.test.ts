import { describe, it, expect } from 'vitest'
import { regimeSwitchPortfolio } from '@/lib/backtest/regimeSwitchPortfolio'

// Synthetic fixture: 300 bars of benchmark, trending up then sideways.
// Strategy returns are constant +0.0005/day (0.05% daily, ~13%/yr).
function makeBenchmark(n: number, pattern: (i: number) => number): { close: number }[] {
  return Array.from({ length: n }, (_, i) => ({ close: pattern(i) }))
}

describe('regimeSwitchPortfolio', () => {
  it('holds benchmark when price is above SMA (BULL regime)', () => {
    const rows = makeBenchmark(300, i => 100 * Math.pow(1.001, i)) // steady uptrend
    const stratDaily = new Array(299).fill(0.0005)
    const res = regimeSwitchPortfolio({
      benchmarkRows: rows,
      strategyDailyReturns: stratDaily,
      smaPeriod: 50,
    })
    // After SMA seeds, almost all days should be BULL
    expect(res.bullShare).toBeGreaterThan(0.8)
    expect(res.annualizedReturn).toBeGreaterThan(0.2) // ~25%/yr from benchmark
  })

  it('switches to strategy when benchmark drops below SMA', () => {
    // V-shape: up 150 bars then straight down 150 bars
    const rows = makeBenchmark(300, i =>
      i < 150 ? 100 + i * 0.5 : 175 - (i - 150) * 0.6
    )
    const stratDaily = new Array(299).fill(0.001)
    const res = regimeSwitchPortfolio({
      benchmarkRows: rows,
      strategyDailyReturns: stratDaily,
      smaPeriod: 50,
    })
    // Should have a meaningful share of DEFENSIVE days during the drawdown
    expect(res.bullShare).toBeLessThan(0.8)
    expect(res.regime.includes('DEFENSIVE')).toBe(true)
    // Max DD should be much smaller than benchmark alone (which would fall ~50%)
    expect(res.maxDrawdown).toBeLessThan(0.3)
  })

  it('returns finite Sharpe and sensible length', () => {
    const rows = makeBenchmark(400, i => 100 + Math.sin(i / 20) * 5 + i * 0.02)
    const stratDaily = new Array(399).fill(0.0003)
    const res = regimeSwitchPortfolio({
      benchmarkRows: rows,
      strategyDailyReturns: stratDaily,
    })
    expect(res.dailyReturns.length).toBe(res.regime.length)
    expect(Number.isFinite(res.annualizedReturn)).toBe(true)
    expect(res.sharpe === null || Number.isFinite(res.sharpe)).toBe(true)
  })
})
