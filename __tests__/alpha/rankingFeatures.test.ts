import { describe, it, expect } from 'vitest'
import { regimeScore, sectorPersistenceScore } from '@/lib/alpha/rankingRegimeFeatures'
import { accumulationScore } from '@/lib/alpha/accumulationProxies'

describe('ranking feature modules', () => {
  it('returns bounded regime score', () => {
    const score = regimeScore({
      annualizedReturn: 0.12,
      maxDrawdown: 0.18,
      sharpeRatio: 0.9,
      sortinoRatio: 1.2,
      winRate: 0.58,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('penalizes unstable sector persistence', () => {
    const stable = sectorPersistenceScore([2, 2.2, 2.1, 2.3])
    const unstable = sectorPersistenceScore([1, 5, 2, 8])
    expect(stable).toBeGreaterThan(unstable)
  })

  it('rewards controlled accumulation conditions', () => {
    const good = accumulationScore({ atrPct: 2.2, macdHist: 0.6, rsi14: 48, changePct: 0.6 })
    const bad = accumulationScore({ atrPct: 9.0, macdHist: -0.2, rsi14: 74, changePct: 3.1 })
    expect(good).toBeGreaterThan(bad)
  })
})
