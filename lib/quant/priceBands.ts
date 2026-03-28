/**
 * Volatility-adaptive fair-value bands. Not a recommendation — a transparent mechanical overlay.
 */

export interface BandInputs {
  currentPrice: number
  /** Candidate anchors; nulls dropped before median. */
  anchors: (number | null | undefined)[]
  /** Annualized volatility of log returns, e.g. 0.25 = 25%. */
  annualizedVol: number
  /** Base margin of safety before vol adjustment. */
  baseMargin?: number
}

export interface PriceBands {
  fairValueMid: number | null
  buyZoneHigh: number | null
  sellZoneLow: number | null
  methodology: string
}

export function computeAdaptiveBands(i: BandInputs): PriceBands {
  const anchors = i.anchors.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
  const vol = Math.max(0.05, Math.min(0.8, i.annualizedVol || 0.2))
  const baseM = i.baseMargin ?? 0.08

  if (anchors.length === 0 || !Number.isFinite(i.currentPrice) || i.currentPrice <= 0) {
    return {
      fairValueMid: null,
      buyZoneHigh: null,
      sellZoneLow: null,
      methodology: 'Insufficient anchors to compute a composite fair value.',
    }
  }

  const sorted = [...anchors].sort((a, b) => a - b)
  const mid =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) >> 1]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  const m = baseM + Math.min(0.12, vol * 0.6)
  const buyZoneHigh = mid * (1 - m)
  const sellZoneLow = mid * (1 + 0.5 * m + 0.35 * vol)

  return {
    fairValueMid: mid,
    buyZoneHigh,
    sellZoneLow,
    methodology:
      `Composite fair value = median of ${anchors.length} anchor(s) (DCF / analyst target / forward-earnings heuristic). ` +
      `Margin of safety scales with annualized vol (~${(vol * 100).toFixed(1)}%): buy zone below ${(m * 100).toFixed(1)}%–${((m + 0.12) * 100).toFixed(1)}% of fair value; sell zone uses vol-adjusted extension.`,
  }
}
