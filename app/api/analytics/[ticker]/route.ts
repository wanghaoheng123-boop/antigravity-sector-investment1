import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { yahooSymbolFromParam } from '@/lib/quant/yahooSymbol'
import { dailyReturns } from '@/lib/quant/technicals'
import { alignCloses, logReturns, correlation } from '@/lib/quant/relativeStrength'
import { hasPositiveClose } from '@/lib/quant/chartQuoteFilter'

const yahooFinance = new YahooFinance()

/** Extra analytics (win rate, up/down days, beta proxy) — complements `/api/fundamentals`. */
export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  const symbol = yahooSymbolFromParam(params.ticker)
  if (symbol.startsWith('^')) {
    return NextResponse.json({ error: 'Use a stock/ETF symbol for analytics.' }, { status: 422 })
  }

  const period1 = new Date()
  period1.setFullYear(period1.getFullYear() - 5)

  try {
    const [chart, spyChart, quote] = await Promise.all([
      yahooFinance.chart(symbol, { period1, interval: '1d' }),
      yahooFinance.chart('SPY', { period1, interval: '1d' }),
      yahooFinance.quote(symbol).catch(() => null),
    ])

    const quotes = chart?.quotes?.filter(hasPositiveClose) ?? []
    const closes = quotes.map((c) => c.close!)
    const dates = quotes.map((c) =>
      c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10)
    )

    const spyQ = spyChart?.quotes?.filter(hasPositiveClose) ?? []
    const spyCloses = spyQ.map((c) => c.close!)
    const spyDates = spyQ.map((c) =>
      c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10)
    )

    const rets = dailyReturns(closes)
    const slice252 = rets.length >= 5 ? rets.slice(-Math.min(252, rets.length)) : []
    const winRate252 =
      slice252.length > 0 ? slice252.filter((x) => x > 0).length / slice252.length : null
    const avgDailyRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null

    const aligned = alignCloses(dates, closes, spyDates, spyCloses)
    const lrA = logReturns(aligned.a)
    const lrB = logReturns(aligned.b)
    const n = Math.min(lrA.length, lrB.length)
    let betaProxy: number | null = null
    if (n >= 120) {
      const xa = lrA.slice(-252)
      const xb = lrB.slice(-252)
      const m = Math.min(xa.length, xb.length)
      const a = xa.slice(-m)
      const b = xb.slice(-m)
      const meanA = a.reduce((x, y) => x + y, 0) / m
      const meanB = b.reduce((x, y) => x + y, 0) / m
      let cov = 0
      let varB = 0
      for (let i = 0; i < m; i++) {
        const da = a[i] - meanA
        const db = b[i] - meanB
        cov += da * db
        varB += db * db
      }
      betaProxy = varB > 0 ? cov / varB : null
    }

    const corr1y = n >= 30 ? correlation(lrA.slice(-252), lrB.slice(-252)) : null

    const q = quote as { dividendYield?: number; averageDailyVolume3Month?: number } | null

    return NextResponse.json(
      {
        symbol,
        fetchedAt: new Date().toISOString(),
        historyDays: closes.length,
        winRate252d: winRate252,
        avgDailyReturn: avgDailyRet,
        betaVsSpyLogReturns: betaProxy,
        correlationVsSpy1y: corr1y,
        dividendYield: typeof q?.dividendYield === 'number' ? q.dividendYield : null,
        avgVolume3m: typeof q?.averageDailyVolume3Month === 'number' ? q.averageDailyVolume3Month : null,
        note:
          'Beta is a quick OLS slope on overlapping log returns vs SPY (~1y window when available), not Bloomberg-adjusted beta.',
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (e) {
    console.error('[Analytics API]', symbol, e)
    return NextResponse.json({ error: 'Analytics failed', details: String(e) }, { status: 502 })
  }
}
