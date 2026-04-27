'use client'

import React, { useEffect, useState } from 'react'

// ─── RefreshCountdown ─────────────────────────────────────────────────────────
// Shows a countdown to the next auto-refresh, with a subtle circular progress arc.
// Counts down from `intervalMs`, resets when `lastUpdated` changes.

interface RefreshCountdownProps {
  intervalMs: number          // refresh interval in ms (e.g. 300_000 for 5 minutes)
  lastUpdated: Date | null    // timestamp of last data fetch — resets the counter
  onRefresh?: () => void      // optional manual refresh trigger
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

export function RefreshCountdown({
  intervalMs,
  lastUpdated,
  onRefresh,
  className = '',
  size = 'sm',
}: RefreshCountdownProps) {
  const [remaining, setRemaining] = useState(intervalMs)

  // Reset countdown when new data arrives
  useEffect(() => {
    setRemaining(intervalMs)
  }, [lastUpdated, intervalMs])

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1000))
    }, 1_000)
    return () => clearInterval(id)
  }, [])

  const seconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const label = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`
  const progress = 1 - remaining / intervalMs  // 0 (full) → 1 (empty)

  const sizeClasses = {
    xs: { text: 'text-[9px]', dot: 'w-1.5 h-1.5', gap: 'gap-1' },
    sm: { text: 'text-[10px]', dot: 'w-2 h-2', gap: 'gap-1.5' },
    md: { text: 'text-xs', dot: 'w-2.5 h-2.5', gap: 'gap-2' },
  }[size]

  const dotColor = remaining < 10_000 ? 'bg-amber-400' : 'bg-slate-500'

  return (
    <div className={`flex items-center ${sizeClasses.gap} text-slate-500 ${className}`}>
      {/* Animated dot */}
      <div
        className={`${sizeClasses.dot} rounded-full ${dotColor} transition-colors`}
        style={{
          animation: remaining < 10_000 ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      />
      <span className={sizeClasses.text}>
        {lastUpdated
          ? `Next refresh in ${label}`
          : 'Loading…'
        }
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh now"
          className="ml-1 text-slate-500 hover:text-slate-300 transition-colors text-[10px]"
        >
          ↻
        </button>
      )}
    </div>
  )
}

// ─── LastUpdatedBadge ─────────────────────────────────────────────────────────
// Simple "Updated X ago" badge (no countdown).

interface LastUpdatedBadgeProps {
  ts: Date | null
  className?: string
}

export function LastUpdatedBadge({ ts, className = '' }: LastUpdatedBadgeProps) {
  const [label, setLabel] = useState('—')

  useEffect(() => {
    const update = () => {
      if (!ts) { setLabel('—'); return }
      const diff = Math.floor((Date.now() - ts.getTime()) / 1000)
      if (diff < 10) setLabel('just now')
      else if (diff < 60) setLabel(`${diff}s ago`)
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`)
      else setLabel(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const id = setInterval(update, 10_000)
    return () => clearInterval(id)
  }, [ts])

  return (
    <span className={`text-[10px] text-slate-500 ${className}`}>
      Updated {label}
    </span>
  )
}
