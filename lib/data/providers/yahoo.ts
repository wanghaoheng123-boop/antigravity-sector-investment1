import YahooFinance from 'yahoo-finance2'
import { yahooSymbolFromParam } from '@/lib/quant/yahooSymbol'
import type { ChartInterval, DailyFetchOptions, DataProvider, ProviderDailyBar, ProviderQuote } from './types'

const client = new YahooFinance()

function normalizeSymbol(raw: string): string {
  return yahooSymbolFromParam(raw)
}

function chartIntervalToYahoo(interval: ChartInterval): '1d' | '1wk' | '1mo' {
  return interval
}

export class YahooProvider implements DataProvider {
  readonly name = 'yahoo'

  isAvailable(): boolean {
    return true
  }

  async fetchDaily(symbol: string, opts: DailyFetchOptions): Promise<ProviderDailyBar[] | null> {
    const sym = normalizeSymbol(symbol)
    try {
      const result = await client.chart(sym, {
        period1: opts.period1,
        interval: chartIntervalToYahoo(opts.interval),
      })
      const quotes = result?.quotes
      if (!quotes?.length) return null
      const out: ProviderDailyBar[] = []
      for (const c of quotes) {
        if (c.close == null || c.open == null || c.high == null || c.low == null) continue
        const d = c.date instanceof Date ? c.date : new Date(c.date as string)
        const time = Math.floor(d.getTime() / 1000)
        out.push({
          time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: Number(c.volume ?? 0),
        })
      }
      return out.length ? out : null
    } catch {
      return null
    }
  }

  async fetchQuote(symbol: string): Promise<ProviderQuote | null> {
    const sym = normalizeSymbol(symbol)
    try {
      const q = await client.quote(sym)
      const price = (q as { regularMarketPrice?: number }).regularMarketPrice
      if (price == null || !Number.isFinite(price)) return null
      const t = (q as { regularMarketTime?: Date | string | null }).regularMarketTime
      let regularMarketTime: Date | null = null
      if (t instanceof Date) regularMarketTime = t
      else if (typeof t === 'string') regularMarketTime = new Date(t)
      const dividendYield = (q as { dividendYield?: number }).dividendYield
      const averageDailyVolume3Month = (q as { averageDailyVolume3Month?: number }).averageDailyVolume3Month
      return {
        symbol: sym,
        price,
        regularMarketTime,
        dividendYield: typeof dividendYield === 'number' ? dividendYield : null,
        averageDailyVolume3Month:
          typeof averageDailyVolume3Month === 'number' ? averageDailyVolume3Month : null,
      }
    } catch {
      return null
    }
  }
}
