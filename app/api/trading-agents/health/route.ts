import { NextResponse } from 'next/server'

type TradingAgentsResolved =
  | { ok: true; base: string; source: 'project' | 'managed_fallback' | 'local_dev' }
  | { ok: false; reason: 'missing' | 'invalid_url' | 'insecure_base' }

function resolveTradingAgentsBase(): TradingAgentsResolved {
  const parseBase = (
    raw: string | undefined,
    source: 'project' | 'managed_fallback'
  ): TradingAgentsResolved => {
    if (!raw?.trim()) return { ok: false, reason: 'missing' }
    const normalized = raw.trim().replace(/\/$/, '')
    let u: URL
    try {
      u = new URL(normalized)
    } catch {
      return { ok: false, reason: 'invalid_url' }
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, reason: 'invalid_url' }
    }
    if (u.username || u.password) {
      return { ok: false, reason: 'invalid_url' }
    }
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
      return { ok: false, reason: 'insecure_base' }
    }
    return { ok: true, base: u.origin, source }
  }

  const primary = parseBase(process.env.TRADING_AGENTS_BASE, 'project')
  if (primary.ok) return primary
  if (primary.reason !== 'missing') return primary

  const fallback = parseBase(process.env.TRADING_AGENTS_FALLBACK_BASE, 'managed_fallback')
  if (fallback.ok) return fallback
  if (fallback.reason !== 'missing') return fallback

  if (process.env.NODE_ENV === 'development') {
    return { ok: true, base: 'http://127.0.0.1:3001', source: 'local_dev' }
  }

  return { ok: false, reason: 'missing' }
}

export async function GET(req: Request) {
  const resolved = resolveTradingAgentsBase()
  if (!resolved.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: 'config_error',
        error: resolved.reason === 'missing' ? 'backend_not_configured' : 'invalid_trading_agents_base',
        details: resolved.reason,
      },
      { status: 200 }
    )
  }

  // Phase 11 B2: ?deep=1 hits /smoke for an additional event-loop +
  // contextvar propagation probe. Enables the frontend to show a stronger
  // "Ready" signal without burning LLM credits.
  const url = new URL(req.url)
  const deep = url.searchParams.get('deep') === '1'
  const probePath = deep ? '/smoke' : '/health'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const r = await fetch(`${resolved.base}${probePath}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: 'unreachable',
          source: resolved.source,
          base: resolved.base,
          error: 'backend_unreachable',
          details: `${probePath} returned ${r.status}`,
        },
        { status: 200 }
      )
    }
    let smoke: Record<string, unknown> | null = null
    if (deep) {
      try {
        smoke = (await r.json()) as Record<string, unknown>
      } catch {
        // ignore — we still consider the backend reachable
      }
    }
    const ctxPropagation = smoke && typeof smoke.context_propagation === 'boolean'
      ? smoke.context_propagation
      : null
    return NextResponse.json(
      {
        ok: true,
        status: ctxPropagation === false ? 'unreachable' : 'ready',
        source: resolved.source,
        base: resolved.base,
        ...(deep
          ? {
              deep: true,
              context_propagation: ctxPropagation,
              elapsed_ms: typeof smoke?.elapsed_ms === 'number' ? smoke.elapsed_ms : null,
              providers_supported:
                Array.isArray(smoke?.providers_supported) ? smoke?.providers_supported : null,
            }
          : {}),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 'unreachable',
        source: resolved.source,
        base: resolved.base,
        error: 'backend_unreachable',
        details: String(err),
      },
      { status: 200 }
    )
  }
}
