/** Align two close series by trading day key (YYYY-MM-DD). */

export function alignCloses(
  datesA: string[],
  closesA: number[],
  datesB: string[],
  closesB: number[]
): { a: number[]; b: number[] } {
  const mapB = new Map<string, number>()
  for (let i = 0; i < datesB.length; i++) mapB.set(datesB[i], closesB[i])
  const a: number[] = []
  const b: number[] = []
  for (let i = 0; i < datesA.length; i++) {
    const d = datesA[i]
    const ca = closesA[i]
    const cb = mapB.get(d)
    if (cb != null && ca > 0 && cb > 0) {
      a.push(ca)
      b.push(cb)
    }
  }
  return { a, b }
}

export function logReturns(closes: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) r.push(Math.log(closes[i] / closes[i - 1]))
  }
  return r
}

export function correlation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length)
  if (n < 10) return null
  const xs = x.slice(-n)
  const ys = y.slice(-n)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx
    const vy = ys[i] - my
    num += vx * vy
    dx += vx * vx
    dy += vy * vy
  }
  const den = Math.sqrt(dx * dy)
  return den > 0 ? num / den : null
}

/** Total return over last `days` trading sessions. */
export function trailingReturn(closes: number[], days: number): number | null {
  if (closes.length < days + 1) return null
  const old = closes[closes.length - 1 - days]
  const last = closes[closes.length - 1]
  if (old <= 0) return null
  return last / old - 1
}

/** Stock return minus benchmark return (same window). */
export function excessReturn(
  stockCloses: number[],
  benchCloses: number[],
  days: number
): number | null {
  const rs = trailingReturn(stockCloses, days)
  const rb = trailingReturn(benchCloses, days)
  if (rs == null || rb == null) return null
  return rs - rb
}
