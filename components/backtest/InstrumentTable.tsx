'use client'

import { useState, useMemo } from 'react'
import type { BacktestResult } from '@/lib/backtest/engine'

interface Props {
  results: BacktestResult[]
  sectorColors: Record<string, string>
}

type SortKey = 'ticker' | 'sector' | 'totalReturn' | 'annualizedReturn' | 'sharpeRatio' | 'maxDrawdown' | 'winRate' | 'totalTrades' | 'excessReturn'

function fmtPct(v: number, sign = true): string {
  const s = sign && v >= 0 ? '+' : ''
  return `${s}${(v * 100).toFixed(2)}%`
}

function fmtRatio(v: number | null): string {
  return v == null ? '—' : v === Infinity ? '∞' : v.toFixed(2)
}

export default function InstrumentTable({ results, sectorColors }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('annualizedReturn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterSector, setFilterSector] = useState<string>('All')
  const [filterAction, setFilterAction] = useState<string>('All')

  const sectors = useMemo(() => {
    const s = new Set(results.map(r => r.sector))
    return ['All', ...Array.from(s).sort()]
  }, [results])

  const filtered = useMemo(() => {
    let rows = results
    if (filterSector !== 'All') rows = rows.filter(r => r.sector === filterSector)
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [results, sortKey, sortDir, filterSector])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-600 ml-1">⇅</span>
    return <span className="text-cyan-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const cols: { key: SortKey; label: string; align?: string }[] = [
    { key: 'ticker', label: 'Ticker', align: 'text-left' },
    { key: 'sector', label: 'Sector', align: 'text-left' },
    { key: 'totalReturn', label: 'Return', align: 'text-right' },
    { key: 'annualizedReturn', label: 'Ann. Return', align: 'text-right' },
    { key: 'sharpeRatio', label: 'Sharpe', align: 'text-right' },
    { key: 'maxDrawdown', label: 'Max DD', align: 'text-right' },
    { key: 'winRate', label: 'Win Rate', align: 'text-right' },
    { key: 'totalTrades', label: 'Trades', align: 'text-right' },
    { key: 'excessReturn', label: 'Alpha', align: 'text-right' },
  ]

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterSector}
          onChange={e => setFilterSector(e.target.value)}
          className="bg-slate-800 text-slate-300 text-xs rounded-lg px-3 py-1.5 border border-slate-700"
        >
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-600 self-center">{filtered.length} instruments</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr>
              {cols.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-3 py-2.5 ${col.align ?? 'text-right'} text-slate-500 uppercase tracking-wider font-medium cursor-pointer hover:text-slate-300 select-none`}
                >
                  {col.label}<SortIcon k={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map(r => {
              const sectorColor = sectorColors[r.sector] ?? '#64748b'
              return (
                <tr key={r.ticker} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-white">{r.ticker}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: sectorColor, backgroundColor: sectorColor + '15' }}>
                      {r.sector}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-right font-medium ${r.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtPct(r.totalReturn)}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-right font-medium ${r.annualizedReturn >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                    {fmtPct(r.annualizedReturn)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-300">
                    {fmtRatio(r.sharpeRatio)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-red-400">
                    {r.maxDrawdown > 0 ? `−${(r.maxDrawdown * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-right ${r.winRate >= 0.5 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {r.totalTrades > 0 ? `${(r.winRate * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-400">
                    {r.totalTrades}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-right font-medium ${r.excessReturn > 0 ? 'text-cyan-400' : r.excessReturn < 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                    {fmtPct(r.excessReturn)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
