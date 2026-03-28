/** Price-based indicators from OHLC series (oldest → newest). */

export interface OhlcBar {
  open: number
  high: number
  low: number
  close: number
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  const s = slice.reduce((a, b) => a + b, 0)
  return s / period
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
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1]
    if (ch >= 0) gain += ch
    else loss -= ch
  }
  gain /= period
  loss /= period
  if (loss === 0) return 100
  const rs = gain / loss
  return 100 - 100 / (1 + rs)
}

export function macd(closes: number[]): {
  line: number | null
  signal: number | null
  histogram: number | null
} {
  if (closes.length < 35) return { line: null, signal: null, histogram: null }
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const lineSeries: number[] = []
  for (let i = 0; i < closes.length; i++) {
    lineSeries.push(ema12[i] - ema26[i])
  }
  const signalSeries = ema(lineSeries, 9)
  const i = closes.length - 1
  const line = lineSeries[i]
  const signal = signalSeries[i]
  if (line == null || signal == null) return { line: null, signal: null, histogram: null }
  return { line, signal, histogram: line - signal }
}

export function bollinger(closes: number[], period = 20, mult = 2): {
  mid: number | null
  upper: number | null
  lower: number | null
  pctB: number | null
} {
  if (closes.length < period) return { mid: null, upper: null, lower: null, pctB: null }
  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const varSample =
    slice.reduce((s, x) => s + (x - mid) * (x - mid), 0) / Math.max(1, period - 1)
  const sd = Math.sqrt(Math.max(varSample, 0))
  const upper = mid + mult * sd
  const lower = mid - mult * sd
  const last = closes[closes.length - 1]
  const pctB = upper !== lower ? (last - lower) / (upper - lower) : null
  return { mid, upper, lower, pctB }
}

/** Wilder ATR. */
export function atr(bars: OhlcBar[], period = 14): number | null {
  if (bars.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high
    const l = bars[i].low
    const pc = bars[i - 1].close
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  let sum = 0
  for (let i = 0; i < period; i++) sum += trs[trs.length - period + i]
  return sum / period
}

export function maxDrawdown(closes: number[]): { maxDd: number; maxDdPct: number } | null {
  if (closes.length < 2) return null
  let peak = closes[0]
  let maxDd = 0
  for (const c of closes) {
    if (c > peak) peak = c
    const dd = peak - c
    if (dd > maxDd) maxDd = dd
  }
  const maxDdPct = peak > 0 ? maxDd / peak : 0
  return { maxDd, maxDdPct }
}

export function dailyReturns(closes: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) r.push(closes[i] / closes[i - 1] - 1)
  }
  return r
}

/** Sample Sharpe (daily), annualized; rf annual default 4%. */
export function sharpeRatio(dailyReturns: number[], rfAnnual = 0.04): number | null {
  if (dailyReturns.length < 20) return null
  const rfD = rfAnnual / 252
  const excess = dailyReturns.map((x) => x - rfD)
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length
  const v =
    excess.reduce((s, x) => s + (x - mean) * (x - mean), 0) / Math.max(1, excess.length - 1)
  const sd = Math.sqrt(Math.max(v, 0))
  if (sd === 0) return null
  return (mean / sd) * Math.sqrt(252)
}

/** Sortino using downside deviation vs 0. */
export function sortinoRatio(dailyReturns: number[], marDaily = 0): number | null {
  if (dailyReturns.length < 20) return null
  const downsideSq = dailyReturns
    .map((x) => Math.min(0, x - marDaily))
    .map((x) => x * x)
  const neg = dailyReturns.map((x) => x - marDaily).filter((x) => x < 0)
  if (neg.length === 0) return null
  const d = Math.sqrt(downsideSq.reduce((s, x) => s + x, 0) / neg.length)
  if (d === 0) return null
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  return (mean / d) * Math.sqrt(252)
}

export function trendLabel(sma50: number | null, sma200: number | null, price: number): string {
  if (sma50 == null || sma200 == null) return 'Insufficient history'
  if (price > sma50 && sma50 > sma200) return 'Price > SMA50 > SMA200 (bullish stack)'
  if (price < sma50 && sma50 < sma200) return 'Price < SMA50 < SMA200 (bearish stack)'
  if (sma50 > sma200) return 'Golden cross zone (SMA50 above SMA200)'
  return 'Death cross zone (SMA50 below SMA200)'
}
