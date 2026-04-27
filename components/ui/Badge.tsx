'use client'

import React from 'react'
import { colors, zoneClass, convictionClass } from '@/lib/design/tokens'

// ─── Badge ────────────────────────────────────────────────────────────────────
// Inline pill for status, zones, conviction grades, tags.

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  tone?: BadgeTone
  size?: 'xs' | 'sm' | 'md'
  className?: string
  icon?: React.ReactNode
}

export function Badge({ children, tone = 'neutral', size = 'sm', className = '', icon }: BadgeProps) {
  const sizeCls = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size]

  const toneCls = colors.status[tone]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeCls} ${toneCls} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

// ─── ZoneBadge ────────────────────────────────────────────────────────────────
// Color-coded pill for regime zones (HEALTHY_BULL, CHOP, STRONG_BEAR, etc.)

export function ZoneBadge({ zone, size = 'sm', className = '' }: { zone: string | null | undefined; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const sizeCls = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size]
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeCls} ${zoneClass(zone)} ${className}`}>
      {zone ?? '—'}
    </span>
  )
}

// ─── ConvictionBadge ──────────────────────────────────────────────────────────
// A/B/C/D grade pill from institutional ranking.

export function ConvictionBadge({ grade, size = 'sm', className = '' }: { grade: string | null | undefined; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const sizeCls = {
    xs: 'text-[10px] px-1.5 py-0.5 min-w-[18px]',
    sm: 'text-[11px] px-2 py-0.5 min-w-[22px]',
    md: 'text-xs px-2.5 py-1 min-w-[26px]',
  }[size]
  return (
    <span className={`inline-flex items-center justify-center rounded-md border font-bold ${sizeCls} ${convictionClass(grade)} ${className}`}>
      {grade ?? '—'}
    </span>
  )
}
