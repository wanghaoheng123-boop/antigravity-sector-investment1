/**
 * Default bounded optimization axes per risk preset (Phase 1 / 6).
 */

import type { GridAxis } from '@/lib/optimize/gridSearch'

export type RiskPresetName = 'Conservative' | 'Balanced' | 'Aggressive' | 'Momentum'

const conservative: GridAxis[] = [
  { path: 'regime.smaPeriod', values: [180, 200, 220] },
  { path: 'confirmations.rsiBullThreshold', values: [28, 30, 32] },
]

const balanced: GridAxis[] = [
  { path: 'regime.smaPeriod', values: [190, 200, 210] },
  { path: 'stopLoss.stopLossAtrMultiplier', values: [1.2, 1.5, 1.8] },
]

const aggressive: GridAxis[] = [
  { path: 'regime.smaPeriod', values: [150, 200] },
  { path: 'stopLoss.stopLossAtrMultiplier', values: [1.8, 2.2] },
]

const momentum: GridAxis[] = [
  { path: 'regime.smaPeriod', values: [100, 150, 200] },
  { path: 'confirmations.rsiBullThreshold', values: [35, 40, 45] },
]

export function defaultAxesForPreset(name: string): GridAxis[] {
  const n = name.toLowerCase()
  if (n.includes('conservative')) return conservative
  if (n.includes('aggressive')) return aggressive
  if (n.includes('momentum')) return momentum
  return balanced
}
