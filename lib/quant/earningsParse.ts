type Rec = Record<string, unknown>

function num(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  return null
}

export interface EarningsSnapshot {
  nextEarningsDate: string | null
  lastQuarterEnd: string | null
  lastEPSActual: number | null
  lastEPSEstimate: number | null
  lastSurprisePct: number | null
}

export function parseEarningsSnapshot(summary: Rec): EarningsSnapshot {
  const out: EarningsSnapshot = {
    nextEarningsDate: null,
    lastQuarterEnd: null,
    lastEPSActual: null,
    lastEPSEstimate: null,
    lastSurprisePct: null,
  }

  const cal = summary.calendarEvents as Rec | undefined
  const earn = cal?.earnings as Rec | undefined
  const dates = earn?.earningsDate as unknown
  if (Array.isArray(dates) && dates.length > 0) {
    const d0 = dates[0] as Rec
    out.nextEarningsDate =
      (d0?.fmt as string) ??
      (typeof d0?.raw === 'number' ? new Date((d0.raw as number) * 1000).toISOString().slice(0, 10) : null) ??
      null
  }

  const eh = summary.earningsHistory as Rec | undefined
  const hist = (eh?.history ?? eh?.earningsHistory) as unknown
  if (Array.isArray(hist) && hist.length > 0) {
    const row = hist[0] as Rec
    const quarter = row.quarter as Rec | undefined
    out.lastQuarterEnd =
      (typeof quarter?.fmt === 'string' ? quarter.fmt : null) ??
      (typeof quarter?.raw === 'number'
        ? new Date(quarter.raw * 1000).toISOString().slice(0, 10)
        : null) ??
      null
    const epsA = row.epsActual as Rec | undefined
    const epsE = row.epsEstimate as Rec | undefined
    out.lastEPSActual = num(epsA?.raw ?? epsA)
    out.lastEPSEstimate = num(epsE?.raw ?? epsE)
    const actual = out.lastEPSActual
    const est = out.lastEPSEstimate
    if (actual != null && est != null && Math.abs(est) > 1e-9) {
      out.lastSurprisePct = ((actual - est) / Math.abs(est)) * 100
    }
  }

  return out
}
