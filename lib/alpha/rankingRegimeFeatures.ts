export interface RegimeFeatureInput {
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  winRate: number
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

function scale(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x) || hi <= lo) return 0
  return clamp01((x - lo) / (hi - lo))
}

export function regimeScore(input: RegimeFeatureInput): number {
  const returnQuality =
    0.45 * scale(input.annualizedReturn, -0.03, 0.25) +
    0.25 * scale(input.sharpeRatio ?? -1, -0.5, 1.8) +
    0.2 * scale(input.sortinoRatio ?? -1, -0.5, 2.2) +
    0.1 * scale(input.winRate, 0.35, 0.75)
  const ddPenalty = 0.2 * scale(input.maxDrawdown, 0.08, 0.55)
  return clamp01(returnQuality - ddPenalty)
}

export function sectorPersistenceScore(rankSeries: number[]): number {
  if (rankSeries.length < 2) return 0.5
  let variation = 0
  for (let i = 1; i < rankSeries.length; i += 1) {
    variation += Math.abs(rankSeries[i] - rankSeries[i - 1])
  }
  const avgVariation = variation / (rankSeries.length - 1)
  return clamp01(1 - avgVariation / 10)
}
