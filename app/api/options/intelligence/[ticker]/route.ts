import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { normalizeYahooOptionsChain } from '@/lib/quant/optionsGamma'
import { buildOptionsIntelligence } from '@/lib/options/intelligence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.toUpperCase() ?? ''
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  try {
    const [quoteResult, optionsResult] = await Promise.all([
      YahooFinance.quote(ticker) as Promise<{
        regularMarketPrice: number
        regularMarketTime: number
      }>,
      YahooFinance.options(ticker) as Promise<{
        expirationDates: number[]
        calls: Record<string, unknown>[]
        puts: Record<string, unknown>[]
      }>,
    ])

    const spotPrice = quoteResult.regularMarketPrice
    if (!spotPrice || spotPrice <= 0) {
      return NextResponse.json({ error: `Invalid spot price for ${ticker}` }, { status: 422 })
    }

    const mergedCalls = [...(optionsResult.calls ?? [])]
    const mergedPuts = [...(optionsResult.puts ?? [])]
    // Some Yahoo payloads return sparse contracts on the first call.
    // Pull a handful of near expiries to increase wall detection stability.
    if ((mergedCalls.length + mergedPuts.length) < 50 && (optionsResult.expirationDates?.length ?? 0) > 0) {
      const nearExpiries = optionsResult.expirationDates.slice(0, 6)
      const chainByExpiry = await Promise.all(
        nearExpiries.map(async (expTs) => {
          try {
            const leg = await YahooFinance.options(ticker, { date: expTs }) as {
              calls: Record<string, unknown>[]
              puts: Record<string, unknown>[]
            }
            return {
              calls: (leg.calls ?? []).map((c) => ({ ...c, expiration: expTs })),
              puts: (leg.puts ?? []).map((p) => ({ ...p, expiration: expTs })),
            }
          } catch {
            return { calls: [], puts: [] }
          }
        }),
      )
      for (const slice of chainByExpiry) {
        mergedCalls.push(...slice.calls)
        mergedPuts.push(...slice.puts)
      }
    }

    const expiries = normalizeYahooOptionsChain(
      ticker,
      spotPrice,
      {
        expirationDates: optionsResult.expirationDates ?? [],
        calls: mergedCalls,
        puts: mergedPuts,
      },
      new Date(quoteResult.regularMarketTime * 1000)
    )

    if (expiries.length === 0) {
      return NextResponse.json({
        ticker,
        error: `No listed options available for ${ticker}`,
      })
    }

    const intelligence = buildOptionsIntelligence(spotPrice, expiries)
    return NextResponse.json(
      {
        ticker,
        quoteTime: new Date(quoteResult.regularMarketTime * 1000).toISOString(),
        ...intelligence,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to build options intelligence', details: String(error) },
      { status: 500 }
    )
  }
}
