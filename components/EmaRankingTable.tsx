'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import type { EmaRankingRow } from '@/lib/quant/emaRanking'

// ─── Zone colours ─────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, { bg: string; text: string }> = {
  EXTREME_BULL:   { bg: 'bg-purple-900/60', text: 'text-purple-300' },
  EXTENDED_BULL:  { bg: 'bg-green-900/60',  text: 'text-green-300'  },
  HEALTHY_BULL:   { bg: 'bg-emerald-900/60',text: 'text-emerald-300'},
  FIRST_DIP:      { bg: 'bg-yellow-900/60', text: 'text-yellow-300' },
  DEEP_DIP:       { bg: 'bg-orange-900/60', text: 'text-orange-300' },
  BEAR_ALERT:     { bg: 'bg-red-900/60',    text: 'text-red-300'    },
  CRASH_ZONE:     { bg: 'bg-red-950/80',    text: 'text-red-400'    },
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 60, h = 22
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const color = values[values.length - 1] >= values[0] ? '#4ade80' : '#f87171'
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

export type SortKey = keyof Pick<
  EmaRankingRow,
  'deviationPct' | 'slopePct' | 'rsi14' | 'changePct' | 'price' | 'score'
>

interface Column {
  key: SortKey | 'rank' | 'ticker' | 'ema200' | 'ema20' | 'zone' | 'sparkline'
  label: string
  sortable: boolean
}

const COLUMNS: Column[] = [
  { key: 'rank',        label: '#',          sortable: false },
  { key: 'ticker',      label: 'Ticker',     sortable: false },
  { key: 'price',       label: 'Price',      sortable: true  },
  { key: 'ema200',      label: '200EMA',     sortable: false },
  { key: 'deviationPct',label: 'EMA Δ%',    sortable: true  },
  { key: 'slopePct',    label: 'EMA Slope',  sortable: true  },
  { key: 'rsi14',       label: 'RSI(14)',    sortable: true  },
  { key: 'ema20',       label: '20EMA',      sortable: false },
  { key: 'zone',        label: 'Zone',       sortable: false },
  { key: 'changePct',   label: '1D %',       sortable: true  },
  { key: 'sparkline',   label: '30D',        sortable: false },
  { key: 'score',       label: 'Score',      sortable: true  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rows: EmaRankingRow[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  page: number
  pageSize: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmaRankingTable({ rows, sortKey, sortDir, onSort, page, pageSize }: Props) {
  const paged = useMemo(() => {
    const start = page * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])

  function fmt(v: number | null, decimals = 2, suffix = ''): string {
    if (v == null || !Number.isFinite(v)) return '—'
    return v.toFixed(decimals) + suffix
  }

  function colorPct(v: number | null) {
    if (v == null) return 'text-slate-400'
    return v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-slate-400'
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm text-slate-200">
        <thead className="bg-slate-800 text-xs uppercase text-slate-400 sticky top-0">
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`px-3 py-2 text-right first:text-left whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-white' : ''}`}
                onClick={() => col.sortable && onSort(col.key as SortKey)}
              >
                {col.label}
                {col.sortable && col.key === sortKey && (
                  <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {paged.map((row, idx) => {
            const globalRank = page * pageSize + idx + 1
            const zone = row.zone ?? 'HEALTHY_BULL'
            const zc = ZONE_COLORS[zone] ?? { bg: 'bg-slate-800', text: 'text-slate-300' }
            return (
              <tr key={row.ticker} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-3 py-2 text-slate-500 font-mono">{globalRank}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/stock/${row.ticker}`}
                    className="font-semibold text-blue-400 hover:underline"
                  >
                    {row.ticker}
                  </Link>
                  <div className="text-xs text-slate-500 truncate max-w-[80px]">{row.sector}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono">${fmt(row.price)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(row.ema200)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${colorPct(row.deviationPct)}`}>
                  {fmt(row.deviationPct, 2, '%')}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${colorPct(row.slopePct)}`}>
                  {fmt(row.slopePct, 3, '%')}
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmt(row.rsi14, 1)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(row.ema20)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${zc.bg} ${zc.text}`}>
                    {zone.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-mono ${colorPct(row.changePct)}`}>
                  {fmt(row.changePct, 2, '%')}
                </td>
                <td className="px-3 py-2">
                  <Sparkline values={row.sparkline} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-300">
                  {fmt(row.score, 3)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
