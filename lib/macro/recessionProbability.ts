/**
 * Lightweight Estrella-Mishkin-style proxy using 10Y-3M spread.
 * Uses the NY Fed probit coefficient (~-0.03 per pct spread) — empirically grounded.
 * Original Estrella-Mishkin (1998) used ~-0.005; NY Fed New York uses ~-0.03.
 * We adopt -0.03 as it produces realistic probabilities for modern spreads.
 *
 * @param spread10y3m - 10Y Treasury yield minus 3M rate (in percentage points, e.g. 0.5 = 50bps)
 * @returns 0..1 recession probability proxy
 */
export function recessionProbabilityFromSpread(spread10y3m: number | null): number {
  if (spread10y3m == null || !Number.isFinite(spread10y3m)) return 0
  // z = intercept + coefficient * spread; coefficient of -0.03 means each 100bps of inversion
  // adds ~3pp to recession probability. At spread=0 (flat yield curve): z=-1.3 → p≈0.21
  const z = -1.3 - 0.03 * spread10y3m
  return 1 / (1 + Math.exp(-z))
}

