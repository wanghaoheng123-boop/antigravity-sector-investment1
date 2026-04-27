'use client'

import React from 'react'
import { Card } from './Card'
import { Badge, ZoneBadge, ConvictionBadge } from './Badge'
import { MetricCard } from './MetricCard'
import { pnlClass } from '@/lib/design/tokens'

// ─── ResultsPanel ─────────────────────────────────────────────────────────────
// Professional results layout used across simulator, backtest, and ranking pages.
// Three zones: header (title + status), metric strip, content body.
// Designed so other agents can compose detail pages without re-inventing chrome.

interface ResultsPanelProps {
  title: string
  subtitle?: string
  status?: { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
  zone?: string | null
  conviction?: string | null
  metrics?: Array<{
    label: string
    value: string | number
    unit?: string
    delta?: number
    deltaLabel?: string
    tone?: 'default' | 'profit' | 'loss' | 'warn'
  }>
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function ResultsPanel({
  title,
  subtitle,
  status,
  zone,
  conviction,
  metrics,
  actions,
  children,
  className = '',
}: ResultsPanelProps) {
  return (
    <Card
      padding="none"
      className={className}
      title={
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {zone && <ZoneBadge zone={zone} size="xs" />}
          {conviction && <ConvictionBadge grade={conviction} size="xs" />}
          {status && <Badge tone={status.tone} size="xs">{status.label}</Badge>}
        </div>
      }
      subtitle={subtitle}
      action={actions}
    >
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 border-b border-slate-800/60">
          {metrics.map((m, i) => (
            <MetricCard
              key={i}
              label={m.label}
              value={m.value}
              unit={m.unit}
              delta={m.delta}
              deltaLabel={m.deltaLabel}
              tone={m.tone ?? 'default'}
              size="sm"
            />
          ))}
        </div>
      )}
      {children && <div className="p-4">{children}</div>}
    </Card>
  )
}

// ─── TradeStatsGrid ───────────────────────────────────────────────────────────
// Numeric statistics grid, e.g. for backtest summary: win rate, profit factor, etc.

export function TradeStatsGrid({
  stats,
  className = '',
}: {
  stats: Array<{ label: string; value: string | number; hint?: string; tone?: 'profit' | 'loss' | 'default' }>
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 ${className}`}>
      {stats.map((s, i) => (
        <div key={i} className="rounded-md bg-slate-900/40 border border-slate-800/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{s.label}</div>
          <div className={`font-mono tabular-nums text-base font-semibold ${
            s.tone === 'profit' ? 'text-emerald-400' :
            s.tone === 'loss'   ? 'text-rose-400' :
                                  'text-slate-100'
          }`}>{s.value}</div>
          {s.hint && <div className="text-[10px] text-slate-500 mt-0.5">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── PnlStatPill ──────────────────────────────────────────────────────────────
// Compact number + label pair with automatic P&L coloring.

export function PnlStatPill({ label, value, isPercent = false }: { label: string; value: number; isPercent?: boolean }) {
  const formatted = isPercent ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : value.toFixed(2)
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono tabular-nums font-medium ${pnlClass(value)}`}>{formatted}</span>
    </div>
  )
}
