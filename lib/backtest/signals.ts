/**
 * Backtest signal generators — shared across API routes and scripts.
 * Mirrors lib/quant/technicals.ts but produces named signal objects for backtesting.
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

export function macdFn(closes: number[], fast = 12, slow = 26, signal = 9): {
  line: number[]; signal: number[]; histogram: number[]
} {
  const outLine: number[] = new Array(closes.length).fill(NaN)
  const outSig: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < slow) return { line: outLine, signal: outSig, histogram: new Array(closes.length).fill(NaN) }
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  for (let i = 0; i < closes.length; i++) outLine[i] = emaFast[i] - emaSlow[i]
  const validLine = outLine.slice(slow - 1)
  const sigEma = ema(validLine, signal)
  for (let i = 0; i < sigEma.length; i++) outSig[i + slow - 1] = sigEma[i]
  const outHist = outLine.map((l, i) => {
    const s = outSig[i]
    if (!Number.isFinite(l) || !Number.isFinite(s)) return NaN
    return l - s
  })
  return { line: outLine, signal: outSig, histogram: outHist }
}

export function atr(bars: OhlcBar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN)
  if (bars.length < period + 1) return out
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
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

export function sma200DeviationPct(price: number, sma200: number): number | null {
  if (!Number.isFinite(sma200) || sma200 <= 0 || !Number.isFinite(price)) return null
  return ((price - sma200) / sma200) * 100
}

export function sma200Slope(closes: number[]): number | null {
  if (closes.length < 221) return null
  const now = sma(closes, 200)
  const prev = sma(closes.slice(0, closes.length - 20), 200)
  if (now == null || prev == null || prev === 0) return null
  return (now - prev) / prev
}

// ─── Regime classifier ─────────────────────────────────────────────────────────

export type DipSignal =
  | 'STRONG_DIP' | 'WATCH_DIP' | 'FALLING_KNIFE'
  | 'OVERBOUGHT' | 'IN_TREND' | 'INSUFFICIENT_DATA'

export interface RegimeSignal {
  zone: string
  dipSignal: DipSignal
  deviationPct: number | null
  slopePct: number | null
  slopePositive: boolean | null
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number
  label: string
}

export function regimeSignal(price: number, closes: number[], rsi14?: number): RegimeSignal {
  if (closes.length < 200) {
    return {
      zone: 'INSUFFICIENT_DATA', dipSignal: 'INSUFFICIENT_DATA',
      deviationPct: null, slopePct: null, slopePositive: null,
      action: 'HOLD', confidence: 0, label: 'Insufficient Data',
    }
  }
  const s200 = sma(closes, 200)
  if (!s200) return { zone: 'INSUFFICIENT_DATA', dipSignal: 'INSUFFICIENT_DATA', deviationPct: null, slopePct: null, slopePositive: null, action: 'HOLD', confidence: 0, label: 'Insufficient Data' }
  const dev = sma200DeviationPct(price, s200)
  const slope = sma200Slope(closes)
  const slopePos = slope != null ? slope > 0 : null

  let zone: string, action: 'BUY' | 'HOLD' | 'SELL', confidence: number, dipSignal: DipSignal
  if (dev != null && dev > 20)       { zone = 'EXTREME_BULL'; action = 'HOLD'; confidence = 40; dipSignal = 'OVERBOUGHT' }
  else if (dev != null && dev > 10) { zone = 'EXTENDED_BULL'; action = 'HOLD'; confidence = 45; dipSignal = 'OVERBOUGHT' }
  else if (dev != null && dev >= 0) { zone = 'HEALTHY_BULL'; action = 'HOLD'; confidence = 55; dipSignal = 'IN_TREND' }
  else if (dev != null && dev >= -10) {
    if (slopePos === true) { zone = 'FIRST_DIP'; action = 'BUY'; confidence = rsi14 != null && rsi14 < 35 ? 88 : 72; dipSignal = 'STRONG_DIP' }
    else                   { zone = 'FIRST_DIP'; action = 'HOLD'; confidence = 45; dipSignal = 'WATCH_DIP' }
  } else if (dev != null && dev >= -20) {
    if (slopePos === true) { zone = 'DEEP_DIP'; action = 'HOLD'; confidence = 55; dipSignal = 'WATCH_DIP' }
    else                   { zone = 'DEEP_DIP'; action = 'SELL'; confidence = 80; dipSignal = 'FALLING_KNIFE' }
  } else if (dev != null && dev >= -30) {
    if (slopePos === true) { zone = 'BEAR_ALERT'; action = 'HOLD'; confidence = 50; dipSignal = 'WATCH_DIP' }
    else                   { zone = 'BEAR_ALERT'; action = 'SELL'; confidence = 85; dipSignal = 'FALLING_KNIFE' }
  } else {
    if (slopePos === true) { zone = 'CRASH_ZONE'; action = 'BUY'; confidence = 78; dipSignal = 'STRONG_DIP' }
    else                   { zone = 'CRASH_ZONE'; action = 'SELL'; confidence = 92; dipSignal = 'FALLING_KNIFE' }
  }

  return { zone: zone ?? 'INSUFFICIENT_DATA', dipSignal: dipSignal ?? 'INSUFFICIENT_DATA', deviationPct: dev, slopePct: slope, slopePositive: slopePos, action, confidence, label: zone ?? 'Insufficient Data' }
}

// ─── Combined signal ───────────────────────────────────────────────────────────

export interface BacktestConfig {
  initialCapital: number
  stopLossPct: number
  confidenceThreshold: number
  maxDrawdownCap: number
  halfKelly: boolean
}

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 100_000,
  stopLossPct: 0.10,
  confidenceThreshold: 60,
  maxDrawdownCap: 0.25,
  halfKelly: true,
}

export interface ConfirmSignal {
  name: string
  value: number | null
  bullish: boolean
}

export interface CombinedSignal {
  ticker: string
  date: string
  price: number
  regime: RegimeSignal
  confirms: ConfirmSignal[]
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number
  KellyFraction: number
  reason: string
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

  const rsiVals = rsi(closes)
  const macdVals = macdFn(closes)
  const atrVals = atr(bars)
  const bbVals = bollinger(closes)
  const rsi14 = rsiVals[rsiVals.length - 1]
  const macdHist = macdVals.histogram[macdVals.histogram.length - 1]
  const atrLast = atrVals[atrVals.length - 1]
  const bbPctB = bbVals.pctB[bbVals.pctB.length - 1]

  const regime = regimeSignal(price, closes, rsi14)

  const bullishCount =
    (Number.isFinite(rsi14) && rsi14 < 40 ? 1 : 0) +
    (Number.isFinite(macdHist) && macdHist > 0 ? 1 : 0) +
    (Number.isFinite(bbPctB) && bbPctB < 0.20 ? 1 : 0) +
    (Number.isFinite(atrLast) && atrLast < 60 ? 1 : 0)

  let action: 'BUY' | 'HOLD' | 'SELL' = regime.action
  const confidence = Math.min(100, regime.confidence + Math.round((bullishCount / 4) * 20))
  if (confidence < cfg.confidenceThreshold && action !== 'SELL') action = 'HOLD'

  let kellyFrac = 0.10
  if (action === 'BUY' && regime.dipSignal === 'STRONG_DIP') kellyFrac = cfg.halfKelly ? 0.25 : 0.50
  else if (action === 'BUY' && bullishCount >= 2) kellyFrac = cfg.halfKelly ? 0.15 : 0.30
  else if (action === 'SELL') kellyFrac = 1.0

  const reason = action === 'BUY'
    ? `${regime.dipSignal}: ${regime.label}. ${bullishCount} bullish confirmations. Kelly ${(kellyFrac * 100).toFixed(0)}%.`
    : action === 'SELL' ? `${regime.dipSignal}: ${regime.label}. Exiting.` : `${regime.label}. Confidence ${confidence}% below threshold. Hold.`

  return {
    ticker, date, price, regime,
    confirms: [
      { name: 'RSI', value: Number.isFinite(rsi14) ? rsi14 : null, bullish: Number.isFinite(rsi14) && rsi14 < 40 },
      { name: 'MACD', value: Number.isFinite(macdHist) ? macdHist : null, bullish: Number.isFinite(macdHist) && macdHist > 0 },
      { name: 'ATR', value: Number.isFinite(atrLast) ? atrLast : null, bullish: Number.isFinite(atrLast) && atrLast < 60 },
      { name: 'BB%', value: Number.isFinite(bbPctB) ? bbPctB : null, bullish: Number.isFinite(bbPctB) && bbPctB < 0.20 },
    ],
    action, confidence, KellyFraction: kellyFrac, reason,
  }
}
