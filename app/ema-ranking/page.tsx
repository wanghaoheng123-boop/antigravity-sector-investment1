'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import EmaRankingTable, { type SortKey } from '@/components/EmaRankingTable'
import type { EmaRankingRow } from '@/lib/quant/emaRanking'
import { SPY500_SECTORS } from '@/lib/spy500'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RefreshCountdown, LastUpdatedBadge } from '@/components/ui/RefreshCountdown'

const PAGE_SIZE = 50
const POLL_MS = 5 * 60 * 1000   // 5 minutes

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportCsv(rows: EmaRankingRow[]) {
  const header = ['Rank','Ticker','Sector','Price','1D%','200EMA','EMA Δ%','EMA Slope%','20EMA','RSI14','Zone','Score']
  const csvRows = rows.map((r, i) => [
    i + 1,
    r.ticker,
    r.sector,
    r.price?.toFixed(2) ?? '',
    r.changePct?.toFixed(2) ?? '',
    r.ema200?.toFixed(2) ?? '',
    r.deviationPct?.toFixed(2) ?? '',
    r.slopePct?.toFixed(3) ?? '',
    r.ema20?.toFixed(2) ?? '',
    r.rsi14?.toFixed(1) ?? '',
    r.zone ?? '',
    r.score?.toFixed(4) ?? '',
  ])
  const csv = [header, ...csvRows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ema-ranking-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmaRankingPage() {
  const [rows, setRows] = useState<EmaRankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sector, setSector] = useState<string>('all')
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('deviationPct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const url = sector === 'all'
        ? '/api/ema-ranking'
        : `/api/ema-ranking?sector=${encodeURIComponent(sector)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: EmaRankingRow[] = await res.json()
      setRows(data)
      setLastUpdated(new Date())
      setPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ranking')
    } finally {
      setLoading(false)
    }
  }, [sector])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const id = setInterval(fetchData, POLL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toUpperCase()
    const base = q ? rows.filter(r => r.ticker.includes(q)) : rows
    return [...base].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      return sortDir === 'desc'
        ? (bv as number) - (av as number)
        : (av as number) - (bv as number)
    })
  }, [rows, filter, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">200EMA Strength Leaderboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              S&amp;P 500 universe ranked by EMA deviation and slope. Screening tool — not a trade signal.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* Live status + stock count */}
            <span className={`inline-flex items-center gap-1 text-sm ${loading ? 'text-yellow-400' : 'text-green-400'}`}>
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
              {loading ? 'Loading…' : `${filtered.length} stocks`}
            </span>
            {/* Last-updated badge */}
            <LastUpdatedBadge ts={lastUpdated} />
            {/* Countdown to next refresh */}
            <RefreshCountdown
              intervalMs={POLL_MS}
              lastUpdated={lastUpdated}
              onRefresh={() => { setLoading(true); void fetchData() }}
            />
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Ticker search */}
            <input
              type="text"
              placeholder="Filter ticker…"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(0) }}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
            />
            {/* Sector dropdown */}
            <select
              value={sector}
              onChange={e => { setSector(e.target.value); setPage(0) }}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Sectors</option>
              {SPY500_SECTORS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Export CSV */}
          {!loading && filtered.length > 0 && (
            <button
              onClick={() => exportCsv(filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-600 text-sm text-slate-300 hover:text-white transition-colors"
              title="Download filtered rows as CSV"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="opacity-70">
                <path d="M6.5 9L3 5.5h2.5V1h2v4.5H10L6.5 9z" fill="currentColor"/>
                <path d="M1 11h11v1.5H1V11z" fill="currentColor"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-950/60 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => { setLoading(true); void fetchData() }} className="ml-4 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Skeleton loading state */}
        {loading && (
          <SkeletonTable rows={12} cols={10} />
        )}

        {/* Empty state (no results after filter) */}
        {!loading && !error && filtered.length === 0 && (
          filter
            ? <EmptyState
                icon={<span>🔍</span>}
                title={`No results for "${filter}"`}
                description="Try a different ticker symbol or reset the sector filter."
                action={{ label: 'Clear filter', onClick: () => setFilter('') }}
              />
            : <EmptyState
                icon={<span>📊</span>}
                title="No data loaded"
                description="Data for this sector could not be fetched. Try All Sectors or refresh."
                action={{ label: 'Refresh', onClick: () => { setLoading(true); void fetchData() } }}
              />
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <EmaRankingTable
            rows={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            page={page}
            pageSize={PAGE_SIZE}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center gap-4 justify-center pt-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-sm transition-colors"
            >
              ← Prev
            </button>
            <span className="text-slate-400 text-sm">
              Page {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-sm transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[11px] text-slate-600 text-center pb-2">
          Data sourced from Yahoo Finance. EMA ranking is a quantitative screening tool only — not investment advice. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  )
}
