/**
 * Kelly criterion (educational). f* = p - (1-p)/b where b = avgWin/avgLoss.
 * UI should default to half-Kelly or less for real capital.
 */

export function kellyFraction(winProb: number, avgWin: number, avgLoss: number): number | null {
  if (!(winProb > 0 && winProb < 1) || avgWin <= 0 || avgLoss <= 0) return null
  const b = avgWin / avgLoss
  const q = 1 - winProb
  const f = winProb - q / b
  return f
}

export function halfKelly(winProb: number, avgWin: number, avgLoss: number): number | null {
  const f = kellyFraction(winProb, avgWin, avgLoss)
  if (f == null) return null
  return Math.max(0, f / 2)
}
