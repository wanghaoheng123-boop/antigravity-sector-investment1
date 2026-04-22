'use client'

import type { InstitutionalRankingRow } from '@/lib/alpha/institutionalRanking'

interface Props {
  rows: InstitutionalRankingRow[]
}

function pct(v: number): string {
  return `${Math.round(v * 100)}`
}

export default function InstitutionalRankingBoard({ rows }: Props) {
  if (rows.length === 0) return null
  const top = rows.slice(0, 8)
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
          Institutional Early-Entry Ranking
        </h3>
        <span className="text-[10px] text-slate-500">Score: Return34 Risk18 OOS20 Timing10 Regime8 Persist5 Accum5</span>
      </div>
      <div className="space-y-2">
        {top.map((r, idx) => (
          <div key={r.ticker} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-white">{r.ticker}</span>
                <span className="text-[10px] text-slate-500">{r.sector}</span>
                <span className="text-[10px] px-1 py-0.5 rounded border border-slate-700 text-slate-400">{r.conviction}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  r.actionBias === 'accumulate'
                    ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                    : r.actionBias === 'watch'
                      ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                      : 'text-red-300 border-red-500/40 bg-red-500/10'
                }`}>
                  {r.actionBias.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-cyan-300">{pct(r.rankScore)}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2 text-[10px]">
              <div className="text-slate-500">Return <span className="text-slate-300">{pct(r.expectedReturnScore)}</span></div>
              <div className="text-slate-500">Risk <span className="text-slate-300">{pct(r.riskControlScore)}</span></div>
              <div className="text-slate-500">OOS <span className="text-slate-300">{pct(r.robustnessScore)}</span></div>
              <div className="text-slate-500">Timing <span className="text-slate-300">{pct(r.timingScore)}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
              <div className="text-slate-500">Regime <span className="text-slate-300">{pct(r.regimeScore)}</span></div>
              <div className="text-slate-500">Persist <span className="text-slate-300">{pct(r.persistenceScore)}</span></div>
              <div className="text-slate-500">Accum <span className="text-slate-300">{pct(r.accumulationScore)}</span></div>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{r.thesis}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
