export interface AccumulationProxyInput {
  atrPct?: number | null
  macdHist?: number | null
  rsi14?: number | null
  changePct?: number | null
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export function accumulationScore(input: AccumulationProxyInput): number {
  const atr = input.atrPct ?? 3
  const macd = input.macdHist ?? 0
  const rsi = input.rsi14 ?? 50
  const day = input.changePct ?? 0

  const stableVol = clamp01((8 - atr) / 8)
  const momentum = macd > 0 ? 0.7 : 0.35
  const nonChase = clamp01((65 - rsi) / 35)
  const gapPenalty = day > 2.5 ? 0.15 : 0
  return clamp01(0.35 * stableVol + 0.35 * momentum + 0.3 * nonChase - gapPenalty)
}
