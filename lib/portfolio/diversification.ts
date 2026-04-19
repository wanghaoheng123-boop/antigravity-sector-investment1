/**
 * Concentration + simple correlation summary from returns matrix.
 */

export function herfindahlIndex(weights: number[]): number {
  const s = weights.reduce((a, b) => a + b * b, 0)
  return Math.min(1, Math.max(0, s))
}

/** Pearson correlation between two same-length series. */
export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 5) return null
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const d = Math.sqrt(denA * denB)
  return d < 1e-12 ? null : num / d
}

export function averagePairwiseCorrelation(returnsMatrix: number[][]): number | null {
  const k = returnsMatrix.length
  if (k < 2) return null
  const len = Math.min(...returnsMatrix.map(r => r.length))
  if (len < 10) return null
  const cols = returnsMatrix.map(r => r.slice(-len))
  let sum = 0
  let count = 0
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const c = correlation(cols[i], cols[j])
      if (c != null) {
        sum += c
        count++
      }
    }
  }
  return count > 0 ? sum / count : null
}
