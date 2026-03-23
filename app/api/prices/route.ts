import { NextRequest, NextResponse } from 'next/server'
import { SECTORS } from '@/lib/sectors'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const queryTickers = url.searchParams.get('tickers')
  
  // If ?tickers=AAPL,MSFT is passed, use those. Otherwise, use default sector ETFs basket.
  const tickers = queryTickers 
    ? queryTickers.split(',').map(t => t.toUpperCase())
    : [...SECTORS.map(s => s.etf), 'SPY', 'QQQ']
  
  try {
    const results = await yahooFinance.quote(tickers) as any[]
    
    // Convert to our platform's unified Format
    const quotes = results.map((q: any) => ({
      ticker: q.symbol,
      price: q.regularMarketPrice || 0,
      change: q.regularMarketChange || 0,
      changePct: q.regularMarketChangePercent !== undefined ? q.regularMarketChangePercent : 0,
      volume: q.regularMarketVolume || 0,
      high52w: q.fiftyTwoWeekHigh || 0,
      low52w: q.fiftyTwoWeekLow || 0,
      pe: q.trailingPE || 0,
      marketCap: q.marketCap ? (q.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'
    }))

    return NextResponse.json(
      { quotes, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[Prices API] Error fetching from Yahoo Finance:', error)
    return NextResponse.json({ error: 'Failed to fetch live prices', details: String(error) }, { status: 500 })
  }
}
