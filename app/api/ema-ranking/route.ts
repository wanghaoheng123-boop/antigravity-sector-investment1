/**
 * GET /api/ema-ranking
 * Returns sorted EMA-strength leaderboard for S&P 500 constituents.
 * Optional ?sector= query param to filter to a single GICS sector.
 * Cache TTL: 5 minutes (EMA changes slowly intraday).
 */

import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { SPY500 } from '@/lib/spy500'
import {
  computeEmaRankingRow,
  normaliseScores,
  type EmaRankingRow,
} from '@/lib/quant/emaRanking'

// ─── In-process cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  data: EmaRankingRow[]
  ts: number
}

const CACHE = new Map<string, CacheEntry>()
const TTL_MS = 5 * 60 * 1000   // 5 minutes

// ─── Yahoo data fetch ─────────────────────────────────────────────────────────

async function fetchDailyCloses(ticker: string): Promise<number[] | null> {
  try {
    const period1 = new Date()
    period1.setDate(period1.getDate() - 420)   // ~420 calendar days → ~300 trading bars
    const result = await (YahooFinance as any).chart(ticker, {
      period1,
      interval: '1d',
    })
    const quotes = result?.quotes ?? []
    return quotes
      .filter((q: any) => q.close != null && Number.isFinite(q.close))
      .map((q: any) => q.close as number)
  } catch {
    return null
  }
}

async function fetchQuote(ticker: string): Promise<{ price: number; changePct: number | null } | null> {
  try {
    const q = await (YahooFinance as any).quote(ticker)
    const price = q?.regularMarketPrice ?? q?.price?.regularMarketPrice
    if (!price || !Number.isFinite(price)) return null
    const prev = q?.regularMarketPreviousClose ?? null
    const changePct =
      prev && Number.isFinite(prev) && prev > 0
        ? ((price - prev) / prev) * 100
        : null
    return { price, changePct }
  } catch {
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector') ?? 'all'
  const cacheKey = sector

  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=300' },
    })
  }

  const universe =
    sector === 'all'
      ? SPY500
      : SPY500.filter(s => s.sector === sector)

  const rows: EmaRankingRow[] = []

  // Sequential fetch with stagger to respect Yahoo rate limits
  for (const { ticker, sector: sec } of universe) {
    const [closes, quote] = await Promise.all([
      fetchDailyCloses(ticker),
      fetchQuote(ticker),
    ])
    if (!closes || closes.length < 210 || !quote) continue

    const raw = computeEmaRankingRow(ticker, sec, closes, quote.price, quote.changePct)
    rows.push({ ...raw, score: 0 })   // score filled by normaliseScores

    // 50ms stagger between tickers to avoid rate-limit 429s
    await new Promise(r => setTimeout(r, 50))
  }

  normaliseScores(rows)
  rows.sort((a, b) => (b.deviationPct ?? -999) - (a.deviationPct ?? -999))

  CACHE.set(cacheKey, { data: rows, ts: Date.now() })

  return NextResponse.json(rows, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=300' },
  })
}
