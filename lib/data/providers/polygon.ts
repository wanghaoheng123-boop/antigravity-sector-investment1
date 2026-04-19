import type { DailyFetchOptions, DataProvider, ProviderDailyBar, ProviderQuote } from './types'

/** Polygon free tier: 5 calls/min — space requests by at least 12s. */
let polygonLastRequestAt = 0
const POLYGON_MIN_GAP_MS = 12_000

async function throttlePolygon(): Promise<void> {
  const now = Date.now()
  const wait = polygonLastRequestAt + POLYGON_MIN_GAP_MS - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  polygonLastRequestAt = Date.now()
}

function polygonTicker(symbol: string): string {
  const u = symbol.trim().toUpperCase()
  if (u === '^VIX' || u === 'VIX') return 'I:VIX'
  if (u.startsWith('^')) return `I:${u.slice(1)}`
  return u
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export class PolygonProvider implements DataProvider {
  readonly name = 'polygon'

  isAvailable(): boolean {
    return Boolean(process.env.POLYGON_API_KEY?.trim())
  }

  async fetchDaily(symbol: string, opts: DailyFetchOptions): Promise<ProviderDailyBar[] | null> {
    if (!this.isAvailable()) return null
    const key = process.env.POLYGON_API_KEY!.trim()
    const ticker = polygonTicker(symbol)
    const to = new Date()
    const from = opts.period1
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${toYmd(from)}/${toYmd(to)}?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(key)}`
    await throttlePolygon()
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      results?: { t: number; o: number; h: number; l: number; c: number; v?: number }[]
      status?: string
    }
    const results = json.results
    if (!results?.length) return null
    const out: ProviderDailyBar[] = []
    for (const r of results) {
      out.push({
        time: Math.floor(r.t / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: Number(r.v ?? 0),
      })
    }
    return out
  }

  async fetchQuote(symbol: string): Promise<ProviderQuote | null> {
    if (!this.isAvailable()) return null
    const key = process.env.POLYGON_API_KEY!.trim()
    const ticker = polygonTicker(symbol)
    const url = `https://api.polygon.io/v2/last/trade/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(key)}`
    await throttlePolygon()
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      results?: { p?: number; t?: number } | { p?: number; t?: number }[]
      status?: string
    }
    const r = json.results
    const row = Array.isArray(r) ? r[0] : r
    if (!row || typeof row !== 'object') return null
    const p = row.p
    if (p == null || !Number.isFinite(p)) return null
    const t = row.t
    const regularMarketTime = t != null ? new Date(t / 1_000_000) : null
    return { symbol: ticker, price: p, regularMarketTime }
  }
}
