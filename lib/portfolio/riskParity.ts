/**
 * Minimal risk-parity helpers — inverse-vol weights and iterative ER parity (optional).
 */

export function inverseVolatilityWeights(vols: number[]): number[] {
  const inv = vols.map(v => (v > 1e-8 ? 1 / v : 0))
  const sum = inv.reduce((a, b) => a + b, 0)
  if (sum <= 0) return vols.map(() => 1 / Math.max(vols.length, 1))
  return inv.map(x => x / sum)
}

/** One Jacobi-style step toward equal risk contributions (marginal risk ~ vol×weight). */
export function riskParityStep(weights: number[], vols: number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const risk = weights.map((w, i) => w * (vols[i] ?? 0))
  const avg = risk.reduce((a, b) => a + b, 0) / n
  const adj = weights.map((w, i) => {
    const ri = risk[i] ?? 0
    // Guard: near-zero risk (no vol) would cause NaN in avg/ri; treat as equal-weight
    if (ri < 1e-12) return w
    return w * (avg / ri)
  })
  const s = adj.reduce((a, b) => a + b, 0)
  return s > 0 ? adj.map(w => w / s) : weights.map(() => 1 / n)
}

export function iterativeRiskParity(
  vols: number[],
  iterations = 8,
): number[] {
  let w = inverseVolatilityWeights(vols)
  for (let i = 0; i < iterations; i++) w = riskParityStep(w, vols)
  return w
}
