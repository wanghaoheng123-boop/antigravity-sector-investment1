import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BINANCE_BASE = 'https://api.binance.com'

export async function GET() {
  try {
    const symbol = 'BTCUSDT'

    // Funding rate
    const fundRes = await fetch(`${BINANCE_BASE}/api/v3/premiumIndex?symbol=${symbol}`, { next: { revalidate: 0 } } as RequestInit)
    const funding = fundRes.ok ? await fundRes.json() : null

    // Open interest
    const oiRes = await fetch(`${BINANCE_BASE}/api/v3/openInterest?symbol=${symbol}`, { next: { revalidate: 0 } } as RequestInit)
    const openInterest = oiRes.ok ? await oiRes.json() : null

    // 24h taker buy/sell volume
    const tvRes = await fetch(`${BINANCE_BASE}/api/v3/takerBuySellVol?symbol=${symbol}`, { next: { revalidate: 0 } } as RequestInit)
    const takerVol = tvRes.ok ? await tvRes.json() : null

    // Long/Short ratio
    const lsRes = await fetch(`${BINANCE_BASE}/api/v3/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`, { next: { revalidate: 0 } } as RequestInit)
    const longShort = lsRes.ok ? await lsRes.json() : null

    return NextResponse.json(
      {
        fundingRate: funding ? parseFloat(funding.lastFundingRate ?? funding.fundingRate ?? 0) : null,
        fundingTime: funding?.nextFundingTime ? new Date(funding.nextFundingTime).toISOString() : null,
        openInterest: openInterest ? parseFloat(openInterest.openInterest) : null,
        takerBuyVolume: takerVol ? parseFloat(takerVol.buyVol) : null,
        takerSellVolume: takerVol ? parseFloat(takerVol.sellVol) : null,
        longShortRatio: longShort && longShort.length > 0 ? parseFloat(longShort[0].longShortRatio) : null,
        longAccountPct: longShort && longShort.length > 0 ? parseFloat(longShort[0].longAccountCl) : null,
        shortAccountPct: longShort && longShort.length > 0 ? parseFloat(longShort[0].shortAccountCl) : null,
        source: 'Binance Public API',
        fetchedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[BTC Metrics API]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
