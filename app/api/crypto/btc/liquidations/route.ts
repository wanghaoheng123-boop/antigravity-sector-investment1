import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// In-memory cache for liquidation data — 10-second TTL
let _cache: { data: any; expiresAt: number } | null = null
const CACHE_TTL_MS = 10_000

export async function GET() {
  const now = Date.now()

  if (_cache && now < _cache.expiresAt) {
    return NextResponse.json({ ..._cache.data, _cached: true }, {
      headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=20' } }
    )
  }

  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/trades?symbol=BTCUSDT&limit=500',
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'QUANTAN/1.0' },
        signal: AbortSignal.timeout(10_000),
      } as RequestInit
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Binance HTTP ${res.status}` }, { status: 502 })
    }
    const trades: any[] = await res.json()

    const LARGE_THRESHOLD = 100_000
    const ONE_DAY = 24 * 60 * 60 * 1000

    const recentLarge = trades.filter(t => {
      const notional = parseFloat(t.price) * parseFloat(t.qty)
      return notional > LARGE_THRESHOLD && (now - t.time) < ONE_DAY
    })

    const buys = recentLarge.filter(t => t.isBuyerMaker === false)
    const sells = recentLarge.filter(t => t.isBuyerMaker === true)
    const buyVolume = buys.reduce((s, t) => s + parseFloat(t.price) * parseFloat(t.qty), 0)
    const sellVolume = sells.reduce((s, t) => s + parseFloat(t.price) * parseFloat(t.qty), 0)

    const result = {
      totalLiquidations: recentLarge.length,
      buyLiquidations: buys.length,
      sellLiquidations: sells.length,
      buyVolume,
      sellVolume,
      netDirection: buyVolume > sellVolume ? 'LONG_BIAS' : 'SHORT_BIAS',
      largeTradeCount: recentLarge.length,
      source: 'Binance Public API (trade proxy)',
      fetchedAt: new Date().toISOString(),
    }

    _cache = { data: result, expiresAt: now + CACHE_TTL_MS }

    return NextResponse.json(
      { ...result, _cached: false },
      { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=20' } }
    )
  } catch (error) {
    console.error('[BTC Liquidations API]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
