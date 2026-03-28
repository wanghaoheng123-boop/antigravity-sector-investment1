'use client'

import { useCallback, useEffect, useState } from 'react'
import { CODEX_FRAMEWORKS } from '@/lib/quant/frameworks'
import { ChevronDown, ChevronRight, RefreshCw, Scale, BookOpen, LineChart, Layers } from 'lucide-react'
import { halfKelly } from '@/lib/quant/kelly'

type Payload = {
  symbol: string
  fetchedAt: string
  narrative: {
    name: string
    sector?: string
    industry?: string
    summary: string
    employees?: number | null
    website?: string
  }
  market: Record<string, number | null | undefined>
  health: Record<string, number | null | undefined>
  balances: {
    endDate: string | null
    totalAssets: number | null
    totalLiab: number | null
    equity: number | null
    cash: number | null
    longTermDebt: number | null
    currentAssets: number | null
    currentLiab: number | null
  }[]
  incomes: {
    endDate: string | null
    revenue: number | null
    netIncome: number | null
    grossProfit: number | null
  }[]
  dcf: {
    inputs: Record<string, unknown>
    scenarios: {
      bear: { valuePerShare: number } | null
      base: { valuePerShare: number } | null
      bull: { valuePerShare: number } | null
    }
  }
  anchors: Record<string, number | null>
  volatility: { annualized: number; sampleDays: number }
  bands: {
    fairValueMid: number | null
    buyZoneHigh: number | null
    sellZoneLow: number | null
    methodology: string
  } | null
  price: number | null
  signal: { label: string; detail: string } | null
  technicals?: {
    sma20: number | null
    sma50: number | null
    sma200: number | null
    rsi14: number | null
    macd: { line: number | null; signal: number | null; histogram: number | null }
    bollinger: { mid: number | null; upper: number | null; lower: number | null; pctB: number | null }
    atr14: number | null
    atrStopLong: number | null
    atrStopShort: number | null
    trendLabel: string
    maxDrawdownPct: number | null
    sharpe: number | null
    sortino: number | null
    vol20dAnnualized?: number | null
    vol60dAnnualized?: number | null
    volRegime20over60?: number | null
  }
  relative?: {
    correlationVsSpy: number | null
    excessReturn20dVsSpy: number | null
    excessReturn60dVsSpy: number | null
    alignedSessions: number
  }
  researchScore?: {
    total: number
    weights: string
    pillars: { name: string; score: number; detail: string }[]
  }
  earnings?: {
    nextEarningsDate: string | null
    lastQuarterEnd: string | null
    lastEPSActual: number | null
    lastEPSEstimate: number | null
    lastSurprisePct: number | null
  }
  pivots?: { pivot: number; r1: number; s1: number; r2: number; s2: number; r3: number; s3: number } | null
  range52w?: { high: number | null; low: number | null; position: number | null }
  fibRetracement?: { fib382: number; fib500: number; fib618: number } | null
  priceSources?: {
    display: number | null
    yahoo: number | null
    bloomberg: number | null
  }
}

function fmtB(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

export default function QuantLabPanel({ ticker }: { ticker: string }) {
  const [sub, setSub] = useState<'summary' | 'technicals' | 'financials' | 'valuation' | 'frameworks'>('summary')
  const [adv, setAdv] = useState<{
    winRate252d: number | null
    betaVsSpyLogReturns: number | null
    correlationVsSpy1y: number | null
    dividendYield: number | null
    avgVolume3m: number | null
    note?: string
  } | null>(null)
  const [advLoading, setAdvLoading] = useState(false)
  const [advFetched, setAdvFetched] = useState(false)
  const [kellyP, setKellyP] = useState(0.55)
  const [kellyWin, setKellyWin] = useState(1.2)
  const [kellyLoss, setKellyLoss] = useState(1)
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [wacc, setWacc] = useState(0.09)
  const [tg, setTg] = useState(0.025)
  const [gBear, setGBear] = useState(0.02)
  const [gBase, setGBase] = useState(0.05)
  const [gBull, setGBull] = useState(0.09)

  const buildQuery = useCallback(
    () => `wacc=${wacc}&tg=${tg}&gBear=${gBear}&gBase=${gBase}&gBull=${gBull}`,
    [wacc, tg, gBear, gBase, gBull]
  )

  const DEFAULT_Q = 'wacc=0.09&tg=0.025&gBear=0.02&gBase=0.05&gBull=0.09'

  const fetchPayload = useCallback(
    async (queryString: string) => {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch(`/api/fundamentals/${encodeURIComponent(ticker)}?${queryString}`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || r.statusText)
        setData(j)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Load failed')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [ticker]
  )

  useEffect(() => {
    setWacc(0.09)
    setTg(0.025)
    setGBear(0.02)
    setGBase(0.05)
    setGBull(0.09)
    setAdv(null)
    setAdvFetched(false)
    fetchPayload(DEFAULT_Q)
  }, [ticker, fetchPayload])

  useEffect(() => {
    if (sub !== 'technicals' || advFetched) return
    setAdvFetched(true)
    setAdvLoading(true)
    fetch(`/api/analytics/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error)
          setAdv({
            winRate252d: j.winRate252d ?? null,
            betaVsSpyLogReturns: j.betaVsSpyLogReturns ?? null,
            correlationVsSpy1y: j.correlationVsSpy1y ?? null,
            dividendYield: j.dividendYield ?? null,
            avgVolume3m: j.avgVolume3m ?? null,
            note: j.note,
          })
      })
      .catch(() => {})
      .finally(() => setAdvLoading(false))
  }, [sub, ticker, advFetched])

  const fwIcon = (id: string) => {
    if (id === 'probabilistic') return <Scale className="w-4 h-4 text-sky-400" />
    if (id === 'quality') return <BookOpen className="w-4 h-4 text-emerald-400" />
    if (id === 'macro') return <LineChart className="w-4 h-4 text-amber-400" />
    return <Layers className="w-4 h-4 text-violet-400" />
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/90 overflow-hidden shadow-2xl">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-blue-400/90 font-semibold">Quant Lab</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-mono">{ticker}</span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            {data?.narrative?.name ?? ticker}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.narrative?.sector}
            {data?.narrative?.industry ? ` · ${data.narrative.industry}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchPayload(buildQuery())}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 px-3 sm:px-4 py-2 border-b border-slate-800/80 bg-slate-950/40">
        {(
          [
            ['summary', 'Summary'],
            ['technicals', 'Technicals & RS'],
            ['financials', 'Financials'],
            ['valuation', 'Valuation'],
            ['frameworks', 'Codex frameworks'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sub === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {loading && !data && (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-slate-800/60 rounded-xl" />
            <div className="h-40 bg-slate-800/40 rounded-xl" />
          </div>
        )}
        {err && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200/90">
            {err}
            <p className="text-xs text-red-300/60 mt-2">
              ETFs and ADRs sometimes omit full statements; try a common US common stock (e.g. AAPL, MSFT).
            </p>
          </div>
        )}
        {data && sub === 'summary' && (
          <div className="space-y-6">
            <p className="text-[11px] text-slate-500 leading-relaxed border border-slate-800/80 rounded-lg p-3 bg-slate-950/50">
              Fundamentals and history from Yahoo Finance unless you configure a{' '}
              <strong className="text-slate-400">Bloomberg bridge</strong> for spot prices (see README). Models are transparent heuristics, not an unbiased oracle.
              Combine with primary filings (10-K/20-F), your data vendor, and compliance review before acting.
            </p>

            {data.priceSources?.bloomberg != null && data.priceSources.bloomberg > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-200/90 bg-amber-950/20 border border-amber-500/25 rounded-lg px-3 py-2">
                <span className="font-semibold uppercase tracking-wider text-amber-400/90">Bloomberg spot</span>
                <span className="font-mono">${data.priceSources.bloomberg.toFixed(2)}</span>
                <span className="text-slate-500">
                  (Yahoo ref: {data.priceSources.yahoo != null ? `$${data.priceSources.yahoo.toFixed(2)}` : '—'})
                </span>
              </div>
            )}

            {data.narrative.summary ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSummaryOpen(!summaryOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-white mb-2"
                >
                  {summaryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Business overview
                </button>
                <p className={`text-sm text-slate-400 leading-relaxed ${summaryOpen ? '' : 'line-clamp-4'}`}>
                  {data.narrative.summary}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Price', data.price != null ? `$${data.price.toFixed(2)}` : '—'],
                ['Trailing P/E', data.market.trailingPE != null ? data.market.trailingPE.toFixed(1) : '—'],
                ['Forward P/E', data.market.forwardPE != null ? data.market.forwardPE.toFixed(1) : '—'],
                ['P/B', data.market.priceToBook != null ? data.market.priceToBook.toFixed(2) : '—'],
                ['EV (raw)', fmtB(data.market.enterpriseValue as number | null)],
                ['Analyst target', data.market.targetMeanPrice != null ? `$${data.market.targetMeanPrice.toFixed(2)}` : '—'],
                ['Vol (ann.)', fmtPct(data.volatility.annualized)],
                ['Beta', data.market.beta != null ? data.market.beta.toFixed(2) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
                  <div className="text-sm font-mono text-white mt-1">{v}</div>
                </div>
              ))}
            </div>

            {data.earnings && (data.earnings.nextEarningsDate || data.earnings.lastEPSActual != null) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Next earnings</div>
                  <div className="font-mono text-amber-100 mt-1">{data.earnings.nextEarningsDate ?? '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Last quarter</div>
                  <div className="font-mono text-slate-200 mt-1">{data.earnings.lastQuarterEnd ?? '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">EPS act / est</div>
                  <div className="font-mono text-slate-200 mt-1">
                    {data.earnings.lastEPSActual != null ? data.earnings.lastEPSActual.toFixed(2) : '—'} /{' '}
                    {data.earnings.lastEPSEstimate != null ? data.earnings.lastEPSEstimate.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Surprise %</div>
                  <div className="font-mono text-slate-200 mt-1">
                    {data.earnings.lastSurprisePct != null ? `${data.earnings.lastSurprisePct.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>
            )}

            {data.researchScore && (
              <div className="rounded-xl border border-violet-500/25 bg-violet-950/10 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-violet-300 uppercase tracking-widest">Research dashboard score</h3>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xl">{data.researchScore.weights}</p>
                  </div>
                  <div className="text-4xl font-bold font-mono text-white">{Math.round(data.researchScore.total)}</div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.researchScore.pillars.map((p) => (
                    <div key={p.name} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                      <div className="text-[10px] text-slate-500">{p.name}</div>
                      <div className="text-sm font-mono text-violet-200">{Math.round(p.score)}</div>
                      <p className="text-[10px] text-slate-600 mt-1 leading-snug">{p.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Quality & leverage</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Metric label="ROE" value={fmtPct(data.health.returnOnEquity)} />
                  <Metric label="Net margin" value={fmtPct(data.health.profitMargin)} />
                  <Metric label="Op. margin" value={fmtPct(data.health.operatingMargin)} />
                  <Metric label="Debt/Eq" value={data.health.debtToEquity != null ? data.health.debtToEquity.toFixed(2) : '—'} />
                  <Metric label="Current ratio" value={data.health.currentRatio != null ? data.health.currentRatio.toFixed(2) : '—'} />
                  <Metric label="Rev. growth" value={fmtPct(data.health.revenueGrowth)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Mechanical band vs price</h3>
                {data.bands?.fairValueMid != null && data.price != null ? (
                  <>
                    <PriceRail
                      price={data.price}
                      fair={data.bands.fairValueMid}
                      buy={data.bands.buyZoneHigh}
                      sell={data.bands.sellZoneLow}
                    />
                    {data.signal && (
                      <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                        <div className="text-xs font-semibold text-blue-300">{data.signal.label}</div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{data.signal.detail}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-600 leading-relaxed">{data.bands.methodology}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Not enough anchors (DCF / analyst / forward heuristic) to draw bands.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {data && sub === 'technicals' && !data.technicals && (
          <p className="text-sm text-slate-500">Technicals could not be computed for this symbol.</p>
        )}

        {data && sub === 'technicals' && data.technicals && (
          <div className="space-y-6">
            <p className="text-xs text-slate-500">
              Indicators use daily closes (~2y+ when available). ATR stops are <strong className="text-slate-400">2×ATR</strong> offsets — not a trade recommendation.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                ['SMA20', data.technicals.sma20?.toFixed(2) ?? '—'],
                ['SMA50', data.technicals.sma50?.toFixed(2) ?? '—'],
                ['SMA200', data.technicals.sma200?.toFixed(2) ?? '—'],
                ['RSI(14)', data.technicals.rsi14?.toFixed(1) ?? '—'],
                ['MACD', data.technicals.macd.histogram?.toFixed(3) ?? '—'],
                ['MACD sig', data.technicals.macd.signal?.toFixed(3) ?? '—'],
                ['Boll %B', data.technicals.bollinger.pctB?.toFixed(2) ?? '—'],
                ['ATR(14)', data.technicals.atr14?.toFixed(3) ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                  <div className="text-slate-500 text-[10px]">{k}</div>
                  <div className="font-mono text-white mt-0.5">{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Trend structure</h3>
              <p className="text-sm text-slate-300">{data.technicals.trendLabel}</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                <span>Max DD (sample): {data.technicals.maxDrawdownPct != null ? fmtPct(data.technicals.maxDrawdownPct) : '—'}</span>
                <span>Sharpe (ann.): {data.technicals.sharpe?.toFixed(2) ?? '—'}</span>
                <span>Sortino (ann.): {data.technicals.sortino?.toFixed(2) ?? '—'}</span>
                <span>Vol 20d/60d: {data.technicals.volRegime20over60?.toFixed(2) ?? '—'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">ATR reference stops</h3>
                <div className="text-xs space-y-1 font-mono text-slate-300">
                  <div>Long risk ~2 ATR below: {data.technicals.atrStopLong?.toFixed(2) ?? '—'}</div>
                  <div>Short risk ~2 ATR above: {data.technicals.atrStopShort?.toFixed(2) ?? '—'}</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">52-week range</h3>
                <div className="text-xs space-y-1 font-mono text-slate-300">
                  <div>High: {data.range52w?.high?.toFixed(2) ?? '—'}</div>
                  <div>Low: {data.range52w?.low?.toFixed(2) ?? '—'}</div>
                  <div>Position in range: {data.range52w?.position != null ? fmtPct(data.range52w.position) : '—'}</div>
                </div>
              </div>
            </div>

            {data.fibRetracement && (
              <div className="rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Fib retracement (52w high → low)</h3>
                <div className="flex flex-wrap gap-3 text-xs font-mono text-slate-300">
                  <span>38.2%: {data.fibRetracement.fib382.toFixed(2)}</span>
                  <span>50%: {data.fibRetracement.fib500.toFixed(2)}</span>
                  <span>61.8%: {data.fibRetracement.fib618.toFixed(2)}</span>
                </div>
              </div>
            )}

            {data.pivots && (
              <div className="rounded-xl border border-slate-800 p-4 overflow-x-auto">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Classic pivots (prior session)</h3>
                <table className="w-full text-xs font-mono text-slate-300">
                  <tbody>
                    <tr className="border-b border-slate-800/60">
                      <td className="py-1 text-slate-500">P</td>
                      <td className="text-right">{data.pivots.pivot.toFixed(2)}</td>
                      <td className="pl-4 text-slate-500">R1</td>
                      <td className="text-right">{data.pivots.r1.toFixed(2)}</td>
                      <td className="pl-4 text-slate-500">S1</td>
                      <td className="text-right">{data.pivots.s1.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-500">R2</td>
                      <td className="text-right">{data.pivots.r2.toFixed(2)}</td>
                      <td className="pl-4 text-slate-500">S2</td>
                      <td className="text-right">{data.pivots.s2.toFixed(2)}</td>
                      <td className="pl-4 text-slate-500">R3/S3</td>
                      <td className="text-right">
                        {data.pivots.r3.toFixed(2)} / {data.pivots.s3.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {data.relative && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
                <h3 className="text-xs font-semibold text-emerald-400/90 uppercase tracking-widest mb-2">Relative strength vs SPY</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-slate-300">
                  <div>ρ (log ret, ~6m): {data.relative.correlationVsSpy?.toFixed(2) ?? '—'}</div>
                  <div>Excess 20d: {data.relative.excessReturn20dVsSpy != null ? fmtPct(data.relative.excessReturn20dVsSpy) : '—'}</div>
                  <div>Excess 60d: {data.relative.excessReturn60dVsSpy != null ? fmtPct(data.relative.excessReturn60dVsSpy) : '—'}</div>
                  <div>Aligned days: {data.relative.alignedSessions}</div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-700 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Extended analytics (5y history)</h3>
              {advLoading && <p className="text-xs text-slate-500">Loading win rate & beta proxy…</p>}
              {adv && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono text-slate-300">
                  <div>Win rate (~252d): {adv.winRate252d != null ? fmtPct(adv.winRate252d) : '—'}</div>
                  <div>Beta* (vs SPY logs): {adv.betaVsSpyLogReturns?.toFixed(2) ?? '—'}</div>
                  <div>ρ 1y: {adv.correlationVsSpy1y?.toFixed(2) ?? '—'}</div>
                  <div>Div. yield: {adv.dividendYield != null ? fmtPct(adv.dividendYield) : '—'}</div>
                  <div className="md:col-span-2">Avg vol 3m: {adv.avgVolume3m != null ? fmtB(adv.avgVolume3m) : '—'}</div>
                </div>
              )}
              {adv?.note && <p className="text-[10px] text-slate-600">{adv.note}</p>}
            </div>

            <div className="rounded-xl border border-blue-500/25 bg-blue-950/10 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Kelly calculator (education)</h3>
              <p className="text-[10px] text-slate-500">
                f* = p − (1−p)/b with b = avgWin/avgLoss. Shown: <strong className="text-slate-400">half-Kelly</strong>. Real strategies need transaction costs and correlation across bets.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs text-slate-400">
                  Win probability
                  <input
                    type="range"
                    min={0.35}
                    max={0.75}
                    step={0.01}
                    value={kellyP}
                    onChange={(e) => setKellyP(parseFloat(e.target.value))}
                    className="w-full mt-1 accent-blue-500"
                  />
                  <span className="font-mono text-white">{(kellyP * 100).toFixed(0)}%</span>
                </label>
                <label className="text-xs text-slate-400">
                  Avg win (R)
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.05}
                    value={kellyWin}
                    onChange={(e) => setKellyWin(parseFloat(e.target.value))}
                    className="w-full mt-1 accent-blue-500"
                  />
                  <span className="font-mono text-white">{kellyWin.toFixed(2)}</span>
                </label>
                <label className="text-xs text-slate-400">
                  Avg loss (R)
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={kellyLoss}
                    onChange={(e) => setKellyLoss(parseFloat(e.target.value))}
                    className="w-full mt-1 accent-blue-500"
                  />
                  <span className="font-mono text-white">{kellyLoss.toFixed(2)}</span>
                </label>
              </div>
              <div className="text-sm font-mono text-blue-200">
                Half-Kelly fraction:{' '}
                {halfKelly(kellyP, kellyWin, kellyLoss) != null
                  ? `${(halfKelly(kellyP, kellyWin, kellyLoss)! * 100).toFixed(2)}% of bankroll`
                  : '—'}
              </div>
            </div>
          </div>
        )}

        {data && sub === 'financials' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-white">Balance sheet (annual snapshots)</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-left">
                    <th className="p-2">Period</th>
                    <th className="p-2 text-right">Assets</th>
                    <th className="p-2 text-right">Liabilities</th>
                    <th className="p-2 text-right">Equity</th>
                    <th className="p-2 text-right">Cash</th>
                    <th className="p-2 text-right">LT debt</th>
                    <th className="p-2 text-right">C. assets</th>
                    <th className="p-2 text-right">C. liab.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.balances.map((b, i) => (
                    <tr key={i} className="border-b border-slate-800/60 text-slate-300">
                      <td className="p-2 text-slate-500">{b.endDate ?? '—'}</td>
                      <td className="p-2 text-right">{fmtB(b.totalAssets)}</td>
                      <td className="p-2 text-right">{fmtB(b.totalLiab)}</td>
                      <td className="p-2 text-right">{fmtB(b.equity)}</td>
                      <td className="p-2 text-right">{fmtB(b.cash)}</td>
                      <td className="p-2 text-right">{fmtB(b.longTermDebt)}</td>
                      <td className="p-2 text-right">{fmtB(b.currentAssets)}</td>
                      <td className="p-2 text-right">{fmtB(b.currentLiab)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-white">Income (annual snapshots)</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-left">
                    <th className="p-2">Period</th>
                    <th className="p-2 text-right">Revenue</th>
                    <th className="p-2 text-right">Gross profit</th>
                    <th className="p-2 text-right">Net income</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incomes.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/60 text-slate-300">
                      <td className="p-2 text-slate-500">{r.endDate ?? '—'}</td>
                      <td className="p-2 text-right">{fmtB(r.revenue)}</td>
                      <td className="p-2 text-right">{fmtB(r.grossProfit)}</td>
                      <td className="p-2 text-right">{fmtB(r.netIncome)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && sub === 'valuation' && (
          <div className="space-y-6">
            <p className="text-xs text-slate-500">
              Adjust growth and discount assumptions; the server recomputes DCF scenarios and volatility-adaptive bands. This mirrors the <em>bear / base / bull</em> tables in your Antigravity memos — not a single “true” fair value.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Slider label="WACC" value={wacc} min={0.04} max={0.16} step={0.005} onChange={setWacc} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
              <Slider label="Terminal growth" value={tg} min={0} max={0.045} step={0.005} onChange={setTg} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
              <Slider label="FCF growth bear" value={gBear} min={-0.05} max={0.12} step={0.005} onChange={setGBear} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
              <Slider label="FCF growth base" value={gBase} min={-0.05} max={0.15} step={0.005} onChange={setGBase} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
              <Slider label="FCF growth bull" value={gBull} min={0} max={0.22} step={0.005} onChange={setGBull} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
            </div>

            <button
              type="button"
              onClick={() => fetchPayload(buildQuery())}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              Recalculate
            </button>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Scenario</th>
                    <th className="p-3 text-right font-mono">Implied / sh</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-200">
                  <tr className="border-t border-slate-800">
                    <td className="p-3 text-red-300/90">Bear (higher WACC, lower growth)</td>
                    <td className="p-3 text-right">
                      {data.dcf.scenarios.bear ? `$${data.dcf.scenarios.bear.valuePerShare.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-800">
                    <td className="p-3 text-slate-200">Base</td>
                    <td className="p-3 text-right">
                      {data.dcf.scenarios.base ? `$${data.dcf.scenarios.base.valuePerShare.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-800">
                    <td className="p-3 text-emerald-300/90">Bull (lower WACC, higher growth)</td>
                    <td className="p-3 text-right">
                      {data.dcf.scenarios.bull ? `$${data.dcf.scenarios.bull.valuePerShare.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="text-slate-500">DCF base anchor</div>
                <div className="font-mono text-white mt-1">{data.anchors.dcfBase != null ? `$${data.anchors.dcfBase.toFixed(2)}` : '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="text-slate-500">Analyst mean target</div>
                <div className="font-mono text-white mt-1">
                  {data.anchors.analystTarget != null ? `$${data.anchors.analystTarget.toFixed(2)}` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="text-slate-500">Forward EPS × P/E heuristic</div>
                <div className="font-mono text-white mt-1">
                  {data.anchors.forwardEarningsHeuristic != null
                    ? `$${data.anchors.forwardEarningsHeuristic.toFixed(2)}`
                    : '—'}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-600 space-y-1">
              <p>FCF₀ from Yahoo (TTM or latest annual cash flow statement). Shares from key statistics.</p>
              <p>DCF ignores net cash/debt adjustment in equity bridge — upgrade for production by netting debt and minority interest.</p>
            </div>
          </div>
        )}

        {data && sub === 'frameworks' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Seven <strong className="text-slate-400">framework themes</strong> distilled from your Antigravity Investment Codex (pillars / sprints). They are checklists for disciplined thinking — not impersonations of any investor and not trade instructions.
            </p>
            <div className="space-y-3">
              {CODEX_FRAMEWORKS.map((f) => (
                <details
                  key={f.id}
                  className="group rounded-xl border border-slate-800 bg-slate-900/30 open:bg-slate-900/50 transition-colors"
                >
                  <summary className="cursor-pointer list-none flex items-center gap-3 p-4">
                    {fwIcon(f.id)}
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{f.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{f.themes[0]}</div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-800/60">
                    <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                      {f.themes.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Checklist</div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      {f.checklist.map((c) => (
                        <li key={c} className="flex gap-2">
                          <span className="text-blue-500 shrink-0">▸</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 px-2 py-1.5">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200 font-mono">{value}</div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  )
}

function PriceRail({
  price,
  fair,
  buy,
  sell,
}: {
  price: number
  fair: number
  buy: number | null
  sell: number | null
}) {
  const lo = Math.min(price, buy ?? price, fair, sell ?? price) * 0.92
  const hi = Math.max(price, buy ?? price, fair, sell ?? price) * 1.08
  const pos = (x: number) => `${((x - lo) / (hi - lo)) * 100}%`

  return (
    <div className="relative h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="absolute inset-y-0 w-px bg-slate-700" style={{ left: pos(fair) }} title="Fair value" />
      {buy != null && (
        <div
          className="absolute inset-y-0 w-0.5 bg-emerald-500/90"
          style={{ left: pos(buy) }}
          title="Buy zone ceiling"
        />
      )}
      {sell != null && (
        <div
          className="absolute inset-y-0 w-0.5 bg-rose-500/90"
          style={{ left: pos(sell) }}
          title="Sell zone floor"
        />
      )}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow-lg"
        style={{ left: pos(price) }}
        title={`Spot ${price.toFixed(2)}`}
      />
      <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] text-slate-600 font-mono">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}
