'use client'

import type { DeltaBar } from '@/lib/quant/marketMakerAnalysis'

interface DeltaFlowChartProps {
  bars: DeltaBar[]
  ticker: string
  divergenceFound?: boolean
  divergenceType?: 'bullish' | 'bearish' | 'none'
  divergenceStrength?: number
}

export default function DeltaFlowChart({
  bars,
  ticker,
  divergenceFound = false,
  divergenceType = 'none',
  divergenceStrength = 0,
}: DeltaFlowChartProps) {
  if (!bars || bars.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center text-slate-500 text-sm">
        No delta flow data available
      </div>
    )
  }

  const recentBars = bars.slice(-50) // last 50 bars

  const maxVolume = Math.max(...recentBars.map(b => b.volume))
  const maxDelta = Math.max(...recentBars.map(b => Math.abs(b.delta)))
  const maxCumDelta = Math.max(...recentBars.map(b => Math.abs(b.cumulativeDelta)))

  const svgWidth = 600
  const svgHeight = 200
  const volHeight = 50
  const deltaHeight = 80
  const cumDeltaHeight = 40
  const gap = 10
  const padding = { top: 10, right: 50, bottom: 10, left: 10 }
  const chartWidth = svgWidth - padding.left - padding.right

  function barX(i: number): number {
    return padding.left + (i / (recentBars.length - 1)) * chartWidth
  }

  function volumeH(v: number): number {
    return (v / maxVolume) * volHeight
  }

  function deltaH(d: number): number {
    return (Math.abs(d) / maxDelta) * deltaHeight
  }

  function cumDeltaY(d: number): number {
    // Center in cumDelta section
    const sectionTop = padding.top + volHeight + gap + deltaHeight + gap
    const mid = sectionTop + cumDeltaHeight / 2
    return mid - (d / maxCumDelta) * (cumDeltaHeight / 2)
  }

  const totalDelta = recentBars.length > 0 ? recentBars[recentBars.length - 1].cumulativeDelta : 0
  const totalVolume = recentBars.reduce((s, b) => s + b.volume, 0)
  const deltaRatio = totalVolume > 0 ? totalDelta / totalVolume : 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white">Cumulative Delta Flow</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Green = buyer-initiated volume. Red = seller-initiated. Cumulative delta tracks net institutional flow.
          </div>
        </div>
        <div className="text-right">
          {divergenceFound && (
            <div className={`text-xs font-bold ${divergenceType === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
              {divergenceType === 'bullish' ? '🐂 BULLISH DIVERGENCE' : '🐻 BEARISH DIVERGENCE'}
              <span className="ml-1 text-slate-400 font-normal">({divergenceStrength}%)</span>
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-0.5">
            Net Delta: <span className={`font-mono font-bold ${totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalDelta >= 0 ? '+' : ''}{(totalDelta / 1_000_000).toFixed(1)}M
            </span>
            {' '}Ratio: <span className="font-mono text-slate-400">{(deltaRatio * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Volume section */}
        <g transform={`translate(0, ${padding.top})`}>
          <text x={padding.left} y={10} fontSize="8" fill="#64748b" fontFamily="monospace">VOLUME</text>
          {recentBars.map((bar, i) => {
            const x = barX(i)
            const h = volumeH(bar.volume)
            const isUp = bar.close >= bar.open
            return (
              <rect
                key={i}
                x={x - 3}
                y={volHeight - h}
                width={6}
                height={h}
                fill={isUp ? '#22c55e' : '#ef4444'}
                opacity={0.4 + (bar.volume / maxVolume) * 0.6}
              />
            )
          })}
        </g>

        {/* Delta section */}
        <g transform={`translate(0, ${padding.top + volHeight + gap})`}>
          <text x={padding.left} y={10} fontSize="8" fill="#64748b" fontFamily="monospace">DELTA/BAR</text>
          {/* Zero line */}
          <line
            x1={padding.left}
            y1={deltaHeight / 2}
            x2={padding.left + chartWidth}
            y2={deltaHeight / 2}
            stroke="#334155"
            strokeWidth="0.5"
          />
          {recentBars.map((bar, i) => {
            const x = barX(i)
            const h = deltaH(bar.delta)
            const y = bar.delta >= 0 ? deltaHeight / 2 - h : deltaHeight / 2
            return (
              <rect
                key={i}
                x={x - 3}
                y={y}
                width={6}
                height={Math.max(1, h)}
                fill={bar.delta >= 0 ? '#22c55e' : '#ef4444'}
                opacity={0.6}
              />
            )
          })}
        </g>

        {/* Cumulative Delta section */}
        <g transform={`translate(0, ${padding.top + volHeight + gap + deltaHeight + gap})`}>
          <text x={padding.left} y={10} fontSize="8" fill="#64748b" fontFamily="monospace">CUM. DELTA</text>
          {/* Zero line */}
          <line
            x1={padding.left}
            y1={cumDeltaHeight / 2}
            x2={padding.left + chartWidth}
            y2={cumDeltaHeight / 2}
            stroke="#64748b"
            strokeWidth="1"
          />
          {/* Area chart */}
          <defs>
            <linearGradient id="deltaGradPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="deltaGradNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Path */}
          {recentBars.length > 1 && (() => {
            const pathPoints = recentBars.map((bar, i) => {
              const x = barX(i)
              const y = cumDeltaY(bar.cumulativeDelta)
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
            }).join(' ')

            return (
              <>
                <path
                  d={pathPoints}
                  fill="none"
                  stroke={totalDelta >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth="1.5"
                />
                {/* Fill area */}
                <path
                  d={`${pathPoints} L ${barX(recentBars.length - 1)} ${cumDeltaHeight / 2} L ${padding.left} ${cumDeltaHeight / 2} Z`}
                  fill={totalDelta >= 0 ? 'url(#deltaGradPos)' : 'url(#deltaGradNeg)'}
                />
              </>
            )
          })()}
        </g>

        {/* Y-axis labels */}
        <g>
          <text x={svgWidth - padding.right + 3} y={padding.top + volHeight / 2 + 3} fontSize="7" fill="#64748b" fontFamily="monospace">
            {Math.round(maxVolume / 1_000_000)}M
          </text>
          <text x={svgWidth - padding.right + 3} y={padding.top + volHeight + gap + deltaHeight / 2 + 3} fontSize="7" fill="#22c55e" fontFamily="monospace">
            +{Math.round(maxDelta / 1_000)}K
          </text>
          <text x={svgWidth - padding.right + 3} y={padding.top + volHeight + gap + deltaHeight / 2 + 12} fontSize="7" fill="#ef4444" fontFamily="monospace">
            -{Math.round(maxDelta / 1_000)}K
          </text>
        </g>
      </svg>

      {/* Interpretation */}
      <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="text-[10px] text-slate-500 mb-1">Interpretation</div>
        <div className="text-xs text-slate-300 leading-relaxed">
          {divergenceFound ? (
            divergenceType === 'bullish' ? (
              <span className="text-green-400">
                Price falling but delta rising = institutional accumulation. Smart money buying while retail sells.
              </span>
            ) : (
              <span className="text-red-400">
                Price rising but delta falling = institutional distribution. Smart money selling while retail buys.
              </span>
            )
          ) : (
            <span className="text-slate-400">
              Delta and price aligned — no divergence. Institutional and retail flow in same direction.
            </span>
          )}
          {' '}Net cumulative delta of{' '}
          <span className={`font-mono font-bold ${totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalDelta >= 0 ? '+' : ''}{(totalDelta / 1_000_000).toFixed(2)}M
          </span>
          {' '}shares over {recentBars.length} periods.
        </div>
      </div>
    </div>
  )
}
