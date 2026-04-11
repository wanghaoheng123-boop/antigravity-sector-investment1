import { describe, it, expect } from 'vitest'
import {
  computePositionSize,
  tradeStatsFromHistory,
  fixedFractionSize,
  type TradeStats,
} from '@/lib/portfolio/sizing'

// ────────────────────────────────────────────────────────────────
// fixedFractionSize
// ────────────────────────────────────────────────────────────────

describe('fixedFractionSize', () => {
  it('computes shares correctly', () => {
    // Risk $1,000 on a $100 stock with 5% stop: shares = 1000 / (100 * 0.05) = 200
    const r = fixedFractionSize(100_000, 100, 0.01, 0.05)
    expect(r.dollarRisk).toBe(1_000)
    expect(r.shares).toBe(200)
    expect(r.positionValue).toBe(20_000)
  })

  it('floors shares at 0 for zero stop', () => {
    const r = fixedFractionSize(100_000, 100, 0.01, 0)
    expect(r.shares).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────
// tradeStatsFromHistory
// ────────────────────────────────────────────────────────────────

describe('tradeStatsFromHistory', () => {
  const trades = [
    { ticker: 'AAPL', action: 'BUY'  as const, pnlPct: undefined },
    { ticker: 'AAPL', action: 'SELL' as const, pnlPct: 0.10 },   // win
    { ticker: 'AAPL', action: 'SELL' as const, pnlPct: -0.05 },  // loss
    { ticker: 'AAPL', action: 'SELL' as const, pnlPct: 0.08 },   // win
    { ticker: 'MSFT', action: 'SELL' as const, pnlPct: 0.15 },   // different ticker
  ]

  it('returns null for fewer than 3 sells', () => {
    const result = tradeStatsFromHistory([
      { ticker: 'X', action: 'SELL', pnlPct: 0.05 },
      { ticker: 'X', action: 'SELL', pnlPct: -0.03 },
    ])
    expect(result).toBeNull()
  })

  it('computes winRate correctly', () => {
    const stats = tradeStatsFromHistory(trades, 'AAPL')!
    expect(stats).not.toBeNull()
    // 2 wins, 1 loss out of 3 AAPL sells
    expect(stats.winRate).toBeCloseTo(2 / 3, 5)
  })

  it('filters by ticker when supplied', () => {
    const stats = tradeStatsFromHistory(trades, 'AAPL')!
    expect(stats.sampleSize).toBe(3)
  })

  it('includes all tickers when no filter', () => {
    const stats = tradeStatsFromHistory(trades)!
    expect(stats.sampleSize).toBe(4)  // 4 SELL entries
  })

  it('computes avgWin and avgLoss', () => {
    const stats = tradeStatsFromHistory(trades, 'AAPL')!
    expect(stats.avgWin).toBeCloseTo((0.10 + 0.08) / 2, 5)
    expect(stats.avgLoss).toBeCloseTo(0.05, 5)
  })
})

// ────────────────────────────────────────────────────────────────
// computePositionSize
// ────────────────────────────────────────────────────────────────

describe('computePositionSize', () => {
  const goodStats: TradeStats = {
    winRate: 0.60,
    avgWin:  0.08,
    avgLoss: 0.04,
    sampleSize: 50,
  }

  const insufficientStats: TradeStats = {
    winRate: 0.60,
    avgWin:  0.08,
    avgLoss: 0.04,
    sampleSize: 5,
  }

  const negativeEdgeStats: TradeStats = {
    winRate: 0.40,
    avgWin:  0.02,
    avgLoss: 0.08,
    sampleSize: 50,
  }

  it('returns non-null Kelly fractions for positive edge', () => {
    const r = computePositionSize(goodStats, 100_000, 150)
    expect(r.fullKellyFraction).not.toBeNull()
    expect(r.halfKellyFraction).not.toBeNull()
    expect(r.quarterKellyFraction).not.toBeNull()
  })

  it('half-Kelly is exactly half of full-Kelly (for positive edge)', () => {
    const r = computePositionSize(goodStats, 100_000, 150)
    expect(r.halfKellyFraction).toBeCloseTo(r.fullKellyFraction! / 2, 5)
  })

  it('recommendedFraction = 0 for insufficient sample', () => {
    const r = computePositionSize(insufficientStats, 100_000, 150)
    expect(r.recommendedFraction).toBe(0)
    expect(r.confidence).toBe('INSUFFICIENT')
  })

  it('recommendedFraction <= maxPositionPct', () => {
    const r = computePositionSize(goodStats, 100_000, 150, { maxPositionPct: 0.10 })
    expect(r.recommendedFraction).toBeLessThanOrEqual(0.10 + 1e-9)
  })

  it('recommendedFraction <= 0.02 for LOW confidence', () => {
    const lowStats: TradeStats = { ...goodStats, sampleSize: 15 }
    const r = computePositionSize(lowStats, 100_000, 150)
    expect(r.confidence).toBe('LOW')
    expect(r.recommendedFraction).toBeLessThanOrEqual(0.02 + 1e-9)
  })

  it('recommendedDollar = portfolioEquity * recommendedFraction', () => {
    const r = computePositionSize(goodStats, 100_000, 150)
    expect(r.recommendedDollar).toBeCloseTo(100_000 * r.recommendedFraction, 2)
  })

  it('recommendedShares = floor(recommendedDollar / entryPrice)', () => {
    const r = computePositionSize(goodStats, 100_000, 150)
    expect(r.recommendedShares).toBe(Math.floor(r.recommendedDollar / 150))
  })

  it('rationale mentions negative edge for losing strategy', () => {
    const r = computePositionSize(negativeEdgeStats, 100_000, 100)
    expect(r.rationale.toLowerCase()).toContain('negative edge')
  })

  it('confidence: HIGH for 100+ trades', () => {
    const r = computePositionSize({ ...goodStats, sampleSize: 150 }, 100_000, 100)
    expect(r.confidence).toBe('HIGH')
  })

  it('confidence: MEDIUM for 30-99 trades', () => {
    const r = computePositionSize({ ...goodStats, sampleSize: 50 }, 100_000, 100)
    expect(r.confidence).toBe('MEDIUM')
  })

  it('volatility scaling reduces fraction for high-vol instrument', () => {
    // Target 1% daily vol, instrument has 60% annual vol (=3.8% daily)
    const rBase = computePositionSize(goodStats, 100_000, 100)
    const rScaled = computePositionSize(goodStats, 100_000, 100, {
      targetDailyVol: 0.01,
      instrumentAnnualVol: 0.60,
    })
    // High-vol instrument: scaling factor = 0.01 / (0.60/sqrt(252)) ≈ 0.26x
    expect(rScaled.recommendedFraction).toBeLessThan(rBase.recommendedFraction)
  })

  it('fixedRiskPct overrides Kelly when supplied', () => {
    const r = computePositionSize(goodStats, 100_000, 100, { fixedRiskPct: 0.015 })
    // Should use 1.5% as base before clamping (may be further reduced by maxPositionPct/divCap)
    expect(r.recommendedFraction).toBeLessThanOrEqual(0.015 + 1e-9)
  })
})
