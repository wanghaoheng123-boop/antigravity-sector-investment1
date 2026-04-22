import { describe, it, expect } from 'vitest'
import { buildInstitutionalRanking } from '@/lib/alpha/institutionalRanking'

describe('institutional ranking', () => {
  it('returns deterministic ordering with extended factor scores', () => {
    const mk = (ticker: string, ann: number, dd: number) => ({
      result: {
        ticker,
        sector: 'Technology',
        annualizedReturn: ann,
        excessReturn: ann - 0.02,
        maxDrawdown: dd,
        winRate: 0.56,
        profitFactor: 1.35,
        sharpeRatio: 0.75,
        sortinoRatio: 1.1,
      } as any,
      walkForward: {
        avgOsReturn: 0.08,
        avgOosRatio: 0.72,
        overfittingIndex: 0.32,
      } as any,
      live: {
        rsi14: 52,
        macdHist: 0.2,
        atrPct: 2.4,
        deviationPct: -0.8,
        changePct: 0.7,
      },
    })

    const rows = buildInstitutionalRanking([mk('AAA', 0.15, 0.18), mk('BBB', 0.08, 0.24)])
    expect(rows[0].ticker).toBe('AAA')
    expect(rows[0].regimeScore).toBeGreaterThanOrEqual(0)
    expect(rows[0].persistenceScore).toBeGreaterThanOrEqual(0)
    expect(rows[0].accumulationScore).toBeGreaterThanOrEqual(0)
  })
})
