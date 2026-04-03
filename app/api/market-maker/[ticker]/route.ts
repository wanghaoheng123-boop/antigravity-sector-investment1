import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import {
  buildMarketMakerState,
  buildDeltaAnalysis,
  buildMmNarrative,
} from '@/lib/quant/marketMakerAnalysis'
import type { OhlcvRow } from '@/lib/backtest/dataLoader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface YahooQuoteResult {
  symbol: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number
  bid: number
  ask: number
  bidSize: number
  askSize: number
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
    const daysBack = parseInt(url.searchParams.get('days') ?? '30', 10)

    const [quoteResult, chartResult]: [YahooQuoteResult, YahooChartResult] = await Promise.all([
      YahooFinance.quote(ticker) as Promise<YahooQuoteResult>,
      YahooFinance.chart(ticker, {
        period1: Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000),
        interval: daysBack <= 5 ? '5m' : '1h',
      }) as Promise<YahooChartResult>,
    ])

    const spotPrice = quoteResult.regularMarketPrice
    const quoteTime = new Date(quoteResult.regularMarketTime * 1000).toISOString()

    if (!spotPrice || spotPrice <= 0) {
      return NextResponse.json({ error: `Invalid spot price for ${ticker}` }, { status: 422 })
    }

    const result = chartResult.chart.result?.[0]
    if (!result) {
      return NextResponse.json({ error: 'No chart data returned' }, { status: 422 })
    }

    const q = result.indicators?.quote?.[0]
    if (!q) {
      return NextResponse.json({ error: 'No quote data in chart response' }, { status: 422 })
    }

    const timestamps = result.timestamps ?? []
    const candles: OhlcvRow[] = timestamps
      .map((ts: number, i: number) => ({
        time: ts,
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter(c => c.close > 0)

    if (candles.length < 5) {
      return NextResponse.json({ error: 'Insufficient candle data for analysis' }, { status: 422 })
    }

    const bid = quoteResult.bid ?? spotPrice * 0.9999
    const ask = quoteResult.ask ?? spotPrice * 1.0001
    const bidSize = quoteResult.bidSize ?? 0
    const askSize = quoteResult.askSize ?? 0
    const spotChangePct = quoteResult.regularMarketChangePercent ?? 0

    const mmState = buildMarketMakerState(
      ticker,
      quoteTime,
      candles,
      bid,
      ask,
      bidSize,
      askSize,
      0,
      spotChangePct
    )

    const deltaAnalysis = buildDeltaAnalysis(ticker, candles)
    const narrative = buildMmNarrative(mmState)

    return NextResponse.json(
      {
        ticker,
        spotPrice,
        quoteTime,
        change: quoteResult.regularMarketChange,
        changePct: quoteResult.regularMarketChangePercent,
        bid,
        ask,
        bidSize,
        askSize,
        spread: mmState.spread,
        spreadPct: mmState.spreadPct,
        marketMaker: {
          orderImbalance: mmState.orderImbalance,
          imbalanceDirection: mmState.imbalanceDirection,
          imbalanceStrength: mmState.imbalanceStrength,
          netDelta1d: mmState.netDelta1d,
          deltaVsPrice: mmState.deltaVsPrice,
          smartMoneySignal: mmState.smartMoneySignal,
          hedgingBias: mmState.hedgingBias,
          hedgingPressure: mmState.hedgingPressure,
        },
        narrative,
        delta: {
          totalVolume: deltaAnalysis.summary.totalVolume,
          totalDelta: deltaAnalysis.summary.totalDelta,
          deltaRatio: deltaAnalysis.summary.deltaRatio,
          divergenceFound: deltaAnalysis.summary.divergenceFound,
          divergenceType: deltaAnalysis.summary.divergenceType,
          divergenceStrength: deltaAnalysis.summary.divergenceStrength,
          maxConcentration: deltaAnalysis.summary.maxConcentration,
        },
        recentBars: deltaAnalysis.bars.slice(-20).map(b => ({
          time: b.time,
          close: b.close,
          volume: b.volume,
          delta: Math.round(b.delta),
          cumulativeDelta: Math.round(b.cumulativeDelta),
          deltaPercent: Math.round(b.deltaPercent * 100) / 100,
        })),
        dataVerification: {
          source: mmState.dataVerification.source,
          timestamp: mmState.dataVerification.timestamp,
          confidence: mmState.dataVerification.confidence,
          methodology: mmState.dataVerification.methodology,
        },
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error(`[Market Maker API] ${ticker}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch market data', details: String(error) },
      { status: 500 }
    )
  }
}
