import { NextRequest, NextResponse } from 'next/server'

const TA_BASE =
  process.env.TRADING_AGENTS_BASE ||
  (process.env.NODE_ENV === 'production'
    ? 'http://127.0.0.1:3001'
    : 'http://127.0.0.1:3001')

const TIMEOUT_MS = 4 * 60 * 1000 // 4 minutes — TradingAgents can be slow

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.trim().toUpperCase()
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const url = `${TA_BASE}/analyze/${encodeURIComponent(ticker)}/latest`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    clearTimeout(timer)

    if (res.status === 404) {
      return NextResponse.json(
        {
          error: 'no_cached_analysis',
          message: `No analysis found for ${ticker}. POST /api/trading-agents/${ticker} to run one.`,
        },
        { status: 404 }
      )
    }

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: 'upstream_error', details: text },
        { status: 502 }
      )
    }

    const json = await res.json()
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return NextResponse.json(
        { error: 'analysis_timeout', message: 'TradingAgents took too long (>4 min)' },
        { status: 504 }
      )
    }
    console.error('[TradingAgents GET]', err)
    return NextResponse.json(
      { error: 'failed_to_fetch', details: String(err) },
      { status: 502 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.trim().toUpperCase()
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  const supportedProviders = ['openai', 'google', 'anthropic', 'xai', 'openrouter', 'ollama']
  const supportedVendors = ['yfinance', 'alpha_vantage']

  const queryParams = new URLSearchParams()
  if (body.trade_date) queryParams.set('trade_date', String(body.trade_date))
  if (body.llm_provider && supportedProviders.includes(String(body.llm_provider))) {
    queryParams.set('llm_provider', String(body.llm_provider))
  }
  if (body.deep_think_llm) queryParams.set('deep_think_llm', String(body.deep_think_llm))
  if (body.quick_think_llm) queryParams.set('quick_think_llm', String(body.quick_think_llm))
  if (typeof body.max_debate_rounds === 'number') {
    queryParams.set('max_debate_rounds', String(body.max_debate_rounds))
  }
  if (typeof body.max_risk_discuss_rounds === 'number') {
    queryParams.set('max_risk_discuss_rounds', String(body.max_risk_discuss_rounds))
  }
  if (body.data_vendor && supportedVendors.includes(String(body.data_vendor))) {
    queryParams.set('data_vendor', String(body.data_vendor))
  }

  const url = `${TA_BASE}/analyze/${encodeURIComponent(ticker)}${
    queryParams.size ? '?' + queryParams.toString() : ''
  }`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const upstream = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    clearTimeout(timer)

    if (!upstream.ok) {
      const text = await upstream.text()
      return NextResponse.json(
        { error: 'upstream_error', details: text },
        { status: 502 }
      )
    }

    const json = await upstream.json()
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return NextResponse.json(
        { error: 'analysis_timeout', message: 'TradingAgents took too long (>4 min)' },
        { status: 504 }
      )
    }
    console.error('[TradingAgents POST]', err)
    return NextResponse.json(
      { error: 'failed_to_fetch', details: String(err) },
      { status: 502 }
    )
  }
}
