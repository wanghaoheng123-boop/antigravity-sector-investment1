import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ quotes: [] })
  }

  try {
    const result = await YahooFinance.search(q, {
      newsCount: 0,
      quotesCount: 5
    }) as any

    const quotes = result.quotes.map((quote: any) => ({
      symbol: quote.symbol,
      shortname: quote.shortname || quote.longname || quote.symbol,
      exchange: quote.exchDisp || quote.exchange,
      typeDisp: quote.typeDisp || quote.quoteType,
    }))

    return NextResponse.json({ quotes })
  } catch (error) {
    console.error('[Search API] Error searching Yahoo Finance:', error)
    return NextResponse.json({ error: 'Failed to fetch search results', quotes: [] }, { status: 500 })
  }
}
