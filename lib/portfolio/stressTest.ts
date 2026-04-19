/**
 * Scenario shocks on portfolio equity (multiplicative, illustrative).
 * Not a prediction — stress labels are for UX only.
 */

export type StressScenarioId = 'gfc_2008' | 'covid_2020' | 'rates_2022'

export interface StressScenario {
  id: StressScenarioId
  label: string
  /** Multiplicative hit to equity (e.g. 0.35 → −35%). */
  equityShock: number
  description: string
}

export const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'gfc_2008',
    label: 'GFC-style (-35%)',
    equityShock: -0.35,
    description: 'Illustrative broad-equity drawdown similar in magnitude to 2008 peak-to-trough for diversified equities.',
  },
  {
    id: 'covid_2020',
    label: 'COVID crash (-30%)',
    equityShock: -0.3,
    description: 'Fast shock similar to Feb–Mar 2020 velocity (not instrument-specific).',
  },
  {
    id: 'rates_2022',
    label: 'Rate shock (-20%)',
    equityShock: -0.2,
    description: 'Illustrative duration / growth multiple compression episode.',
  },
]

export function applyStressToEquity(equity: number, shockFraction: number): number {
  return equity * (1 + shockFraction)
}
