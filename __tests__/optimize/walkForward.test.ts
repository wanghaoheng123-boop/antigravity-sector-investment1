import { describe, it, expect } from 'vitest'
import { boundedWalkForwardGridSearch } from '@/lib/optimize/walkForwardGrid'
import { mergeStrategyConfig } from '@/lib/strategy/strategyConfig'

const DEFAULT_CONFIG = mergeStrategyConfig({})

// ─── Synthetic OHLCV data ─────────────────────────────────────────────────────

function syntheticOhlcv(n: number) {
  const rows = []
  let price = 150
  const baseTime = Math.floor(Date.now() / 1000) - n * 86400
  for (let i = 0; i < n; i++) {
    price *= 1 + (Math.random() - 0.48) * 0.02   // slight upward drift
    rows.push({
      time: baseTime + i * 86400,
      open: price * 0.999,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1_000_000 + Math.random() * 500_000,
    })
  }
  return rows
}

describe('boundedWalkForwardGridSearch', () => {
  const rows = syntheticOhlcv(400)   // enough for multiple WF windows (252 train + 63 test)

  it('returns results when given valid axes and rows', () => {
    const axes = [
      { path: 'regime.smaPeriod', values: [150, 200] },
      { path: 'confirmations.rsiPeriod', values: [10, 14] },
    ]
    const results = boundedWalkForwardGridSearch(
      DEFAULT_CONFIG,
      rows,
      'TEST',
      'Technology',
      axes,
      { maxIterations: 4, maxMs: 10_000, trainDays: 252, testDays: 63 },
    )
    expect(results.length).toBeGreaterThan(0)
  })

  it('overfittingIndex is in [0, 2] for all results', () => {
    const axes = [
      { path: 'regime.smaPeriod', values: [150, 200] },
    ]
    const results = boundedWalkForwardGridSearch(
      DEFAULT_CONFIG,
      rows,
      'TEST',
      'Technology',
      axes,
      { maxIterations: 2, maxMs: 10_000, trainDays: 252, testDays: 63 },
    )
    for (const r of results) {
      expect(r.overfittingIndex).toBeGreaterThanOrEqual(0)
      expect(r.overfittingIndex).toBeLessThanOrEqual(2)
    }
  })

  it('results are sorted by scoreOosReturn descending', () => {
    const axes = [
      { path: 'regime.smaPeriod', values: [100, 150, 200] },
    ]
    const results = boundedWalkForwardGridSearch(
      DEFAULT_CONFIG,
      rows,
      'TEST',
      'Technology',
      axes,
      { maxIterations: 3, maxMs: 15_000, trainDays: 252, testDays: 63 },
    )
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].scoreOosReturn).toBeGreaterThanOrEqual(results[i].scoreOosReturn)
    }
  })

  it('returns empty array when rows are insufficient for WF windows', () => {
    const shortRows = syntheticOhlcv(200)   // < 252 + 63 + 50 = 365 required
    const axes = [{ path: 'regime.smaPeriod', values: [200] }]
    const results = boundedWalkForwardGridSearch(
      DEFAULT_CONFIG,
      shortRows,
      'TEST',
      'Technology',
      axes,
      { maxIterations: 2, maxMs: 5_000, trainDays: 252, testDays: 63 },
    )
    expect(results.length).toBe(0)
  })
})
