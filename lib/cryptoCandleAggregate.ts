/** Merge 1m (or any equal-step) OHLC rows into N-minute bars (used for BTC 3m from Kraken 1m). */

export type NumericCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function aggregateCandlesToNMinutes(candles: NumericCandle[], n: number): NumericCandle[] {
  if (n < 2 || candles.length === 0) return candles
  const sec = n * 60
  const buckets = new Map<number, NumericCandle>()
  const sorted = [...candles].sort((a, b) => a.time - b.time)
  for (const c of sorted) {
    const key = Math.floor(c.time / sec) * sec
    const ex = buckets.get(key)
    if (!ex) {
      buckets.set(key, { ...c, time: key })
    } else {
      ex.high = Math.max(ex.high, c.high)
      ex.low = Math.min(ex.low, c.low)
      ex.close = c.close
      ex.volume += c.volume
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
}
