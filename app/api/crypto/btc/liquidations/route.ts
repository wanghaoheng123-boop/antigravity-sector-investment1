import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Binance liquidated trades stream (last 500 trades)
    const res = await fetch(
      'https://api.binance.com/api/v3/trades?symbol=BTCUSDT&limit=500',
      { next: { revalidate: 0 } } as RequestInit
    )
    if (!res.ok) return NextResponse.json({ error: 'Binance error' }, { status: 502 })
    const trades: any[] = await res.json()

    // Classify large trades (> $100k notional) as potential liquidation proxies
    const LARGE_THRESHOLD = 100_000
    const now = Date.now()
    const ONE_DAY = 24 * 60 * 60 * 1000

    const recentLarge = trades.filter(t => {
      const notional = parseFloat(t.price) * parseFloat(t.qty)
      return notional > LARGE_THRESHOLD && (now - t.time) < ONE_DAY
    })

    const buys = recentLarge.filter(t => t.isBuyerMaker === false)
    const sells = recentLarge.filter(t => t.isBuyerMaker === true)

    const buyVolume = buys.reduce((s, t) => s + parseFloat(t.price) * parseFloat(t.qty), 0)
    const sellVolume = sells.reduce((s, t) => s + parseFloat(t.price) * parseFloat(t.qty), 0)

    return NextResponse.json(
      {
        totalLiquidations: recentLarge.length,
        buyLiquidations: buys.length,
        sellLiquidations: sells.length,
        buyVolume,
        sellVolume,
        netDirection: buyVolume > sellVolume ? 'LONG_BIAS' : 'SHORT_BIAS',
        largeTradeCount: recentLarge.length,
        source: 'Binance Public API (trade proxy)',
        fetchedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[BTC Liquidations API]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
