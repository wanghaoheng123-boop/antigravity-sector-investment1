import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { detectFloorCeiling, type KellyZoneInput } from '@/lib/quant/priceFloorCeiling'
import { sma200DeviationPct, sma200Slope, sma } from '@/lib/backtest/signals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface YahooQuoteResult {
  symbol: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamps: number[]
      indicators: {
        quote: Array<{
          open: number[]
          high: number[]
          low: number[]
          close: number[]
          volume: number[]
        }>
      }
    }>
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.toUpperCase() ?? ''
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  try {
    const url = new URL(request.url)
    const daysBack = parseInt(url.searchParams.get('days') ?? '365', 10)

    const [quoteResult, chartResult]: [YahooQuoteResult, YahooChartResult] = await Promise.all([
      YahooFinance.quote(ticker) as Promise<YahooQuoteResult>,
      YahooFinance.chart(ticker, {
        period1: Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000),
        interval: '1d',
      }) as Promise<YahooChartResult>,
    ])

    const spotPrice = quoteResult.regularMarketPrice
    const quoteTime = new Date(quoteResult.regularMarketTime * 1000).toISOString()

    if (!spotPrice || spotPrice <= 0) {
      return NextResponse.json({ error: `Invalid spot price for ${ticker}` }, { status: 422 })
    }

    // 2. Parse OHLCV candles
    const result = chartResult.chart.result?.[0]
    if (!result) {
      return NextResponse.json({ error: 'No chart data returned' }, { status: 422 })
    }

    const timestamps = result.timestamps ?? []
    const q = result.indicators?.quote?.[0]
    if (!q) {
      return NextResponse.json({ error: 'No quote data in chart response' }, { status: 422 })
    }

    const candles = timestamps
      .map((ts: number, i: number) => ({
        time: ts,
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter(c => c.close > 0)

    if (candles.length < 20) {
      return NextResponse.json({ error: 'Insufficient data for floor/ceiling analysis' }, { status: 422 })
    }

    // 3. Compute 200EMA for Kelly zones
    const closes = candles.map(c => c.close)
    const lastPrice = closes[closes.length - 1]
    const sma200 = sma(closes, 200)
    const devPct = sma200 != null ? sma200DeviationPct(lastPrice, sma200) ?? 0 : 0
    const slope = sma200Slope(closes) ?? 0

    // Classify regime
    let regime: KellyZoneInput['regime'] = 'FLAT'
    if (devPct > 20) regime = 'EXTREME_BULL'
    else if (devPct > 10) regime = 'EXTENDED_BULL'
    else if (devPct > 0) regime = 'HEALTHY_BULL'
    else if (devPct > -10) regime = 'FIRST_DIP'
    else if (devPct > -20) regime = 'DEEP_DIP'
    else if (devPct > -30) regime = 'BEAR_ALERT'
    else regime = 'CRASH_ZONE'

    // Calculate ATR (14-period)
    const atr = computeAtr(candles, 14)

    const kellyInput: KellyZoneInput = {
      regime,
      atr,
      entry: spotPrice,
      priceVs200EmaPct: devPct,
    }

    // 4. Run floor/ceiling detection
    const analysis = detectFloorCeiling(
      ticker,
      spotPrice,
      quoteTime,
      candles,
      undefined, // gammaInput — can be added if caller passes gamma data
      kellyInput,
      120
    )

    return NextResponse.json(
      {
        change: quoteResult.regularMarketChange,
        changePct: quoteResult.regularMarketChangePercent,
        regime,
        sma200DevPct: devPct,
        sma200Slope: slope,
        atr14: atr,
        ...analysis,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=1800',
        },
      }
    )
  } catch (error) {
    console.error(`[Price Floor/Ceiling API] ${ticker}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch price data', details: String(error) },
      { status: 500 }
    )
  }
}

function computeAtr(candles: { high: number; low: number; close: number }[], period: number = 14): number {
  if (candles.length < period + 1) {
    const avgRange = candles.slice(1).reduce((s, c, i) => {
      const prev = candles[i]
      const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
      return s + tr
    }, 0) / candles.slice(1).length
    return avgRange
  }

  let atr = 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev.close),
      Math.abs(candles[i].low - prev.close)
    )
    trs.push(tr)
  }

  // Wilder smoothing
  const firstAtr = trs.slice(0, period).reduce((s, tr) => s + tr, 0) / period
  let prevAtr = firstAtr
  for (let i = period; i < trs.length; i++) {
    prevAtr = (prevAtr * (period - 1) + trs[i]) / period
  }
  atr = prevAtr

  return Number.isFinite(atr) && atr > 0 ? atr : 0
}
