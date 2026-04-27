'use client'

import React from 'react'

// ─── EmptyState ───────────────────────────────────────────────────────────────
// Consistent empty-state component for tables, lists, and panels.
// Shows an icon, title, optional description, and optional action button.

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: { wrapper: 'py-6', icon: 'text-3xl mb-2', title: 'text-sm', desc: 'text-xs', btn: 'text-xs px-3 py-1' },
    md: { wrapper: 'py-10', icon: 'text-4xl mb-3', title: 'text-sm', desc: 'text-xs', btn: 'text-sm px-4 py-1.5' },
    lg: { wrapper: 'py-16', icon: 'text-5xl mb-4', title: 'text-base', desc: 'text-sm', btn: 'text-sm px-5 py-2' },
  }[size]

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses.wrapper} ${className}`}>
      {icon && (
        <div className={`${sizeClasses.icon} text-slate-500 select-none`}>
          {icon}
        </div>
      )}
      <p className={`font-medium text-slate-300 ${sizeClasses.title}`}>{title}</p>
      {description && (
        <p className={`mt-1 text-slate-500 max-w-xs ${sizeClasses.desc}`}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`mt-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium transition-colors ${sizeClasses.btn}`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// ─── NoResults ────────────────────────────────────────────────────────────────
// Simpler variant for filtered-empty search results.

export function NoResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<span>🔍</span>}
      title={`No results for "${query}"`}
      description="Try a different search term or reset the filter."
      size="sm"
    />
  )
}
