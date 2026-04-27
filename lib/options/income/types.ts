/**
 * Paper options-income legs — isolated from the equity backtest engine until validated.
 */

export type IncomeLegKind = 'csp' | 'covered_call' | 'vertical_put_spread' | 'vertical_call_spread'

export interface OptionsIncomeLeg {
  id: string
  kind: IncomeLegKind
  underlying: string
  /** Mid premium received (+) or paid (-) per share equivalent. */
  premiumPerShare: number
  shortStrike: number
  longStrike: number | null
  expiryIso: string
  contracts: number
  /** Collateral required for short premium strategies (e.g. CSP = strike × 100 × contracts). */
  collateralCash: number
}

export interface OptionsIncomeScenarioFlags {
  /** When false, assignment / exercise paths are not simulated (default). */
  allowAssignment: boolean
}
