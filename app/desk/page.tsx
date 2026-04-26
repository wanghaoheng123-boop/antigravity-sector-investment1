'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DESK_TICKERS } from '@/lib/deskTickers'
import { SECTORS } from '@/lib/sectors'
import { COMMODITY_INSTRUMENTS } from '@/lib/commodities'
import { useWatchlist } from '@/hooks/useWatchlist'

interface Quote {
  ticker: string
  price: number
  change: number
  changePct: number
  volume: number
}

const REFRESH_MS = { fast: 2000, normal: 5000, slow: 15000 } as const

function pctHeatClass(pct: number | undefined): string {
  if (pct === undefined || Number.isNaN(pct)) return ''
  const a = Math.abs(pct)
  const pos = pct >= 0
  if (a >= 3) return pos ? 'bg-emerald-950/70 text-emerald-300 font-semibold' : 'bg-red-950/70 text-red-300 font-semibold'
  if (a >= 1.5) return pos ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'
  if (a >= 0.5) return pos ? 'bg-emerald-950/20 text-emerald-400' : 'bg-red-950/20 text-red-400'
  return pos ? 'text-emerald-500' : 'text-red-500'
}

function thresholdLabel(pct: number | undefined): { label: string; positive: boolean } | null {
  if (pct === undefined || Number.isNaN(pct)) return null
  const a = Math.abs(pct)
  const positive = pct >= 0
  if (a >= 5) return { label: '5%', positive }
  if (a >= 3) return { label: '3%', positive }
  if (a >= 2) return { label: '2%', positive }
  return null
}

function vixRowClass(ticker: string, price: number | undefined): string {
  if (ticker !== '^VIX' || price === undefined) return ''
  if (price >= 30) return 'bg-red-950/15'
  if (price <= 15) return 'bg-emerald-950/10'
  return ''
}

function labelForTicker(t: string): string {
  if (t === '^VIX') return 'VIX'
  const sector = SECTORS.find((s) => s.etf === t)
  if (sector) return sector.name
  const comm = COMMODITY_INSTRUMENTS.find((c) => c.ticker === t)
  if (comm) return comm.name
  if (t === 'SPY') return 'S&P 500'
  if (t === 'QQQ') return 'Nasdaq 100'
  if (t === 'IWM') return 'Russell 2000'
  if (t === 'DIA') return 'Dow 30'
  return t
}

function groupForTicker(t: string): 'macro' | 'sector' | 'commodity' {
  if (['SPY', 'QQQ', 'IWM', 'DIA', '^VIX'].includes(t)) return 'macro'
  if (SECTORS.some((s) => s.etf === t)) return 'sector'
  return 'commodity'
}

export default function DeskPage() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [intervalKey, setIntervalKey] = useState<keyof typeof REFRESH_MS>('normal')
  const [showWatchOnly, setShowWatchOnly] = useState(false)
  const [flashMap, setFlashMap] = useState<Record<string, number>>({})
  const { items: watchlist, has, hydrated } = useWatchlist()

  const prevQuotesRef = useRef<Record<string, Quote>>({})
  const flashTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const volAvgRef = useRef<Record<string, { sum: number; n: number }>>({})

  const param = useMemo(() => DESK_TICKERS.map(encodeURIComponent).join(','), [])

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`/api/prices?tickers=${param}`)
      const data = await res.json()
      if (data.quotes) {
        const map: Record<string, Quote> = {}
        data.quotes.forEach((row: Quote) => {
          map[row.ticker] = row
        })
        setQuotes(map)
        setLastUpdate(new Date())

        const prev = prevQuotesRef.current
        const flashed: string[] = []
        for (const ticker in map) {
          const row = map[ticker]
          const old = prev[ticker]
          if (old && old.price !== row.price) flashed.push(ticker)

          if (row.volume > 0) {
            const v = volAvgRef.current[ticker] ?? { sum: 0, n: 0 }
            if (v.n < 20) {
              v.sum += row.volume
              v.n += 1
            } else {
              v.sum = v.sum * (19 / 20) + row.volume * (1 / 20)
            }
            volAvgRef.current[ticker] = v
          }
        }
        if (flashed.length > 0) {
          const expiry = Date.now() + 600
          setFlashMap((prevMap) => {
            const next = { ...prevMap }
            for (const t of flashed) next[t] = expiry
            return next
          })
          for (const t of flashed) {
            const existing = flashTimersRef.current[t]
            if (existing) clearTimeout(existing)
            flashTimersRef.current[t] = setTimeout(() => {
              setFlashMap((prevMap) => {
                if (!prevMap[t]) return prevMap
                const next = { ...prevMap }
                delete next[t]
                return next
              })
              delete flashTimersRef.current[t]
            }, 600)
          }
        }
        prevQuotesRef.current = map
      }
    } catch {
      /* ignore */
    }
  }, [param])

  useEffect(() => {
    fetchPrices()
    const ms = REFRESH_MS[intervalKey]
    const id = setInterval(fetchPrices, ms)
    return () => clearInterval(id)
  }, [fetchPrices, intervalKey])

  useEffect(() => {
    return () => {
      for (const t in flashTimersRef.current) clearTimeout(flashTimersRef.current[t])
      flashTimersRef.current = {}
    }
  }, [])

  const isFlashing = useCallback(
    (t: string): boolean => {
      const expiry = flashMap[t]
      return expiry !== undefined && expiry > Date.now()
    },
    [flashMap],
  )

  const isVolumeSpike = useCallback((t: string, vol: number | undefined): boolean => {
    if (vol === undefined || vol <= 0) return false
    const v = volAvgRef.current[t]
    if (!v || v.n < 5) return false
    const avg = v.sum / v.n
    return avg > 0 && vol > avg * 2.5
  }, [])

  const rows = useMemo(() => {
    let list = [...DESK_TICKERS]
    if (showWatchOnly && hydrated) {
      const set = new Set(watchlist)
      list = list.filter((t) => set.has(t))
    }
    return list.map((t) => ({
      t,
      group: groupForTicker(t),
      label: labelForTicker(t),
      q: quotes[t],
      watch: has(t),
    }))
  }, [quotes, showWatchOnly, watchlist, hydrated, has])

  const groups: { key: 'macro' | 'sector' | 'commodity'; title: string }[] = [
    { key: 'macro', title: 'Macro & volatility' },
    { key: 'sector', title: 'GICS sector ETFs' },
    { key: 'commodity', title: 'Commodity proxies' },
  ]

  return (
    <div className="min-h-screen max-w-[1600px] mx-auto px-3 sm:px-4 py-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Trading desk</h1>
          <p className="text-xs text-slate-500 mt-1">
            High-density quote strip for floor-style monitoring. Pair with your vendor feeds for execution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['fast', 'normal', 'slow'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setIntervalKey(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border ${
                intervalKey === k
                  ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {k === 'fast' ? '2s' : k === 'normal' ? '5s' : '15s'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowWatchOnly((v) => !v)}
            disabled={!hydrated}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
              showWatchOnly ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            Watchlist only
          </button>
          <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
            {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
          </span>
        </div>
      </div>

      {groups.map(({ key, title }) => {
        const sectionRows = rows.filter((r) => r.group === key)
        if (sectionRows.length === 0) return null
        return (
          <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              {title}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800/80">
                    <th className="text-left px-2 py-1.5 w-16">Sym</th>
                    <th className="text-left px-2 py-1.5 min-w-[120px]">Name</th>
                    <th className="text-right px-2 py-1.5">Last</th>
                    <th className="text-right px-2 py-1.5">Chg</th>
                    <th className="text-right px-2 py-1.5 hidden sm:table-cell">%</th>
                    <th className="text-right px-2 py-1.5 hidden md:table-cell">Vol M</th>
                    <th className="text-center px-2 py-1.5">W</th>
                    <th className="text-left px-2 py-1.5">Drill</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.map(({ t, label, q }) => {
                    const up = (q?.changePct ?? 0) >= 0
                    const sym = t === '^VIX' ? 'VIX' : t
                    const flashing = isFlashing(t)
                    const flashCls = flashing ? 'bg-yellow-500/15' : ''
                    const heatCls = q ? pctHeatClass(q.changePct) : 'text-slate-600'
                    const tl = q ? thresholdLabel(q.changePct) : null
                    const spike = isVolumeSpike(t, q?.volume)
                    const vixCls = q ? vixRowClass(t, q.price) : ''
                    return (
                      <tr key={t} className={`border-b border-slate-800/40 hover:bg-slate-900/60 ${vixCls}`}>
                        <td className="px-2 py-1 text-slate-200 font-semibold">{sym}</td>
                        <td className="px-2 py-1 text-slate-500 truncate max-w-[180px]" title={label}>
                          {label}
                        </td>
                        <td className={`px-2 py-1 text-right text-slate-100 transition-colors duration-500 ${flashCls}`}>
                          {q ? q.price.toFixed(2) : '—'}
                        </td>
                        <td className={`px-2 py-1 text-right ${q ? (up ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                          {q ? `${up ? '+' : ''}${q.change.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-2 py-1 text-right hidden sm:table-cell transition-colors duration-500 ${heatCls} ${flashCls}`}>
                          {q ? `${up ? '+' : ''}${q.changePct.toFixed(2)}` : '—'}
                          {tl && (
                            <span
                              className={`ml-1 px-1 text-[10px] font-black rounded ${tl.positive ? 'bg-emerald-600' : 'bg-red-600'} text-white`}
                            >
                              {tl.label}
                            </span>
                          )}
                        </td>
                        <td
                          className={
                            spike
                              ? 'px-2 py-1 text-right hidden md:table-cell bg-cyan-950/50 text-cyan-300 font-semibold border-l-2 border-cyan-400'
                              : 'px-2 py-1 text-right text-slate-600 hidden md:table-cell'
                          }
                        >
                          {q && q.volume ? `${spike ? '⚡ ' : ''}${(q.volume / 1e6).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-2 py-1 text-center text-amber-500/90">{has(t) ? '★' : ''}</td>
                        <td className="px-2 py-1">
                          <Link href={`/stock/${t.replace(/^\^/, '').toLowerCase()}`} className="text-blue-400 hover:underline">
                            chart
                          </Link>
                          {SECTORS.some((s) => s.etf === t) && (
                            <>
                              {' · '}
                              <Link href={`/sector/${SECTORS.find((s) => s.etf === t)!.slug}`} className="text-slate-500 hover:text-slate-300">
                                sector
                              </Link>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
