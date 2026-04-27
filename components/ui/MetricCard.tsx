'use client'

import React from 'react'
import { pnlClass } from '@/lib/design/tokens'

// ─── MetricCard ───────────────────────────────────────────────────────────────
// Compact numeric display card — label, big number, optional delta + sparkline slot.
// Used in simulator metric strip, backtest summary, ranking overview.

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: number            // percentage change (colors by sign)
  deltaLabel?: string       // override delta text, e.g. "vs SPY"
  hint?: string             // tooltip-style caption under value
  loading?: boolean
  tone?: 'default' | 'profit' | 'loss' | 'warn'
  icon?: React.ReactNode
  children?: React.ReactNode // sparkline slot
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  hint,
  loading = false,
  tone = 'default',
  icon,
  children,
  className = '',
  size = 'md',
}: MetricCardProps) {
  const valueCls = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size]

  const toneCls = {
    default: 'text-white',
    profit:  'text-emerald-400',
    loss:    'text-rose-400',
    warn:    'text-amber-400',
  }[tone]

  const deltaText = delta !== undefined && delta !== null
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`
    : null

  return (
    <div className={`rounded-lg border border-slate-800/60 bg-slate-900/50 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium truncate">{label}</span>
        {icon && <span className="text-slate-500 flex-shrink-0">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-6 bg-slate-800/70 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono tabular-nums font-semibold ${valueCls} ${toneCls}`}>
            {value}
          </span>
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
      )}
      {(deltaText || deltaLabel || hint) && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          {deltaText && (
            <span className={`font-mono tabular-nums ${pnlClass(delta)}`}>{deltaText}</span>
          )}
          {deltaLabel && <span className="text-slate-500">{deltaLabel}</span>}
          {hint && !deltaText && !deltaLabel && <span className="text-slate-500 truncate">{hint}</span>}
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
