import { describe, it, expect } from 'vitest'
import { assertCspCollateralInvariant, paperShortPremiumMark } from '@/lib/options/income/paperIncome'
import type { OptionsIncomeLeg } from '@/lib/options/income/types'

describe('options income paper', () => {
  it('csp collateral invariant holds for well-formed leg', () => {
    const leg: OptionsIncomeLeg = {
      id: 't',
      kind: 'csp',
      underlying: 'XX',
      premiumPerShare: 1.2,
      shortStrike: 100,
      longStrike: null,
      expiryIso: '2026-12-19',
      contracts: 2,
      collateralCash: 100 * 100 * 2,
    }
    expect(assertCspCollateralInvariant(leg)).toBe(true)
  })

  it('assignment path is documented when disabled', () => {
    const leg: OptionsIncomeLeg = {
      id: 't2',
      kind: 'csp',
      underlying: 'XX',
      premiumPerShare: 0.5,
      shortStrike: 100,
      longStrike: null,
      expiryIso: '2026-12-19',
      contracts: 1,
      collateralCash: 10_000,
    }
    const r = paperShortPremiumMark(leg, 90, { allowAssignment: false })
    expect(parseFloat(r.pnl)).toBeGreaterThan(0)
  })
})
