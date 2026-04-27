import { describe, it, expect } from 'vitest'
import { buildInstitutionalRanking } from '@/lib/alpha/institutionalRanking'

// Shared result factory
function mkResult(ticker: string, ann: number, dd: number, sector = 'Technology') {
  return {
    ticker,
    sector,
    annualizedReturn: ann,
    excessReturn: ann - 0.02,
    maxDrawdown: dd,
    winRate: 0.56,
    profitFactor: 1.35,
    sharpeRatio: 0.75,
    sortinoRatio: 1.1,
  } as any
}

const strongWalkForward = {
  avgOsReturn: 0.12,
  avgOosRatio: 0.80,
  overfittingIndex: 0.20,
  windows: [{}],   // non-empty → hasWalkForward = true
} as any

const goodLive = {
  rsi14: 52,
  macdHist: 0.2,
  atrPct: 2.4,
  deviationPct: -0.8,
  changePct: 0.7,
}

describe('institutional ranking', () => {
  it('returns deterministic ordering — higher return ranks first', () => {
    const mk = (ticker: string, ann: number, dd: number) => ({
      result: mkResult(ticker, ann, dd),
      walkForward: { avgOsReturn: 0.08, avgOosRatio: 0.72, overfittingIndex: 0.32, windows: [{}] } as any,
      live: goodLive,
    })
    const rows = buildInstitutionalRanking([mk('AAA', 0.15, 0.18), mk('BBB', 0.08, 0.24)])
    expect(rows[0].ticker).toBe('AAA')
    expect(rows[0].regimeScore).toBeGreaterThanOrEqual(0)
    expect(rows[0].persistenceScore).toBeGreaterThanOrEqual(0)
    expect(rows[0].accumulationScore).toBeGreaterThanOrEqual(0)
  })

  // Fixture A: strong OOS returns + low drawdown → conviction A (score ≥ 0.72)
  it('Fixture A: strong OOS + low drawdown → conviction A', () => {
    const input = {
      result: mkResult('STRONG', 0.22, 0.12),
      walkForward: { ...strongWalkForward, avgOsReturn: 0.18, avgOosRatio: 0.90, overfittingIndex: 0.10 },
      live: goodLive,
    }
    const [row] = buildInstitutionalRanking([input])
    expect(row.rankScore).toBeGreaterThanOrEqual(0.72)
    expect(row.conviction).toBe('A')
    expect(row.actionBias).toBe('accumulate')
  })

  // Fixture B: high IS return but no walk-forward → robustness weight redistributed;
  // should NOT trivially score ≥ 0.72 from IS return alone
  it('Fixture B: high IS return, null walkForward → not conviction A', () => {
    const input = {
      result: mkResult('HIGHIS', 0.30, 0.15),
      walkForward: null,
      live: goodLive,
    }
    const [row] = buildInstitutionalRanking([input])
    // Without OOS evidence, score should stay below the conviction A threshold
    expect(row.conviction).not.toBe('A')
    // robustnessScore must be 0 when no walk-forward
    expect(row.robustnessScore).toBe(0)
  })

  // Fixture C: null live data → timingScore defaults to 0.5, not 0
  it('Fixture C: null live data → timingScore = 0.5', () => {
    const input = {
      result: mkResult('NOLIVE', 0.10, 0.20),
      walkForward: strongWalkForward,
      live: undefined,
    }
    const [row] = buildInstitutionalRanking([input])
    expect(row.timingScore).toBeCloseTo(0.5, 1)
  })

  // Ensure rankScore is always in [0, 1]
  it('rankScore is always in [0, 1]', () => {
    const inputs = [
      { result: mkResult('X1', 0.50, 0.05), walkForward: strongWalkForward, live: goodLive },
      { result: mkResult('X2', -0.20, 0.60), walkForward: null, live: undefined },
      { result: mkResult('X3', 0.0, 0.30), walkForward: { ...strongWalkForward, avgOsReturn: -0.05, overfittingIndex: 0.99 }, live: { rsi14: 80, macdHist: -0.5, atrPct: 15, deviationPct: 30, changePct: -3 } },
    ]
    const rows = buildInstitutionalRanking(inputs)
    for (const row of rows) {
      expect(row.rankScore).toBeGreaterThanOrEqual(0)
      expect(row.rankScore).toBeLessThanOrEqual(1)
    }
  })
})
