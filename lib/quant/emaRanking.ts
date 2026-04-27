/**
 * EMA Ranking — pure calculation functions for the 200EMA Strength Leaderboard.
 * Spec: EMA_RANKING_SPEC.md
 *
 * All functions are stateless and dependency-free (no I/O).
 */

import type { MA200Zone } from '@/lib/quant/technicals'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmaRankingRow {
  ticker: string
  sector: string
  price: number
  changePct: number | null
  ema200: number | null
  ema20: number | null
  deviationPct: number | null   // (price - ema200) / ema200 * 100
  slopePct: number | null       // (ema200_now - ema200_20bars_ago) / ema200_20bars_ago * 100
  slope20Pct: number | null     // same for ema20
  slopeDiff: number | null      // slope20Pct - slopePct (momentum acceleration)
  rsi14: number | null
  zone: MA200Zone | null
  /** Raw composite score before z-score normalisation (for sorting pre-normalisation). */
  rawScore: number
  /** Z-score normalised composite score (0–1 range after normalisation across universe). */
  score: number
  /** 30 most-recent closes for sparkline rendering. */
  sparkline: number[]
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

/**
 * Standard EMA with SMA seed for the first value.
 * Returns an array of length equal to `closes`, with leading nulls (as NaN) for the
 * warm-up period — indices < period-1 are NaN.
 */
export function computeEma(closes: number[], period: number): number[] {
  if (closes.length < period) return closes.map(() => NaN)
  const k = 2 / (period + 1)
  const result = new Array<number>(closes.length).fill(NaN)
  // Seed: SMA of first `period` values
  let seed = 0
  for (let i = 0; i < period; i++) seed += closes[i]
  result[period - 1] = seed / period
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

// ─── RSI (Wilder smoothing) ──────────────────────────────────────────────────

export function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) avgGain += d
    else avgLoss += Math.abs(d)
  }
  avgGain /= period
  avgLoss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const gain = d > 0 ? d : 0
    const loss = d < 0 ? Math.abs(d) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ─── Zone classification ─────────────────────────────────────────────────────

function zoneFromDeviation(deviationPct: number): MA200Zone {
  if (deviationPct > 20) return 'EXTREME_BULL'
  if (deviationPct > 10) return 'EXTENDED_BULL'
  if (deviationPct >= 0) return 'HEALTHY_BULL'
  if (deviationPct >= -10) return 'FIRST_DIP'
  if (deviationPct >= -20) return 'DEEP_DIP'
  if (deviationPct >= -30) return 'BEAR_ALERT'
  return 'CRASH_ZONE'
}

// ─── Per-ticker computation ──────────────────────────────────────────────────

/**
 * Compute raw EMA ranking fields for a single ticker.
 * `closes` must be sorted oldest→newest, ≥ 220 bars recommended.
 */
export function computeEmaRankingRow(
  ticker: string,
  sector: string,
  closes: number[],
  livePrice: number,
  changePct: number | null,
): Omit<EmaRankingRow, 'score'> & { rawScore: number } {
  const ema200arr = computeEma(closes, 200)
  const ema20arr = computeEma(closes, 20)

  const last = closes.length - 1
  const ema200 = Number.isFinite(ema200arr[last]) ? ema200arr[last] : null
  const ema20 = Number.isFinite(ema20arr[last]) ? ema20arr[last] : null

  const deviationPct =
    ema200 != null && ema200 > 0
      ? ((livePrice - ema200) / ema200) * 100
      : null

  // 20-bar EMA200 slope
  const slopePct =
    ema200 != null && last >= 20
      ? (() => {
          const ema200_20ago = ema200arr[last - 20]
          return Number.isFinite(ema200_20ago) && ema200_20ago > 0
            ? ((ema200 - ema200_20ago) / ema200_20ago) * 100
            : null
        })()
      : null

  // 20-bar EMA20 slope
  const slope20Pct =
    ema20 != null && last >= 20
      ? (() => {
          const ema20_20ago = ema20arr[last - 20]
          return Number.isFinite(ema20_20ago) && ema20_20ago > 0
            ? ((ema20 - ema20_20ago) / ema20_20ago) * 100
            : null
        })()
      : null

  const slopeDiff =
    slope20Pct != null && slopePct != null ? slope20Pct - slopePct : null

  const rsi14 = computeRsi(closes)

  const zone =
    deviationPct != null ? zoneFromDeviation(deviationPct) : null

  // Sparkline: last 30 closes
  const sparkline = closes.slice(Math.max(0, closes.length - 30))

  // Raw score: deviation (65%) + slope (35%) — unnormalised
  const rawScore =
    (deviationPct != null ? 0.65 * deviationPct : 0) +
    (slopePct != null ? 0.35 * slopePct : 0)

  return {
    ticker,
    sector,
    price: livePrice,
    changePct,
    ema200,
    ema20,
    deviationPct,
    slopePct,
    slope20Pct,
    slopeDiff,
    rsi14,
    zone,
    rawScore,
    sparkline,
  }
}

// ─── Universe normalisation ──────────────────────────────────────────────────

/**
 * Normalise raw scores across a universe of rows into a [0, 1] score using
 * z-score → sigmoid clamping. Mutates the `score` field in-place.
 */
export function normaliseScores(rows: EmaRankingRow[]): void {
  if (rows.length === 0) return
  const vals = rows.map(r => r.rawScore)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  const std = Math.sqrt(variance) || 1
  for (const row of rows) {
    const z = (row.rawScore - mean) / std
    // Sigmoid: maps z ∈ [-∞,+∞] to (0,1); z=2 → 0.88, z=-2 → 0.12
    row.score = 1 / (1 + Math.exp(-z))
  }
}
