'use client'

import { useState } from 'react'

export interface LiveQuoteData {
  ticker: string
  price?: number
  changePct?: number
  rsi14?: number | null
  atrPct?: number | null
  deviationPct?: number | null
  macdHist?: number | null
  bbPctB?: number | null
  regime?: string
  action?: 'BUY' | 'HOLD' | 'SELL'
  confidence?: number
}

export interface LiveQuoteCardProps extends LiveQuoteData {
  onRemove?: () => void
}

const REGIME_COLORS: Record<string, string> = {
  EXTREME_BULL: '#ef4444',
  EXTENDED_BULL: '#f97316',
  HEALTHY_BULL: '#22c55e',
  FIRST_DIP: '#84cc16',
  DEEP_DIP: '#eab308',
  BEAR_ALERT: '#f97316',
  CRASH_ZONE: '#ef4444',
  INSUFFICIENT_DATA: '#64748b',
}

const ACTION_COLORS: Record<string, string> = {
  BUY: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  HOLD: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  SELL: 'bg-red-500/20 border-red-500/40 text-red-400',
}

function IndicatorPill({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-mono font-medium ${color ?? 'text-slate-300'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function LiveQuoteCard({ ticker, price, changePct, rsi14, atrPct, deviationPct, macdHist, bbPctB, regime, action, confidence, onRemove }: LiveQuoteCardProps) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = () => {
    setRemoving(true)
    setTimeout(() => onRemove?.(), 200)
  }

  const changeColor = changePct != null ? (changePct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-400'

  const rsiColor = rsi14 != null
    ? rsi14 > 70 ? 'text-red-400' : rsi14 < 30 ? 'text-emerald-400' : 'text-slate-300'
    : undefined

  const regimeColor = regime ? (REGIME_COLORS[regime] ?? '#64748b') : undefined
  const regimeLabel = regime?.replace(/_/g, ' ')

  const actionClass = action ? ACTION_COLORS[action] ?? ACTION_COLORS.HOLD : undefined
  const indicators = [
    { label: 'RSI', value: rsi14 != null ? rsi14.toFixed(1) : undefined, color: rsiColor },
    { label: 'ATR%', value: atrPct != null ? `${atrPct.toFixed(1)}%` : undefined },
    { label: '200EMA', value: deviationPct != null ? `${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}%` : undefined },
    { label: 'MACD', value: macdHist != null ? `${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(3)}` : undefined },
    { label: 'BB%', value: bbPctB != null ? bbPctB.toFixed(2) : undefined },
  ].filter((x) => x.value != null)

  return (
    <div
      className={`bg-slate-900/60 rounded-xl border border-slate-800 p-4 relative transition-all duration-200 ${
        removing ? 'opacity-0 scale-95' : 'hover:border-slate-700'
      }`}
    >
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300 text-xs flex items-center justify-center transition-colors"
          title="Remove"
        >
          ×
        </button>
      )}

      {/* Ticker + Price row */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-lg font-bold font-mono text-white leading-tight">{ticker}</div>
          {regime && regimeColor && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium mt-0.5 inline-block"
              style={{ color: regimeColor, backgroundColor: regimeColor + '20' }}
            >
              {regimeLabel}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold font-mono text-white">
            {price != null ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          </div>
          {changePct != null && (
            <div className={`text-xs font-mono font-medium ${changeColor}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Indicator grid */}
      {indicators.length > 0 ? (
        <div className="grid grid-cols-5 gap-1 mb-3 py-2 border-y border-slate-800/60">
          {indicators.map((item) => (
            <IndicatorPill key={item.label} label={item.label} value={item.value} color={item.color} />
          ))}
        </div>
      ) : (
        <div className="mb-3 py-2 border-y border-slate-800/60 text-[10px] text-slate-500">
          Indicators unavailable in quote mode.
        </div>
      )}

      {/* Action + Confidence row */}
      <div className="flex items-center justify-between gap-2">
        {action && actionClass && (
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${actionClass}`}>
            {action}
          </span>
        )}
        {confidence != null && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] text-slate-600 uppercase tracking-wider">Conf</span>
            <div className="flex items-center gap-1">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confidence >= 70 ? 'bg-emerald-400' : confidence >= 55 ? 'bg-amber-400' : 'bg-slate-500'}`}
                  style={{ width: `${Math.min(100, confidence)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-medium text-slate-300">{confidence.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
