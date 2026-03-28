/**
 * Transparent composite 0–100 "research dashboard" score from sub-pillars.
 * Not alpha — a summarized lens so users see what inputs drove the number.
 */

export interface ResearchScoreInput {
  trailingPE: number | null
  forwardPE: number | null
  debtToEquity: number | null
  returnOnEquity: number | null
  profitMargin: number | null
  rsi14: number | null
  /** -1 bearish stack, 0 mixed, 1 bullish stack */
  trendScore: number | null
  /** %B Bollinger 0-1 */
  pctB: number | null
  /** vs SPY 60d excess return */
  excessVsSpy60d: number | null
  /** 0 = deep buy zone, 0.5 neutral, 1 = above sell zone heuristic */
  bandPosition: number | null
}

export interface PillarScore {
  name: string
  score: number
  detail: string
}

function clamp01(x: number) {
  return Math.max(0, Math.min(100, x))
}

/** Map forward P/E to crude value score (lower PE → higher for profitable value tilt). */
function valueFromPe(pe: number | null): { s: number; d: string } {
  if (pe == null || pe <= 0) return { s: 50, d: 'P/E unavailable — neutral value pillar.' }
  if (pe < 12) return { s: 85, d: 'Low multiple vs. broad market heuristic.' }
  if (pe < 18) return { s: 70, d: 'Moderate multiple.' }
  if (pe < 28) return { s: 55, d: 'Elevated multiple.' }
  return { s: 35, d: 'Very high multiple — growth or hype priced in.' }
}

function qualityScore(de: number | null, roe: number | null, margin: number | null): PillarScore {
  let s = 50
  const bits: string[] = []
  if (roe != null && roe > 0.15) {
    s += 20
    bits.push('strong ROE')
  } else if (roe != null && roe > 0.08) {
    s += 10
    bits.push('ok ROE')
  } else if (roe != null && roe < 0) {
    s -= 15
    bits.push('negative ROE')
  }
  if (margin != null && margin > 0.2) {
    s += 10
    bits.push('healthy margins')
  }
  if (de != null) {
    if (de < 0.5) {
      s += 10
      bits.push('low leverage')
    } else if (de > 2) {
      s -= 15
      bits.push('high debt/equity')
    }
  }
  return {
    name: 'Quality / balance sheet',
    score: clamp01(s),
    detail: bits.length ? bits.join(' · ') : 'Limited quality metrics.',
  }
}

function momentumScore(
  rsi: number | null,
  trend: number | null,
  pctB: number | null
): PillarScore {
  let s = 50
  const bits: string[] = []
  if (rsi != null) {
    if (rsi < 30) {
      s += 15
      bits.push('RSI oversold')
    } else if (rsi > 70) {
      s -= 10
      bits.push('RSI overbought')
    } else bits.push(`RSI ${rsi.toFixed(0)}`)
  }
  if (trend != null) {
    s += trend * 20
    bits.push(trend > 0 ? 'trend supportive' : trend < 0 ? 'trend hostile' : 'mixed trend')
  }
  if (pctB != null) {
    if (pctB < 0.15) {
      s += 8
      bits.push('near lower Bollinger')
    } else if (pctB > 0.85) {
      s -= 8
      bits.push('near upper Bollinger')
    }
  }
  return {
    name: 'Momentum & technicals',
    score: clamp01(s),
    detail: bits.join(' · ') || 'Neutral momentum.',
  }
}

function rsScore(excess: number | null): PillarScore {
  if (excess == null) return { name: 'Relative strength (vs SPY)', score: 50, detail: 'Insufficient overlap with SPY.' }
  const ann = excess
  let s = 50 + ann * 120
  const detail =
    ann > 0.05
      ? `Outperforming SPY in window (+${(ann * 100).toFixed(1)}%).`
      : ann < -0.05
        ? `Underperforming SPY (${(ann * 100).toFixed(1)}%).`
        : 'In line with SPY.'
  return { name: 'Relative strength (vs SPY)', score: clamp01(s), detail }
}

function valuationBandScore(pos: number | null): PillarScore {
  if (pos == null) return { name: 'Valuation band fit', score: 50, detail: 'Bands unavailable.' }
  const s = 100 - pos * 100
  return {
    name: 'Valuation band fit',
    score: clamp01(s),
    detail:
      pos < 0.35
        ? 'Closer to mechanical buy zone vs composite fair value.'
        : pos > 0.65
          ? 'Closer to mechanical sell zone vs composite fair value.'
          : 'Mid-band vs model anchors.',
  }
}

export function computeResearchScore(i: ResearchScoreInput): {
  pillars: PillarScore[]
  total: number
  weights: string
} {
  const v = valueFromPe(i.forwardPE ?? i.trailingPE)
  const valuePillar: PillarScore = {
    name: 'Value (multiples heuristic)',
    score: v.s,
    detail: v.d,
  }
  const q = qualityScore(i.debtToEquity, i.returnOnEquity, i.profitMargin)
  const m = momentumScore(i.rsi14, i.trendScore, i.pctB)
  const r = rsScore(i.excessVsSpy60d)
  const b = valuationBandScore(i.bandPosition)

  const pillars = [valuePillar, q, m, r, b]
  const weights = '20% value · 25% quality · 20% momentum · 20% vs SPY · 15% band position'
  const w = [0.2, 0.25, 0.2, 0.2, 0.15]
  const total = clamp01(pillars.reduce((s, p, idx) => s + p.score * w[idx], 0))

  return { pillars, total, weights }
}

/** Map price vs buy/sell bands to 0..1 position. */
export function bandPosition(
  price: number,
  buyHigh: number | null,
  sellLow: number | null,
  fair: number | null
): number | null {
  if (buyHigh == null || sellLow == null || fair == null || price <= 0) return null
  if (price <= buyHigh) return 0.15
  if (price >= sellLow) return 0.85
  const mid = (buyHigh + sellLow) / 2
  if (sellLow === buyHigh) return 0.5
  return (price - buyHigh) / (sellLow - buyHigh)
}
