'use client'

import { DarkPoolPrint } from '@/lib/sectors'

interface DarkPoolPanelProps {
  prints: DarkPoolPrint[]
  ticker: string
  color: string
}

export default function DarkPoolPanel({ prints, ticker, color }: DarkPoolPanelProps) {
  const bullishPrints = prints.filter(p => p.sentiment === 'BULLISH')
  const bearishPrints = prints.filter(p => p.sentiment === 'BEARISH')
  const totalBullishSize = bullishPrints.reduce((sum, p) => sum + p.size, 0)
  const totalSize = prints.reduce((sum, p) => sum + p.size, 0)
  const bullishPct = totalSize > 0 ? (totalBullishSize / totalSize) * 100 : 50

  const sentimentLabel = bullishPct > 60 ? 'ACCUMULATION' : bullishPct < 40 ? 'DISTRIBUTION' : 'NEUTRAL'
  const sentimentColor = bullishPct > 60 ? '#00d084' : bullishPct < 40 ? '#ff4757' : '#94a3b8'

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Dark Pool Vol</div>
          <div className="text-lg font-bold text-white font-mono">
            {(totalSize / 1e6).toFixed(2)}M
          </div>
          <div className="text-xs text-slate-500">shares today</div>
        </div>
        <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Sentiment</div>
          <div className="text-lg font-bold font-mono" style={{ color: sentimentColor }}>
            {sentimentLabel}
          </div>
          <div className="text-xs text-slate-500">{bullishPct.toFixed(0)}% bullish flow</div>
        </div>
        <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Block Prints</div>
          <div className="text-lg font-bold text-white font-mono">{prints.length}</div>
          <div className="text-xs text-slate-500">prints today</div>
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>BEARISH</span>
          <span className="text-slate-300 font-medium">Institutional Flow Distribution</span>
          <span>BULLISH</span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${bullishPct}%`,
              background: `linear-gradient(90deg, #ff4757 0%, ${color} 100%)`
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-red-400">{(100 - bullishPct).toFixed(0)}%</span>
          <span style={{ color }}>{bullishPct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Print Table */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Recent Block Prints ({ticker})</span>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Bullish
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block ml-1" /> Bearish
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-right px-3 py-2 font-medium">Size</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">vs VWAP</th>
                <th className="text-center px-3 py-2 font-medium">Type</th>
                <th className="text-center px-3 py-2 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {prints.slice(0, 10).map((print, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-slate-400">{print.time}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-white">
                    {(print.size / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-white">
                    ${print.price.toFixed(2)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${print.premium > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {print.premium > 0 ? '+' : ''}{(print.premium).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      print.type === 'SWEEP' ? 'bg-yellow-900/40 text-yellow-400' :
                      print.type === 'BLOCK' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {print.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${
                      print.sentiment === 'BULLISH' ? 'bg-blue-400 shadow-sm shadow-blue-400' :
                      print.sentiment === 'BEARISH' ? 'bg-purple-400 shadow-sm shadow-purple-400' :
                      'bg-slate-500'
                    }`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 text-xs text-slate-600 text-center border-t border-slate-800">
          Data synthesized from FINRA OTC Transparency | Updates every 15 min
        </div>
      </div>
    </div>
  )
}
