/**
 * FRED macro series (optional `FRED_API_KEY`).
 * Not part of the equity `DataProvider` chain — use `fetchFredObservations` directly.
 */

let fredLastRequestAt = 0
const FRED_MIN_GAP_MS = 300

async function throttleFred(): Promise<void> {
  const now = Date.now()
  const wait = fredLastRequestAt + FRED_MIN_GAP_MS - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  fredLastRequestAt = Date.now()
}

export function isFredConfigured(): boolean {
  return Boolean(process.env.FRED_API_KEY?.trim())
}

export type FredObservation = { date: string; value: number }

export async function fetchFredObservations(
  seriesId: string,
  options?: { observationStart?: string; observationEnd?: string }
): Promise<FredObservation[] | null> {
  const key = process.env.FRED_API_KEY?.trim()
  if (!key) return null
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: key,
    file_type: 'json',
  })
  if (options?.observationStart) params.set('observation_start', options.observationStart)
  if (options?.observationEnd) params.set('observation_end', options.observationEnd)
  const url = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`
  await throttleFred()
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as {
    observations?: { date: string; value: string }[]
  }
  const obs = json.observations
  if (!obs?.length) return null
  const out: FredObservation[] = []
  for (const o of obs) {
    if (o.value === '.' || o.value === '') continue
    const value = parseFloat(o.value)
    if (!Number.isFinite(value)) continue
    out.push({ date: o.date, value })
  }
  return out.length ? out : null
}
