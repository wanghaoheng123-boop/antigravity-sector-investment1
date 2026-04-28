/**
 * Phase 11 B3 — proxy route tests for /api/trading-agents/[ticker].
 * Mocks global fetch so we can exercise the route without a live backend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/trading-agents/[ticker]/route'
import { NextRequest } from 'next/server'

const ORIG_BASE = process.env.TRADING_AGENTS_BASE
const ORIG_FALLBACK = process.env.TRADING_AGENTS_FALLBACK_BASE
const ORIG_NODE_ENV = process.env.NODE_ENV

function restoreEnv() {
  if (ORIG_BASE === undefined) delete process.env.TRADING_AGENTS_BASE
  else process.env.TRADING_AGENTS_BASE = ORIG_BASE
  if (ORIG_FALLBACK === undefined) delete process.env.TRADING_AGENTS_FALLBACK_BASE
  else process.env.TRADING_AGENTS_FALLBACK_BASE = ORIG_FALLBACK
  ;(process.env as Record<string, string | undefined>).NODE_ENV = ORIG_NODE_ENV
}

function mockFetchOnce(impl: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => impl()),
  )
}

function jsonResp(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init))
}

describe('GET /api/trading-agents/[ticker]', () => {
  beforeEach(() => {
    delete process.env.TRADING_AGENTS_BASE
    delete process.env.TRADING_AGENTS_FALLBACK_BASE
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    restoreEnv()
  })

  it('returns 502 backend_not_configured when env vars missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('backend_not_configured')
  })

  it('returns 502 invalid_trading_agents_base when http used in production', async () => {
    process.env.TRADING_AGENTS_BASE = 'http://insecure.example.com'
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('invalid_trading_agents_base')
  })

  it('returns 400 when ticker is empty', async () => {
    const res = await GET(makeRequest('http://localhost/api/trading-agents/'), {
      params: { ticker: '' },
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when upstream has no cached analysis', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    mockFetchOnce(async () => new Response('Not Found', { status: 404 }))
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(404)
    const j = await res.json()
    expect(j.error).toBe('no_cached_analysis')
  })

  it('passes through 200 JSON body when upstream returns ok', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    mockFetchOnce(async () =>
      jsonResp({ ticker: 'AAPL', decision: 'BUY', confidence_label: 'High' }),
    )
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.decision).toBe('BUY')
  })

  it('returns 502 upstream_error when upstream is 500', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    mockFetchOnce(async () => new Response('boom', { status: 500 }))
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('upstream_error')
  })

  it('returns 502 backend_unreachable on ECONNREFUSED', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed: ECONNREFUSED')
      }),
    )
    const res = await GET(makeRequest('http://localhost/api/trading-agents/AAPL'), {
      params: { ticker: 'AAPL' },
    })
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('backend_unreachable')
  })
})

describe('POST /api/trading-agents/[ticker]', () => {
  beforeEach(() => {
    delete process.env.TRADING_AGENTS_BASE
    delete process.env.TRADING_AGENTS_FALLBACK_BASE
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    restoreEnv()
  })

  it('rejects unknown provider with 400 invalid_provider', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({ llm_provider: 'fake-corp' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toBe('invalid_provider')
  })

  it('rejects api_key without provider with 400 provider_required_with_api_key', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({ api_key: 'sk-abcd1234' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toBe('provider_required_with_api_key')
  })

  it('rejects too-short api_key with 400 invalid_api_key', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({ llm_provider: 'openai', api_key: 'short' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toBe('invalid_api_key')
  })

  it('forwards a valid POST to the upstream with api_key in the body', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    let capturedUrl = ''
    let capturedBody: unknown = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url
        try {
          capturedBody = JSON.parse(String(init?.body ?? '{}'))
        } catch {
          capturedBody = null
        }
        return jsonResp({ ticker: 'AAPL', decision: 'HOLD' })
      }),
    )
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({
          llm_provider: 'openai',
          api_key: 'sk-test-1234567890',
          max_debate_rounds: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(200)
    expect(capturedUrl.startsWith('https://ta.example.com/analyze/AAPL')).toBe(true)
    expect(capturedUrl).toContain('llm_provider=openai')
    expect((capturedBody as Record<string, unknown>).api_key).toBe('sk-test-1234567890')
    expect((capturedBody as Record<string, unknown>).llm_provider).toBe('openai')
  })

  it('returns 502 upstream_error when upstream returns 500', async () => {
    process.env.TRADING_AGENTS_BASE = 'https://ta.example.com'
    mockFetchOnce(
      async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    )
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({ llm_provider: 'openai', api_key: 'sk-test-1234567890' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('upstream_error')
  })

  it('returns 502 backend_not_configured when env missing', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/trading-agents/AAPL', {
        method: 'POST',
        body: JSON.stringify({ llm_provider: 'openai', api_key: 'sk-test-1234567890' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { ticker: 'AAPL' } },
    )
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.error).toBe('backend_not_configured')
  })
})
