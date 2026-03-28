/** Annualized volatility from daily close series (log returns). */
export function annualizedVolFromCloses(closes: number[]): number {
  const c = closes.filter((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)
  if (c.length < 8) return 0.22
  const lr: number[] = []
  for (let i = 1; i < c.length; i++) lr.push(Math.log(c[i] / c[i - 1]))
  const mean = lr.reduce((a, b) => a + b, 0) / lr.length
  const varSample =
    lr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / Math.max(1, lr.length - 1)
  const dailySigma = Math.sqrt(Math.max(varSample, 0))
  return dailySigma * Math.sqrt(252)
}
