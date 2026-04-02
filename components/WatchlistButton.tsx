'use client'

import { Star } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'

export default function WatchlistButton({
  ticker,
  label,
  iconOnly = false,
  className = '',
}: {
  ticker: string
  label?: string
  iconOnly?: boolean
  className?: string
}) {
  const { toggle, has, hydrated } = useWatchlist()
  const on = has(ticker)

  return (
    <button
      type="button"
      onClick={() => toggle(ticker)}
      disabled={!hydrated}
      title={on ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors ${
        on
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
          : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
      } px-2.5 py-1.5 disabled:opacity-50 ${className}`}
    >
      <Star className={`w-3.5 h-3.5 ${on ? 'fill-amber-400 text-amber-400' : ''}`} />
      {!iconOnly && (label != null && label !== '' ? label : on ? 'Watching' : 'Watchlist')}
    </button>
  )
}
