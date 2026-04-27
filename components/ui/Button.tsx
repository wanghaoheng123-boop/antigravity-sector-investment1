'use client'

import React from 'react'

// ─── Button ───────────────────────────────────────────────────────────────────
// Primary, secondary, ghost, and destructive variants with consistent sizing.

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variantCls = {
    primary:     'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border border-blue-600',
    secondary:   'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700',
    ghost:       'bg-transparent hover:bg-slate-800/60 active:bg-slate-800 text-slate-300 border border-transparent',
    destructive: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border border-rose-600',
  }[variant]

  const sizeCls = {
    xs: 'text-[11px] px-2 py-1 gap-1',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-sm px-5 py-2.5 gap-2',
  }[size]

  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-md font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantCls} ${sizeCls}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
