/**
 * Backtest signal generators.
 * Pure functions — no side effects, no API calls.
 * All math mirrors lib/quant/technicals.ts and lib/crypto.ts.
 */

import type { OhlcBar } from '@/lib/quant/technicals'

// ─── Core math helpers ───────────────────────────────────────────────────────

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  return values.slice(-period).reduce((a, b) => a + b, 0) / period
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  if (values.length === 0) return out
  let prev = values[0]
  out.push(prev)
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

/** Wilder RSI (14). */
export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return out
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) avgGain += d; else avgLoss -= d
  }
  avgGain /= period; avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

/** EMA-based MACD. */
export function macd(closes: number[], fast = 12, slow = 26, signal = 9): {
  line: number[]; signal: number[]; histogram: number[]
} {
  const outLine: number[] = new Array(closes.length).fill(NaN)
  const outSig: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < slow) return { line: outLine, signal: outSig, histogram: new Array(closes.length).fill(NaN) }
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  for (let i = 0; i < closes.length; i++) {
    outLine[i] = emaFast[i] - emaSlow[i]
  }
  // Signal EMA on the MACD line
  const validLine = outLine.slice(slow - 1)
  const sigEma = ema(validLine, signal)
  for (let i = 0; i < sigEma.length; i++) {
    const idx = i + slow - 1
    outSig[idx] = sigEma[i]
  }
  const outHist = outLine.map((l, i) => {
    const s = outSig[i]
    if (!Number.isFinite(l) || !Number.isFinite(s)) return NaN
    return l - s
  })
  return { line: outLine, signal: outSig, histogram: outHist }
}

/** Wilder ATR. */
export function atr(bars: OhlcBar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN)
  if (bars.length < period + 1) return out
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ))
  }
  let avg = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period] = avg
  for (let i = period; i < trs.length; i++) {
    avg = (avg * (period - 1) + trs[i]) / period
    out[i + 1] = avg
  }
  return out
}

/** Bollinger Bands. */
export function bollinger(closes: number[], period = 20, mult = 2): {
  mid: number[]; upper: number[]; lower: number[]; pctB: number[]
} {
  const mid: number[] = new Array(closes.length).fill(NaN)
  const upper: number[] = new Array(closes.length).fill(NaN)
  const lower: number[] = new Array(closes.length).fill(NaN)
  const pctB: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period) return { mid, upper, lower, pctB }
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const m = slice.reduce((a, b) => a + b, 0) / period
    const sd = Math.sqrt(slice.reduce((s, x) => s + (x - m) ** 2, 0) / (period - 1))
    mid[i] = m; upper[i] = m + mult * sd; lower[i] = m - mult * sd
    if (upper[i] !== lower[i]) pctB[i] = (closes[i] - lower[i]) / (upper[i] - lower[i])
  }
  return { mid, upper, lower, pctB }
}

/** 200-day SMA deviation %. */
export function sma200DeviationPct(price: number, sma200: number): number | null {
  if (!Number.isFinite(sma200) || sma200 <= 0 || !Number.isFinite(price)) return null
  return ((price - sma200) / sma200) * 100
}

/** 200-day SMA slope: positive = rising, negative = declining. */
export function sma200Slope(closes: number[]): number | null {
  if (closes.length < 221) return null
  const now = sma(closes, 200)
  const prev = sma(closes.slice(0, closes.length - 20), 200)
  if (now == null || prev == null || prev === 0) return null
  return (now - prev) / prev
}

// ─── Regime signal ─────────────────────────────────────────────────────────────

export type MA200Zone =
  | 'EXTREME_BULL' | 'EXTENDED_BULL' | 'HEALTHY_BULL'
  | 'FIRST_DIP' | 'DEEP_DIP' | 'BEAR_ALERT' | 'CRASH_ZONE'
  | 'INSUFFICIENT_DATA'

export type DipSignal =
  | 'STRONG_DIP'   // high-conviction buy zone
  | 'WATCH_DIP'    // watch — not high conviction
  | 'FALLING_KNIFE' // avoid long
  | 'OVERBOUGHT'   // extended — don't chase
  | 'IN_TREND'     // hold in healthy bull
  | 'INSUFFICIENT_DATA'

export interface RegimeSignal {
  zone: MA200Zone
  dipSignal: DipSignal
  deviationPct: number | null
  slopePct: number | null
  slopePositive: boolean | null
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number   // 0-100
  label: string
}

export interface ConfirmSignal {
  name: string
  value: number | null
  label: string
  bullish: boolean   // true = confirms BUY, false = confirms SELL or neutral
}

export interface CombinedSignal {
  ticker: string
  date: string       // ISO date string
  price: number
  regime: RegimeSignal
  confirms: ConfirmSignal[]
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number  // 0-100, weighted average
 KellyFraction: number  // 0-1, fraction of portfolio
  reason: string     // human-readable reason
}

/**
 * Primary regime classifier — mirrors ma200Regime() from lib/quant/technicals.ts.
 */
export function regimeSignal(price: number, closes: number[], rsi14?: number): RegimeSignal {
  if (closes.length < 200) {
    return {
      zone: 'INSUFFICIENT_DATA', dipSignal: 'INSUFFICIENT_DATA',
      deviationPct: null, slopePct: null, slopePositive: null,
      action: 'HOLD', confidence: 0, label: 'Insufficient Data',
    }
  }

  const sma200 = sma(closes, 200)
  if (sma200 == null) return { zone: 'INSUFFICIENT_DATA', dipSignal: 'INSUFFICIENT_DATA', deviationPct: null, slopePct: null, slopePositive: null, action: 'HOLD', confidence: 0, label: 'Insufficient Data' }

  const dev = sma200DeviationPct(price, sma200)
  const slope = sma200Slope(closes)
  const slopePositive = slope != null ? slope > 0 : null

  let zone: MA200Zone
  if (dev != null) {
    if (dev > 20) zone = 'EXTREME_BULL'
    else if (dev > 10) zone = 'EXTENDED_BULL'
    else if (dev >= 0) zone = 'HEALTHY_BULL'
    else if (dev >= -10) zone = 'FIRST_DIP'
    else if (dev >= -20) zone = 'DEEP_DIP'
    else if (dev >= -30) zone = 'BEAR_ALERT'
    else zone = 'CRASH_ZONE'
  } else {
    zone = 'INSUFFICIENT_DATA'
  }

  let dipSignal: DipSignal
  let action: 'BUY' | 'HOLD' | 'SELL'
  let confidence = 50

  if (zone === 'EXTREME_BULL' || zone === 'EXTENDED_BULL') {
    dipSignal = 'OVERBOUGHT'; action = 'HOLD'; confidence = 40
  } else if (zone === 'HEALTHY_BULL') {
    dipSignal = 'IN_TREND'; action = 'HOLD'; confidence = 55
  } else if (zone === 'FIRST_DIP') {
    if (slopePositive === true) {
      dipSignal = 'STRONG_DIP'
      action = 'BUY'
      confidence = rsi14 != null && rsi14 < 35 ? 88 : 72
    } else {
      dipSignal = 'WATCH_DIP'; action = 'HOLD'; confidence = 45
    }
  } else if (zone === 'DEEP_DIP') {
    if (slopePositive === true) {
      dipSignal = 'WATCH_DIP'; action = 'HOLD'; confidence = 55
    } else {
      dipSignal = 'FALLING_KNIFE'; action = 'SELL'; confidence = 80
    }
  } else if (zone === 'BEAR_ALERT') {
    if (slopePositive === true) {
      dipSignal = 'WATCH_DIP'; action = 'HOLD'; confidence = 50
    } else {
      dipSignal = 'FALLING_KNIFE'; action = 'SELL'; confidence = 85
    }
  } else if (zone === 'CRASH_ZONE') {
    if (slopePositive === true) {
      dipSignal = 'STRONG_DIP'; action = 'BUY'; confidence = 78
    } else {
      dipSignal = 'FALLING_KNIFE'; action = 'SELL'; confidence = 92
    }
  } else {
    dipSignal = 'INSUFFICIENT_DATA'; action = 'HOLD'; confidence = 0
  }

  return { zone, dipSignal, deviationPct: dev, slopePct: slope, slopePositive, action, confidence, label: zone }
}

/**
 * RSI(14) confirmation signal.
 */
export function rsiSignal(rsiVals: number[]): ConfirmSignal {
  const last = rsiVals[rsiVals.length - 1]
  if (!Number.isFinite(last)) return { name: 'RSI(14)', value: null, label: '—', bullish: false }
  let bullish: boolean
  let label: string
  if (last > 70) { bullish = false; label = 'Overbought (OB)' }
  else if (last < 30) { bullish = true; label = 'Oversold (OS)' }
  else if (last > 60) { bullish = true; label = 'Bullish zone' }
  else if (last < 40) { bullish = false; label = 'Bearish zone' }
  else { bullish = false; label = 'Neutral zone' }
  return { name: 'RSI(14)', value: last, label: `${label} ${last.toFixed(1)}`, bullish }
}

/**
 * MACD histogram confirmation signal.
 */
export function macdSignal(macdVals: ReturnType<typeof macd>): ConfirmSignal {
  const hist = macdVals.histogram[macdVals.histogram.length - 1]
  if (!Number.isFinite(hist)) return { name: 'MACD Hist', value: null, label: '—', bullish: false }
  const bullish = hist > 0
  return { name: 'MACD Hist', value: hist, label: `${hist >= 0 ? '+' : ''}${hist.toFixed(4)} (${bullish ? 'Bullish' : 'Bearish'})`, bullish }
}

/**
 * ATR percentile — 20-bar lookback vs current ATR.
 * High ATR percentile = high volatility environment → reduce Kelly fraction.
 */
export function atrSignal(atrVals: number[]): ConfirmSignal {
  const last = atrVals[atrVals.length - 1]
  if (!Number.isFinite(last)) return { name: 'ATR(14)', value: null, label: '—', bullish: false }
  const valid = atrVals.filter(Number.isFinite)
  if (valid.length < 10) return { name: 'ATR(14)', value: last, label: `${last.toFixed(2)} (insufficient history)`, bullish: false }
  const max = Math.max(...valid)
  const pct = max > 0 ? (last / max) * 100 : 50
  // High ATR percentile = high volatility = reduce Kelly
  const bullish = pct < 70  // not overly volatile
  return { name: 'ATR(14)', value: last, label: `${last.toFixed(2)} (${pct.toFixed(0)}% percentile)`, bullish }
}

/**
 * Bollinger %B position confirmation.
 */
export function bbSignal(bbPctB: number[]): ConfirmSignal {
  const last = bbPctB[bbPctB.length - 1]
  if (!Number.isFinite(last)) return { name: 'BB %B', value: null, label: '—', bullish: false }
  let bullish: boolean
  let label: string
  if (last < 0.20) { bullish = true; label = 'Near lower band (OS)' }
  else if (last > 0.80) { bullish = false; label = 'Near upper band (OB)' }
  else { bullish = false; label = 'Mid-band' }
  return { name: 'BB %B', value: last, label: `${last.toFixed(2)} (${label})`, bullish }
}

/**
 * Compute Kelly fraction for a given win rate, avg win, avg loss.
 * Returns null if insufficient data.
 */
export function kellyFraction(winRate: number, avgWin: number, avgLoss: number): number | null {
  if (winRate <= 0 || winRate >= 1 || avgWin <= 0 || avgLoss <= 0) return null
  const p = winRate, q = 1 - p, b = avgWin / avgLoss
  const kelly = (b * p - q) / b
  return Math.max(0, Math.min(1, kelly))
}

/**
 * Half-Kelly fraction for conservative sizing.
 */
export function halfKelly(winRate: number, avgWin: number, avgLoss: number): number | null {
  const f = kellyFraction(winRate, avgWin, avgLoss)
  return f != null ? f * 0.5 : null
}

// ─── Combined signal ───────────────────────────────────────────────────────────

export interface BacktestConfig {
  initialCapital: number
  stopLossPct: number       // e.g. 0.10 = 10% stop loss
  confidenceThreshold: number // minimum confidence to act (0-100)
  maxDrawdownCap: number    // portfolio-level stop (e.g. 0.25 = 25%)
  halfKelly: boolean        // use half-Kelly vs full Kelly
}

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 100_000,
  stopLossPct: 0.10,
  confidenceThreshold: 60,
  maxDrawdownCap: 0.25,
  halfKelly: true,
}

export function combinedSignal(
  ticker: string,
  date: string,
  price: number,
  closes: number[],
  bars: OhlcBar[],
  config: Partial<BacktestConfig> = {},
): CombinedSignal {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const closes20 = closes.slice(-20)
  const rsiVals = rsi(closes)
  const macdVals = macd(closes)
  const atrVals = atr(bars)
  const bbVals = bollinger(closes)
  const rsi14 = rsiVals[rsiVals.length - 1]

  const regime = regimeSignal(price, closes, rsi14)
  const rsiConfirm = rsiSignal(rsiVals)
  const macdConfirm = macdSignal(macdVals)
  const atrConfirm = atrSignal(atrVals)
  const bbConfirm = bbSignal(bbVals.pctB)

  const confirms = [rsiConfirm, macdConfirm, atrConfirm, bbConfirm]

  // Count bullish confirmations
  const bullishCount = confirms.filter(c => c.bullish).length
  const confidenceBoost = Math.round((bullishCount / confirms.length) * 20) // +0 to +20

  let action: 'BUY' | 'HOLD' | 'SELL' = regime.action
  let confidence = regime.confidence

  // Boost confidence when multiple confirmations agree
  confidence = Math.min(100, confidence + confidenceBoost)

  // Override to HOLD if confidence below threshold
  if (confidence < cfg.confidenceThreshold && action !== 'SELL') {
    action = 'HOLD'
  }

  // Compute Kelly fraction for BUY signals
  let kellyFrac = 0.10  // default conservative 10%
  if (action === 'BUY' && regime.dipSignal === 'STRONG_DIP') {
    // STRONG_DIP with all confirmations = max conviction
    kellyFrac = cfg.halfKelly ? 0.25 : 0.50
  } else if (action === 'BUY' && bullishCount >= 3) {
    kellyFrac = cfg.halfKelly ? 0.15 : 0.30
  } else if (action === 'BUY') {
    kellyFrac = cfg.halfKelly ? 0.10 : 0.20
  } else if (action === 'SELL') {
    kellyFrac = 1.0  // close full position
  }

  // Build reason string
  const confirmLabels = confirms.filter(c => c.bullish).map(c => c.name).join(', ')
  const reason = action === 'BUY'
    ? `${regime.dipSignal}: ${regime.label}. Confirmations: ${confirmLabels || 'none'}. Confidence ${confidence}%. Kelly ${(kellyFrac * 100).toFixed(0)}%.`
    : action === 'SELL'
    ? `${regime.dipSignal}: ${regime.label}. Exiting position.`
    : `${regime.label}. Confidence ${confidence}% below threshold (${cfg.confidenceThreshold}%). Hold.`

  return {
    ticker, date, price, regime, confirms, action, confidence,
    KellyFraction: kellyFrac, reason,
  }
}
