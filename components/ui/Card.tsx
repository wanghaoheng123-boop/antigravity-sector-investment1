'use client'

import React from 'react'

// ─── Card ─────────────────────────────────────────────────────────────────────
// Consistent card surface with optional header, subdued border, and padding variants.

interface CardProps {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'raised' | 'flat'
}

export function Card({
  children,
  title,
  subtitle,
  action,
  footer,
  className = '',
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const pad = {
    none: '',
    sm:   'p-3',
    md:   'p-4',
    lg:   'p-6',
  }[padding]

  const bg = {
    default: 'bg-slate-900/60 border border-slate-800/60',
    raised:  'bg-slate-900 border border-slate-800 shadow-md shadow-black/30',
    flat:    'bg-slate-900/30 border border-slate-800/40',
  }[variant]

  return (
    <div className={`rounded-xl ${bg} ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 border-b border-slate-800/60">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-200 truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {padding === 'none' ? children : <div className={pad}>{children}</div>}
      {footer && (
        <div className="px-4 py-2.5 border-t border-slate-800/60 bg-slate-900/40 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  )
}
