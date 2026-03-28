/** Classic floor-trader pivots from prior session H/L/C. */

export function classicPivots(high: number, low: number, close: number) {
  const p = (high + low + close) / 3
  const r1 = 2 * p - low
  const s1 = 2 * p - high
  const r2 = p + (high - low)
  const s2 = p - (high - low)
  const r3 = high + 2 * (p - low)
  const s3 = low - 2 * (high - p)
  return { pivot: p, r1, r2, r3, s1, s2, s3 }
}
