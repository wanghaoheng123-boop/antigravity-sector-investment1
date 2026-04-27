import type { OptionsIncomeLeg, OptionsIncomeScenarioFlags } from './types'

/** Mark short premium to expiry: keep premium if spot stays OTM by expiry (mid-only toy model). */
export function paperShortPremiumMark(
  leg: OptionsIncomeLeg,
  spotAtExpiry: number,
  flags: OptionsIncomeScenarioFlags = { allowAssignment: false },
): { pnl: string; detail: string } {
  const mult = leg.contracts * 100
  const gross = leg.premiumPerShare * mult

  if (leg.kind === 'csp') {
    if (flags.allowAssignment && spotAtExpiry < leg.shortStrike) {
      return {
        pnl: 'assignment-scenario (off by default)',
        detail: `Synthetic assignment at ${leg.shortStrike}: not modeled in PnL — enable allowAssignment only for exploratory scenarios.`,
      }
    }
    return {
      pnl: gross.toFixed(2),
      detail: 'Mid-only: assumes short put expires OTM when assignment is off; ignores borrow, dividends, and borrow fees.',
    }
  }

  if (leg.kind === 'covered_call') {
    return {
      pnl: gross.toFixed(2),
      detail: 'Covered call premium only; stock PnL remains in equity engine when modeled separately.',
    }
  }

  return {
    pnl: gross.toFixed(2),
    detail: 'Spread: premium net of long leg stored in premiumPerShare; path-dependent features not modeled.',
  }
}

/** Invariant: collateral must cover short strike risk for CSP-style legs. */
export function assertCspCollateralInvariant(leg: OptionsIncomeLeg): boolean {
  if (leg.kind !== 'csp') return true
  const need = leg.shortStrike * 100 * leg.contracts
  return leg.collateralCash + 1e-6 >= need
}
