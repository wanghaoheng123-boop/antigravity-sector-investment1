import type { DailyFetchOptions, DataProvider, ProviderDailyBar, ProviderQuote } from './types'

/** Alpha Vantage free tier is 25 requests/day — avoid burst; minimum gap between calls. */
let avLastRequestAt = 0
const AV_MIN_GAP_MS = 1_200

async function throttleAv(): Promise<void> {
  const now = Date.now()
  const wait = avLastRequestAt + AV_MIN_GAP_MS - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  avLastRequestAt = Date.now()
}

function avSymbol(symbol: string): string {
  const u = symbol.trim().toUpperCase()
  return u.startsWith('^') ? u.slice(1) : u
}

export class AlphaVantageProvider implements DataProvider {
  readonly name = 'alphavantage'

  isAvailable(): boolean {
    return Boolean(process.env.ALPHAVANTAGE_API_KEY?.trim())
  }

  async fetchDaily(symbol: string, opts: DailyFetchOptions): Promise<ProviderDailyBar[] | null> {
    if (!this.isAvailable()) return null
    if (opts.interval !== '1d') return null
    const key = process.env.ALPHAVANTAGE_API_KEY!.trim()
    const sym = avSymbol(symbol)
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(sym)}&outputsize=full&apikey=${encodeURIComponent(key)}`
    await throttleAv()
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, unknown>
    const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
    if (!series || typeof series !== 'object') return null
    const cutoff = opts.period1.getTime()
    const out: ProviderDailyBar[] = []
    for (const [dateStr, ohlc] of Object.entries(series)) {
      const dayStart = new Date(dateStr + 'T00:00:00Z').getTime()
      if (dayStart < cutoff) continue
      const open = parseFloat(ohlc['1. open'])
      const high = parseFloat(ohlc['2. high'])
      const low = parseFloat(ohlc['3. low'])
      const close = parseFloat(ohlc['4. close'])
      const volume = parseInt(ohlc['6. volume'] ?? '0', 10)
      if (![open, high, low, close].every(Number.isFinite)) continue
      out.push({
        time: Math.floor(dayStart / 1000),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      })
    }
    out.sort((a, b) => a.time - b.time)
    return out.length ? out : null
  }

  async fetchQuote(symbol: string): Promise<ProviderQuote | null> {
    if (!this.isAvailable()) return null
    const key = process.env.ALPHAVANTAGE_API_KEY!.trim()
    const sym = avSymbol(symbol)
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(key)}`
    await throttleAv()
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      'Global Quote'?: Record<string, string>
    }
    const g = json['Global Quote']
    if (!g) return null
    const price = parseFloat(g['05. price'] ?? '')
    if (!Number.isFinite(price)) return null
    return { symbol: sym, price, regularMarketTime: null }
  }
}
