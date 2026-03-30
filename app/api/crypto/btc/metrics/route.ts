import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BINANCE_BASE = 'https://api.binance.com'

// In-memory cache with TTL to avoid hammering Binance API
// Each entry: { data, expiresAt }
let _cache: { data: any; expiresAt: number } | null = null
const CACHE_TTL_MS = 5_000 // 5-second TTL — safe for high-frequency traders

interface BinanceResponse<T> {
  data: T | null
  error: string | null
  status: number
}

async function safeBinanceFetch<T>(url: string, label: string): Promise<BinanceResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'QUANTAN/1.0' },
      // Use keepalive for cleaner teardown on Vercel serverless
      signal: AbortSignal.timeout(8_000), // 8-second timeout per endpoint
    } as RequestInit)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { data: null, error: `${label} HTTP ${res.status}: ${text.slice(0, 100)}`, status: res.status }
    }
    const data = await res.json() as T
    return { data, error: null, status: 200 }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    // Distinguish timeout from network error
    if (msg.includes('timeout') || msg.includes('AbortError')) {
      return { data: null, error: `${label} timed out after 8s`, status: 408 }
    }
    return { data: null, error: `${label} network error: ${msg}`, status: 0 }
  }
}

export async function GET() {
  const now = Date.now()

  // Serve stale cache while refreshing in background (stale-while-revalidate)
  if (_cache && now < _cache.expiresAt) {
    return NextResponse.json(
      { ..._cache.data, _cached: true, source: 'Binance Public API' },
      { headers: { 'Cache-Control': 'public, max-age=5, stale-while-revalidate=10' } }
    )
  }

  const symbol = 'BTCUSDT'

  // Fire all 4 requests in parallel — reduces total latency from ~800ms to ~200ms
  const [fundRes, oiRes, tvRes, lsRes] = await Promise.all([
    safeBinanceFetch<any>(`${BINANCE_BASE}/api/v3/premiumIndex?symbol=${symbol}`, 'funding'),
    safeBinanceFetch<any>(`${BINANCE_BASE}/api/v3/openInterest?symbol=${symbol}`, 'openInterest'),
    safeBinanceFetch<any>(`${BINANCE_BASE}/api/v3/takerBuySellVol?symbol=${symbol}`, 'takerVol'),
    safeBinanceFetch<any>(`${BINANCE_BASE}/api/v3/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`, 'longShort'),
  ])

  const errors = [fundRes.error, oiRes.error, tvRes.error, lsRes.error].filter(Boolean)
  const allFailed = errors.length === 4

  const result = {
    fundingRate:    fundRes.data ? parseFloat(fundRes.data.lastFundingRate ?? fundRes.data.fundingRate ?? 0) : null,
    nextFundingTime: fundRes.data?.nextFundingTime ? new Date(fundRes.data.nextFundingTime).toISOString() : null,
    openInterest:   oiRes.data ? parseFloat(oiRes.data.openInterest) : null,
    takerBuyVolume: tvRes.data ? parseFloat(tvRes.data.buyVol) : null,
    takerSellVolume: tvRes.data ? parseFloat(tvRes.data.sellVol) : null,
    longShortRatio:   lsRes.data && lsRes.data.length > 0 ? parseFloat(lsRes.data[0].longShortRatio) : null,
    longAccountPct:   lsRes.data && lsRes.data.length > 0 ? parseFloat(lsRes.data[0].longAccountCl) : null,
    shortAccountPct:  lsRes.data && lsRes.data.length > 0 ? parseFloat(lsRes.data[0].shortAccountCl) : null,
    _errors: errors.length > 0 ? errors : undefined,
    source: 'Binance Public API',
    fetchedAt: new Date().toISOString(),
  }

  // Cache the result (even partial) to prevent thundering-herd on rate-limited API
  if (!allFailed) {
    _cache = { data: result, expiresAt: now + CACHE_TTL_MS }
  }

  return NextResponse.json(
    { ...result, _cached: false },
    {
      status: allFailed ? 502 : 200,
      headers: {
        // Allow CDN caching for 5s, serve stale while revalidating for 10s
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
        // Do not cache errors longer — retry quickly
        ...(allFailed ? { 'Cache-Control': 'no-store' } : {}),
      },
    }
  )
}
