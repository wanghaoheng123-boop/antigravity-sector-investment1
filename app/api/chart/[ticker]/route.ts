import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { generateDarkPoolMarkers } from '@/lib/mockData'

const yahooFinance = new YahooFinance()

export async function GET(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') || '1Y'
  
  try {
    const period1 = new Date();
    let interval: '5m' | '15m' | '1d' | '1wk' | '1mo' = '1d';

    switch (range) {
      case '1D':
        period1.setDate(period1.getDate() - 3); // Extra days for weekend
        interval = '5m';
        break;
      case '1W':
        period1.setDate(period1.getDate() - 10);
        interval = '15m';
        break;
      case '1M':
        period1.setMonth(period1.getMonth() - 1);
        interval = '1d';
        break;
      case '3M':
        period1.setMonth(period1.getMonth() - 3);
        interval = '1d';
        break;
      case '6M':
        period1.setMonth(period1.getMonth() - 6);
        interval = '1d';
        break;
      case '1Y':
        period1.setFullYear(period1.getFullYear() - 1);
        interval = '1d';
        break;
      case '5Y':
        period1.setFullYear(period1.getFullYear() - 5);
        interval = '1wk';
        break;
      case 'ALL':
        period1.setFullYear(1970);
        interval = '1mo';
        break;
      default:
        period1.setFullYear(period1.getFullYear() - 1);
        interval = '1d';
        break;
    }

    const result = await yahooFinance.chart(ticker, {
      period1,
      interval
    })

    if (!result || !result.quotes || result.quotes.length === 0) {
      return NextResponse.json({ error: 'No historical data found for ticker' }, { status: 404 })
    }

    const candles = result.quotes.filter((c: any) => c.close !== null).map((c: any) => {
      const isIntraday = interval === '5m' || interval === '15m';
      const timeVal = isIntraday 
        ? Math.floor(c.date.getTime() / 1000) 
        : c.date.toISOString().split('T')[0];

      return {
        time: timeVal, 
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }
    })

    const darkPoolMarkers = generateDarkPoolMarkers(
      candles.map(c => ({ time: c.time as any, close: c.close })),
      ticker
    )

    return NextResponse.json(
      { ticker, candles, darkPoolMarkers },
      { headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error(`[Chart API] Error fetching historical data for ${ticker}:`, error)
    return NextResponse.json({ error: 'Failed to fetch historical data', details: String(error) }, { status: 500 })
  }
}
