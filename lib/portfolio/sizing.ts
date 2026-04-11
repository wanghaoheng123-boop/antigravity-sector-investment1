/**
 * Position sizing library — Kelly criterion + portfolio-level constraints.
 *
 * Provides:
 *   - Kelly fraction from win/loss statistics (full-Kelly and half-Kelly)
 *   - Volatility-adjusted Kelly (scales fraction by target daily vol)
 *   - Portfolio-level max concentration guard (no single position > maxPct)
 *   - Dollar-value sizing given portfolio equity and price
 *
 * DISCLAIMER: Kelly is a mathematical sizing model. In practice always use
 * half-Kelly or less — full Kelly requires exact edge estimates that are
 * never available in real markets. Never risk more than 2% per trade on
 * discretionary accounts.
 *
 * Reference: Kelly, J.L. (1956). "A New Interpretation of Information Rate".
 */

import { kellyFraction, halfKelly } from '@/lib/quant/kelly'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface TradeStats {
  /** Win probability (0–1). Estimated from historical trades. */
  winRate: number
  /** Average winning trade return (positive decimal, e.g. 0.05 = 5%). */
  avgWin: number
  /** Average losing trade return (positive decimal, e.g. 0.03 = 3%). */
  avgLoss: number
  /** Number of completed trades used for estimation (affects confidence). */
  sampleSize: number
}

export interface SizingResult {
  /** Full-Kelly fraction (often too aggressive — shown for reference only). */
  fullKellyFraction: number | null
  /** Half-Kelly fraction (recommended for real capital). */
  halfKellyFraction: number | null
  /** Conservative Kelly (quarter Kelly — suitable for high-uncertainty edge). */
  quarterKellyFraction: number | null
  /** Recommended fraction after applying portfolio constraints. */
  recommendedFraction: number
  /** Dollar amount to deploy given portfolioEquity. */
  recommendedDollar: number
  /** Maximum shares at given price. */
  recommendedShares: number
  /** Confidence grade based on sample size. */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
  /** Human-readable sizing rationale. */
  rationale: string
}

export interface SizingConfig {
  /** Absolute maximum position size as a fraction of equity (default: 0.20 = 20%). */
  maxPositionPct?: number
  /** Maximum number of simultaneous positions (default: 10). */
  maxPositions?: number
  /** Override fraction regardless of Kelly (useful for fixed-risk sizing). */
  fixedRiskPct?: number
  /** Target daily portfolio volatility for volatility scaling (default: none). */
  targetDailyVol?: number
  /** Annualized vol of the instrument (for vol scaling, optional). */
  instrumentAnnualVol?: number
}

// ────────────────────────────────────────────────────────────────
// Confidence bands
// ────────────────────────────────────────────────────────────────

function sampleConfidence(n: number): SizingResult['confidence'] {
  if (n < 10)  return 'INSUFFICIENT'
  if (n < 30)  return 'LOW'
  if (n < 100) return 'MEDIUM'
  return 'HIGH'
}

// ────────────────────────────────────────────────────────────────
// Volatility scaling
// ────────────────────────────────────────────────────────────────

/**
 * Scale a Kelly fraction by the ratio of target daily vol to instrument daily vol.
 * Prevents over-sizing into high-vol instruments.
 *
 * @param kellyFrac     Raw Kelly fraction
 * @param targetDailyVol  e.g. 0.01 = target 1% daily portfolio vol
 * @param instrumentAnnualVol  e.g. 0.30 = 30% annual vol
 */
function volScaleFraction(
  kellyFrac: number,
  targetDailyVol: number,
  instrumentAnnualVol: number,
): number {
  const instrumentDailyVol = instrumentAnnualVol / Math.sqrt(252)
  if (instrumentDailyVol < 1e-6) return kellyFrac
  const scalingFactor = targetDailyVol / instrumentDailyVol
  return kellyFrac * scalingFactor
}

// ────────────────────────────────────────────────────────────────
// Main sizing engine
// ────────────────────────────────────────────────────────────────

/**
 * Compute recommended position size for a new trade.
 *
 * @param stats          Trade statistics (win rate, avg win/loss, sample size)
 * @param portfolioEquity  Total portfolio equity in USD
 * @param entryPrice     Instrument price at intended entry
 * @param config         Portfolio constraints and sizing parameters
 */
export function computePositionSize(
  stats: TradeStats,
  portfolioEquity: number,
  entryPrice: number,
  config: SizingConfig = {},
): SizingResult {
  const {
    maxPositionPct = 0.20,
    maxPositions   = 10,
    fixedRiskPct,
    targetDailyVol,
    instrumentAnnualVol,
  } = config

  const confidence = sampleConfidence(stats.sampleSize)

  // ── Full & half Kelly ──────────────────────────────────────────
  const fullKelly    = kellyFraction(stats.winRate, stats.avgWin, stats.avgLoss)
  const halfKellyVal = halfKelly(stats.winRate, stats.avgWin, stats.avgLoss)
  const quarterKelly = fullKelly != null ? Math.max(0, fullKelly / 4) : null

  // ── Apply portfolio constraints ────────────────────────────────
  // 1. Start from half-Kelly (or fixed risk if override supplied)
  let baseFraction = fixedRiskPct ?? halfKellyVal ?? 0

  // 2. Apply volatility scaling if requested
  if (targetDailyVol != null && instrumentAnnualVol != null && baseFraction > 0) {
    baseFraction = volScaleFraction(baseFraction, targetDailyVol, instrumentAnnualVol)
  }

  // 3. Max concentration guard
  baseFraction = Math.min(baseFraction, maxPositionPct)

  // 4. Diversification cap: if we already hold maxPositions, each position
  //    should be at most 1/maxPositions of equity (rough guideline)
  const divCap = 1 / Math.max(maxPositions, 1)
  baseFraction = Math.min(baseFraction, divCap * 2)  // allow 2x the div cap as max single position

  // 5. For insufficient or low-confidence estimates, further reduce
  if (confidence === 'INSUFFICIENT') baseFraction = 0
  else if (confidence === 'LOW')     baseFraction = Math.min(baseFraction, 0.02)  // max 2%

  // 6. Floor at 0
  baseFraction = Math.max(0, baseFraction)

  const recommendedDollar = portfolioEquity * baseFraction
  const recommendedShares = entryPrice > 0
    ? Math.floor(recommendedDollar / entryPrice)
    : 0

  // ── Build rationale ────────────────────────────────────────────
  let rationale: string
  if (confidence === 'INSUFFICIENT') {
    rationale = `Only ${stats.sampleSize} trades — need ≥10 for any sizing. Use fixed 1% risk until sufficient history accumulates.`
  } else if (fullKelly != null && fullKelly <= 0) {
    rationale = `Negative edge detected (winRate=${(stats.winRate * 100).toFixed(1)}%, R:R=${(stats.avgWin / stats.avgLoss).toFixed(2)}). Do not enter — Kelly says stay flat.`
  } else {
    const kellyStr = halfKellyVal != null ? `${(halfKellyVal * 100).toFixed(1)}%` : 'N/A'
    const applied  = `${(baseFraction * 100).toFixed(1)}%`
    rationale = `Half-Kelly: ${kellyStr} → constrained to ${applied} of equity ($${recommendedDollar.toFixed(0)}). Confidence: ${confidence} (${stats.sampleSize} trades).`
    if (confidence === 'LOW') rationale += ' Capped at 2% due to low sample.'
  }

  return {
    fullKellyFraction:    fullKelly,
    halfKellyFraction:    halfKellyVal,
    quarterKellyFraction: quarterKelly,
    recommendedFraction:  baseFraction,
    recommendedDollar,
    recommendedShares,
    confidence,
    rationale,
  }
}

/**
 * Derive TradeStats from a portfolio's closed trade history for a specific ticker.
 * Returns null if insufficient data.
 */
export function tradeStatsFromHistory(
  trades: Array<{ ticker: string; action: 'BUY' | 'SELL'; pnlPct?: number }>,
  ticker?: string,
): TradeStats | null {
  const sells = trades.filter(
    (t) => t.action === 'SELL' && t.pnlPct != null && (ticker == null || t.ticker === ticker)
  )
  if (sells.length < 3) return null

  const pnls = sells.map((t) => t.pnlPct!)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)

  return {
    winRate:    wins.length / pnls.length,
    avgWin:     wins.length  > 0 ? wins.reduce((s, x) => s + x, 0)         / wins.length   : 0,
    avgLoss:    losses.length > 0 ? losses.reduce((s, x) => s + Math.abs(x), 0) / losses.length : 0,
    sampleSize: pnls.length,
  }
}

/**
 * Fixed-fraction fallback: risk a fixed % of equity per trade.
 * Simpler than Kelly but more stable for small sample sizes.
 *
 * @param riskPct     Fraction of equity to risk (e.g. 0.01 = 1%)
 * @param stopLossPct  Distance from entry to stop-loss (e.g. 0.05 = 5% below entry)
 */
export function fixedFractionSize(
  portfolioEquity: number,
  entryPrice: number,
  riskPct = 0.01,
  stopLossPct = 0.05,
): { dollarRisk: number; shares: number; positionValue: number } {
  const dollarRisk = portfolioEquity * riskPct
  // Position size: risk / stop distance
  const shares = stopLossPct > 0
    ? Math.floor(dollarRisk / (entryPrice * stopLossPct))
    : 0
  return {
    dollarRisk,
    shares,
    positionValue: shares * entryPrice,
  }
}
