'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const { items: watchlist, has, hydrated } = useWatchlist()

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
                    return (
                      <tr key={t} className="border-b border-slate-800/40 hover:bg-slate-900/60">
                        <td className="px-2 py-1 text-slate-200 font-semibold">{sym}</td>
                        <td className="px-2 py-1 text-slate-500 truncate max-w-[180px]" title={label}>
                          {label}
                        </td>
                        <td className="px-2 py-1 text-right text-slate-100">{q ? q.price.toFixed(2) : '—'}</td>
                        <td className={`px-2 py-1 text-right ${q ? (up ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                          {q ? `${up ? '+' : ''}${q.change.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-2 py-1 text-right hidden sm:table-cell ${q ? (up ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                          {q ? `${up ? '+' : ''}${q.changePct.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-2 py-1 text-right text-slate-600 hidden md:table-cell">
                          {q && q.volume ? (q.volume / 1e6).toFixed(2) : '—'}
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
