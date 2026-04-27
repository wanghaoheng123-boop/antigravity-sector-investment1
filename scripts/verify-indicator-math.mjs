/**
 * Golden tests for lib/crypto.ts indicator math (duplicated here so Node runs without TS).
 * Run: node scripts/verify-indicator-math.mjs
 */

function calcRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(NaN)
  if (prices.length < period + 1) return rsi
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return rsi
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1)
  const ema = new Array(prices.length).fill(NaN)
  if (prices.length < period) return ema
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema[period - 1] = prev
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    ema[i] = prev
  }
  return ema
}

function calcMACD(prices, fast = 12, slow = 26, signal = 9) {
  const result = new Array(prices.length).fill(null).map(() => ({ macd: NaN, signal: NaN, histogram: NaN }))
  if (prices.length < slow) return result
  const fastEma = calcEMA(prices, fast)
  const slowEma = calcEMA(prices, slow)
  for (let i = slow - 1; i < prices.length; i++) {
    const macd = fastEma[i] - slowEma[i]
    result[i] = { macd, signal: NaN, histogram: NaN }
  }
  const validMacd = result.map((r) => r.macd).slice(slow - 1)
  const signalEma = calcEMA(validMacd, signal)
  for (let i = 0; i < signalEma.length; i++) {
    const idx = i + slow - 1
    const m = result[idx].macd
    const s = signalEma[i]
    result[idx] = { macd: m, signal: s, histogram: !Number.isNaN(m) && !Number.isNaN(s) ? m - s : NaN }
  }
  return result
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
}

function approx(a, b, eps = 1e-6, msg) {
  assert(Math.abs(a - b) < eps, msg || `${a} ≈ ${b}`)
}

console.log('EMA (period 3) — manual SMA seed then one step')
const p3 = [10, 11, 12, 13]
const em3 = calcEMA(p3, 3)
// SMA of first 3 = 11 at index 2; EMA at index 3 = 12*k + 11*(1-k), k=0.5
const k = 2 / 4
approx(em3[2], 11, 1e-9, 'EMA[2] = SMA(10,11,12)')
approx(em3[3], 13 * k + 11 * (1 - k), 1e-9, 'EMA[3] step from seed')

console.log('\nRSI — flat series (no change) → 100 when avgLoss=0')
const flat = Array.from({ length: 20 }, () => 100)
const rsiFlat = calcRSI(flat, 14)
assert(rsiFlat[14] === 100, 'unchanging price → RSI 100')

console.log('\nRSI — monotonic up → high RSI')
const up = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)
const rsiUp = calcRSI(up, 14)
assert(rsiUp[rsiUp.length - 1] > 90, 'strong uptrend RSI > 90')

console.log('\nMACD — needs slow length')
const macdShort = calcMACD([1, 2, 3], 12, 26, 9)
assert(macdShort.every((r) => Number.isNaN(r.macd)), 'short series → NaN MACD')

console.log('\nBollinger mid equals SMA')
function calcBB(prices, period = 20, stdDev = 2) {
  const result = new Array(prices.length).fill(null).map(() => ({ mid: NaN, upper: NaN, lower: NaN }))
  if (prices.length < period) return result
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    result[i] = { mid: mean, upper: mean + stdDev * std, lower: mean - stdDev * std }
  }
  return result
}
const px = Array.from({ length: 25 }, (_, i) => 50 + i)
const bb = calcBB(px, 20, 2)
approx(bb[24].mid, px.slice(5, 25).reduce((a, b) => a + b, 0) / 20, 1e-9, 'BB mid = last window mean')

console.log('\nAll verify-indicator-math checks passed.')
