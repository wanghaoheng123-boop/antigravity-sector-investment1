import { NextRequest, NextResponse } from 'next/server'

const BINANCE_BASE = 'https://api.binance.com'
const KRAKEN_OHLC = 'https://api.kraken.com/0/public/OHLC'
const SYMBOL = 'BTCUSDT'

/** Kraken interval in minutes — see https://docs.kraken.com/api/docs/rest-api/get-ohlc-data */
const KRAKEN_INTERVAL_MINUTES: Record<string, number> = {
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
  '1w': 10080,
  /** No native monthly bar — use daily (~720 bars max from Kraken). */
  '1M': 1440,
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

async function fetchWithTimeout(url: string, timeoutMs = 15_000, attempts = 3): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'QUANTAN/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      } as RequestInit)
      last = res
      if (res.ok) return res
      if ((res.status === 429 || res.status === 418) && attempt < attempts - 1) {
        const ra = res.headers.get('retry-after')
        const sec = ra ? Math.min(parseInt(ra, 10) || 0, 30) : 0
        await sleep(sec > 0 ? sec * 1000 : 500 * Math.pow(2, attempt))
        continue
      }
      if (attempt < attempts - 1 && res.status >= 500) {
        await sleep(400 * (attempt + 1))
        continue
      }
      return res
    } catch {
      if (attempt < attempts - 1) {
        await sleep(300 * (attempt + 1))
        continue
      }
    }
  }
  if (!last) throw new Error('All fetch attempts failed')
  return last!
}

type CandleRow = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function isGeoRestricted(text: string, status: number): boolean {
  return (
    status === 451 ||
    text.toLowerCase().includes('restricted location') ||
    text.toLowerCase().includes('eligibility') ||
    text.toLowerCase().includes('service unavailable from a restricted')
  )
}

/**
 * CoinGecko primary OHLC — globally accessible, no geo-blocking.
 * OHLC format: [timestamp_ms, open, high, low, close]
 * Volume is synthetic (1) — VWAP/OBV will be approximate.
 */
async function fetchCoinGeckoOhlc(binanceInterval: string, limit: number): Promise<CandleRow[] | null> {
  const days: Record<string, number | 'max'> = {
    '5m': 1, '15m': 1, '1h': 7, '4h': 30,
    '1d': 365, '1w': 'max', '1M': 'max',
  }
  const d = days[binanceInterval] ?? 365
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=${d === 'max' ? 'max' : d}`

  const attempt = async (): Promise<CandleRow[] | null> => {
    try {
      const res = await fetchWithTimeout(url, 20_000, 2)
      if (res.status === 429) return null
      if (!res.ok) return null
      const rows = (await res.json()) as unknown
      if (!Array.isArray(rows) || rows.length === 0) return null
      const slice = rows.slice(-Math.min(limit, rows.length))
      const candles = slice
        .map((row: unknown) => {
          if (!Array.isArray(row) || row.length < 5) return null
          const tMs = Number(row[0])
          const open = parseFloat(String(row[1]))
          const high = parseFloat(String(row[2]))
          const low = parseFloat(String(row[3]))
          const close = parseFloat(String(row[4]))
          if (![open, high, low, close].every(Number.isFinite)) return null
          return { time: Math.floor(tMs / 1000), open, high, low, close, volume: 1 }
        })
        .filter((c): c is CandleRow => c !== null)
        .filter(c => c.high >= c.low && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))
      return candles.length ? candles : null
    } catch { return null }
  }

  try {
    let out = await attempt()
    if (out) return out
    await sleep(1500)
    out = await attempt()
    return out
  } catch { return null }
}

/**
 * Binance REST — geo-blocked from Vercel IPs in many regions.
 * Used as secondary fallback only when CoinGecko fails.
 */
async function fetchBinanceOhlc(binanceInterval: string, limit: number): Promise<CandleRow[] | null> {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${SYMBOL}&interval=${binanceInterval}&limit=${limit}`
  try {
    const res = await fetchWithTimeout(url, 15_000, 2)
    const text = await res.text()
    if (!res.ok || isGeoRestricted(text, res.status)) return null
    const data: unknown[] = JSON.parse(text) as unknown[]
    if (!Array.isArray(data) || data.length === 0) return null
    const candles = data
      .filter((k: unknown): k is unknown[] => Array.isArray(k) && k.length >= 6 && k[4] != null)
      .map((k: unknown[]) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
      }))
      .filter((c) =>
        [c.open, c.high, c.low, c.close, c.volume].every((v) => Number.isFinite(v) && v >= 0) &&
        c.high >= c.low && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)
      )
    return candles.length ? candles : null
  } catch { return null }
}

/**
 * Kraken OHLC — XBTUSD pair, often accessible even when Binance is blocked.
 * Used as tertiary fallback.
 */
async function fetchKrakenOhlc(binanceInterval: string, limit: number): Promise<CandleRow[] | null> {
  const minutes = KRAKEN_INTERVAL_MINUTES[binanceInterval] ?? 1440
  const url = `${KRAKEN_OHLC}?pair=XBTUSD&interval=${minutes}`
  try {
    const res = await fetchWithTimeout(url, 20_000, 2)
    if (!res.ok) return null
    const data = (await res.json()) as { error?: string[]; result?: Record<string, unknown> }
    if (data.error?.length) return null
    const result = data.result
    if (!result || typeof result !== 'object') return null
    const pairKey = Object.keys(result).find((k) => k !== 'last')
    if (!pairKey) return null
    const rows = result[pairKey]
    if (!Array.isArray(rows) || rows.length === 0) return null
    const slice = rows.slice(-Math.min(limit, 720))
    const candles = slice
      .map((row: unknown) => {
        if (!Array.isArray(row) || row.length < 7) return null
        const t = Number(row[0])
        const open = parseFloat(String(row[1]))
        const high = parseFloat(String(row[2]))
        const low = parseFloat(String(row[3]))
        const close = parseFloat(String(row[4]))
        const volume = parseFloat(String(row[6]))
        return { time: t, open, high, low, close, volume }
      })
      .filter((c): c is CandleRow => c !== null)
      .filter(c => c.high >= c.low && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))
    return candles.length ? candles : null
  } catch { return null }
}

const INTERVAL_MAP: Record<string, string> = {
  '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h',
  '1d': '1d', '1w': '1w', '1M': '1M',
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const interval = searchParams.get('interval') || '1d'
  const rawLimit = parseInt(searchParams.get('limit') || '500', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 500
  const binanceInterval = INTERVAL_MAP[interval] || '1d'

  // ── Primary: CoinGecko (globally accessible) ──────────────────────────────
  const cg = await fetchCoinGeckoOhlc(binanceInterval, limit)
  if (cg?.length) {
    return NextResponse.json(
      {
        symbol: SYMBOL,
        interval: binanceInterval,
        candles: cg,
        source: 'CoinGecko Public API (primary)',
      },
      { headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } }
    )
  }

  // ── Secondary: Binance (geo-blocked from Vercel IPs in many regions) ───────
  const bn = await fetchBinanceOhlc(binanceInterval, limit)
  if (bn?.length) {
    return NextResponse.json(
      {
        symbol: SYMBOL,
        interval: binanceInterval,
        candles: bn,
        source: 'Binance Public API',
        note: 'CoinGecko was unavailable; served from Binance.',
      },
      { headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } }
    )
  }

  // ── Tertiary: Kraken ───────────────────────────────────────────────────────
  const kr = await fetchKrakenOhlc(binanceInterval, limit)
  if (kr?.length) {
    return NextResponse.json(
      {
        symbol: SYMBOL,
        interval: binanceInterval,
        candles: kr,
        source: 'Kraken Public API (fallback)',
        note: 'CoinGecko and Binance were unavailable; served from Kraken (volume may be in XBT not USD).',
      },
      { headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } }
    )
  }

  // ── All sources failed ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      error: 'btc_data_unavailable',
      userMessage:
        'All BTC data sources (CoinGecko, Binance, Kraken) are currently unreachable or rate-limited from this server region. The chart and price may still work from your browser via the client-side CoinGecko fallback.',
    },
    { status: 503 }
  )
}
