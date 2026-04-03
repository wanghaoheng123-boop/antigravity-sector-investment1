'use client'

import { useState } from 'react'
import type { DataVerification } from '@/lib/research/dataVerification'

interface VerificationBadgeProps {
  verification: DataVerification
  compact?: boolean
}

const SOURCE_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}> = {
  yahoo: {
    label: 'Yahoo Finance',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-500/30',
    icon: '🔶',
  },
  bloomberg: {
    label: 'Bloomberg',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-500/30',
    icon: '🏛️',
  },
  finra: {
    label: 'FINRA',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-500/30',
    icon: '📋',
  },
  exchange: {
    label: 'Exchange',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-500/30',
    icon: '🗄️',
  },
  calculated: {
    label: 'Calculated',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-500/30',
    icon: '🔢',
  },
  model: {
    label: 'Model-Based',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-500/30',
    icon: '📐',
  },
  illustrative: {
    label: 'Illustrative',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-600/30',
    icon: '⚠️',
  },
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

function confidenceLabel(confidence: number): { text: string; color: string } {
  if (confidence >= 0.85) return { text: 'High', color: 'text-green-400' }
  if (confidence >= 0.6) return { text: 'Medium', color: 'text-amber-400' }
  return { text: 'Low', color: 'text-red-400' }
}

export default function VerificationBadge({ verification, compact = false }: VerificationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const config = SOURCE_CONFIG[verification.source] ?? SOURCE_CONFIG.illustrative
  const confLabel = confidenceLabel(verification.confidence)

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${config.bgColor} ${config.borderColor} ${config.color} hover:brightness-125 transition-all cursor-help`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
          <span className="opacity-60">{Math.round(verification.confidence * 100)}%</span>
        </button>

        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl text-left">
            <div className="text-xs font-bold text-white mb-2">{config.icon} {config.label} Data</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Confidence</span>
                <span className={`font-mono font-bold ${confLabel.color}`}>
                  {Math.round(verification.confidence * 100)}% — {confLabel.text}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Updated</span>
                <span className="font-mono text-slate-400">{formatTimestamp(verification.timestamp)}</span>
              </div>
              <div className="border-t border-slate-700 pt-1.5">
                <div className="text-[10px] text-slate-500 mb-1">Methodology</div>
                <div className="text-[10px] text-slate-300 leading-relaxed">{verification.methodology}</div>
              </div>
              {verification.rawFields && verification.rawFields.length > 0 && (
                <div className="border-t border-slate-700 pt-1.5">
                  <div className="text-[10px] text-slate-500 mb-1">Fields Used</div>
                  <div className="flex flex-wrap gap-1">
                    {verification.rawFields.slice(0, 8).map(field => (
                      <span key={field} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
              <div className="border-4 border-transparent border-t-slate-700" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold ${confLabel.color}`}>
            {Math.round(verification.confidence * 100)}%
          </span>
          <span className={`text-[10px] ${confLabel.color}`}>{confLabel.text}</span>
        </div>
      </div>
      <div className="text-[10px] text-slate-400 leading-relaxed">{verification.methodology}</div>
      {verification.rawFields && verification.rawFields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {verification.rawFields.slice(0, 10).map(field => (
            <span key={field} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
              {field}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-[9px] text-slate-600 font-mono">
        Updated: {formatTimestamp(verification.timestamp)}
      </div>
    </div>
  )
}
