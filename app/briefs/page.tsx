'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SECTORS } from '@/lib/sectors'

interface SectorBrief {
  id: string
  sector: string
  sectorName: string
  fetchedAt: string
  lastUpdated: string | null
  price: number
  change: number
  changePct: number
  analystRating: string | null
  analystCount: number | null
  holdingsAvgChange: number
  dataQuality: 'live' | 'partial' | 'unavailable'
  dataQualityNote: string | null
  news: { title: string }[]
  signals: { key: string; value: string; impact: string }[]
  summary: string
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<SectorBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.allSettled(
      SECTORS.map(async s => {
        const r = await fetch(`/api/briefs/${encodeURIComponent(s.slug)}`)
        if (!r.ok) throw new Error(`${r.status}`)
        return { slug: s.slug, data: await r.json() as SectorBrief }
      })
    ).then(results => {
      if (cancelled) return
      const loaded: SectorBrief[] = []
      const errs: Record<string, string> = {}
      for (const res of results) {
        if (res.status === 'fulfilled') {
          loaded.push(res.value.data)
        } else {
          errs[res.status === 'rejected' ? 'unknown' : ''] = res.status === 'rejected' ? String(res.reason) : ''
        }
      }
      setBriefs(loaded.sort((a, b) => b.holdingsAvgChange - a.holdingsAvgChange))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
          ← Markets
        </Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Intelligence Briefs</h1>
        <p className="text-slate-500">
          Live sector intelligence sourced from Yahoo Finance — analyst ratings, top holdings,
          key statistics, and latest headlines. Refreshes every 5 minutes.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live data from Yahoo Finance
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {SECTORS.slice(0, 4).map(s => (
            <div key={s.slug} className="rounded-xl border border-slate-800 p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                  <div className="h-6 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && briefs.length === 0 && (
        <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-500">
          No briefs available. All Yahoo Finance requests failed.
        </div>
      )}

      <div className="space-y-4">
          {briefs.map(brief => {
            const sector = SECTORS.find(s => s.slug === brief.sector)
            if (!sector) return null

            const analystBadgeColor =
              brief.analystRating === 'BUY' ? '#00d084' :
              brief.analystRating === 'SELL' ? '#ff4757' :
              brief.analystRating === 'HOLD' ? '#fbbf24' : '#94a3b8'

            return (
              <Link key={brief.id} href={`/briefs/sector/${brief.sector}`}>
              <div className="group rounded-xl border border-slate-800 p-5 hover:border-slate-600 hover:bg-slate-900/40 transition-all">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `${sector.color}15`, border: `1px solid ${sector.color}30` }}
                  >
                    {sector.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${sector.color}20`, color: sector.color }}
                      >
                        {sector.name}
                      </span>
                      {brief.analystRating && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${analystBadgeColor}20`, color: analystBadgeColor }}
                        >
                          {brief.analystRating}
                        </span>
                      )}
                      {brief.dataQuality !== 'live' && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                        >
                          {brief.dataQuality === 'partial' ? '◐ Partial' : '✕ Unavailable'}
                        </span>
                      )}
                      <span className="text-xs text-slate-600">
                        {brief.lastUpdated
                          ? new Date(brief.lastUpdated).toLocaleString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    {/* Price line */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-white font-mono">${brief.price.toFixed(2)}</span>
                      <span
                        className="text-sm font-mono font-semibold"
                        style={{ color: brief.changePct >= 0 ? '#00d084' : '#ff4757' }}
                      >
                        {brief.changePct >= 0 ? '+' : ''}{brief.changePct.toFixed(2)}%
                      </span>
                      <span className="text-sm text-slate-500 font-mono">
                        {brief.change >= 0 ? '+' : ''}{brief.change.toFixed(2)}
                      </span>
                      <span className="ml-auto text-xs text-slate-500 font-mono">
                        H: ${((brief as Record<string, unknown>).high52w as number | null ?? 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{brief.summary}</p>

                    {/* Key signals row */}
                    {brief.signals.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {brief.signals.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            <span className="text-slate-500">{s.key}: </span>
                            <span style={{
                              color: s.impact === 'positive' ? '#00d084' : s.impact === 'negative' ? '#ff4757' : '#94a3b8'
                            }}>{s.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg shrink-0 self-center">→</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
