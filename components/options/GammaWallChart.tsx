'use client'

interface GammaStrikeLevel {
  strike: number
  callGamma: number
  putGamma: number
  netGamma: number
  callOi: number
  putOi: number
  callVolume: number
  putVolume: number
}

interface GammaWallChartProps {
  analysis: {
    gammaLadder: GammaStrikeLevel[]
    spotPrice: number
    callWallStrike: number
    putWallStrike: number
    gammaFlipStrike: number
    maxPainStrike: number
    totalGammaExposure: number
  }
  currentPrice: number
}

export default function GammaWallChart({ analysis, currentPrice: propPrice }: GammaWallChartProps) {
  const { gammaLadder, spotPrice, callWallStrike, putWallStrike, gammaFlipStrike, maxPainStrike, totalGammaExposure } = analysis

  if (!gammaLadder || gammaLadder.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center text-slate-500 text-sm">
        No gamma ladder data available
      </div>
    )
  }

  const price = spotPrice ?? propPrice

  const maxGamma = Math.max(...gammaLadder.map(l => Math.abs(l.netGamma)))

  // Filter to strikes within ±30% of spot
  const filteredLadder = gammaLadder.filter(l => Math.abs(l.strike - price) / price < 0.3)

  if (filteredLadder.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center text-slate-500 text-sm">
        Gamma ladder outside ±30% of spot price
      </div>
    )
  }

  const minStrike = Math.min(...filteredLadder.map(l => l.strike))
  const maxStrike = Math.max(...filteredLadder.map(l => l.strike))
  const strikeRange = maxStrike - minStrike || 1

  const svgWidth = 600
  const svgHeight = 200
  const chartPadding = { top: 20, right: 60, bottom: 30, left: 10 }
  const chartWidth = svgWidth - chartPadding.left - chartPadding.right
  const chartHeight = svgHeight - chartPadding.top - chartPadding.bottom

  function strikeX(strike: number): number {
    return chartPadding.left + ((strike - minStrike) / strikeRange) * chartWidth
  }

  function gammaY(netGamma: number): number {
    return chartPadding.top + chartHeight - (Math.abs(netGamma) / maxGamma) * chartHeight
  }

  const barWidth = Math.max(2, (chartWidth / filteredLadder.length) * 0.7)

  // Zero gamma line (gamma flip)
  const gammaFlipX = strikeX(gammaFlipStrike)

  // Spot price line
  const spotX = strikeX(price)

  // Call wall and put wall
  const callWallX = strikeX(callWallStrike)
  const putWallX = strikeX(putWallStrike)

  // Max pain
  const maxPainX = strikeX(maxPainStrike)

  // Determine hedging zones
  const aboveFlip = filteredLadder.filter(l => l.strike >= gammaFlipStrike)
  const belowFlip = filteredLadder.filter(l => l.strike <= gammaFlipStrike)
  const netGammaAbove = aboveFlip.reduce((s, l) => s + l.netGamma, 0)
  const netGammaBelow = belowFlip.reduce((s, l) => s + l.netGamma, 0)

  const dealersLongGamma = totalGammaExposure > Math.abs(netGammaAbove - netGammaBelow)
  const hedgeZoneColor = dealersLongGamma ? 'rgba(34,211,238,0.08)' : 'rgba(249,115,22,0.08)'
  const hedgeZoneLabel = dealersLongGamma
    ? 'DEALERS LONG GAMMA — STABILIZING'
    : 'DEALERS SHORT GAMMA — DESTABILIZING'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white">Gamma Exposure Ladder</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Net Gamma = Call Gamma − Put Gamma. Positive (green) = dealers long gamma.
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-bold ${dealersLongGamma ? 'text-cyan-400' : 'text-orange-400'}`}>
            {hedgeZoneLabel}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            GEX: {(totalGammaExposure / 1_000_000).toFixed(1)}M shares equiv
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Zero gamma zone shading */}
          <rect
            x={Math.min(callWallX, putWallX)}
            y={chartPadding.top}
            width={Math.abs(callWallX - putWallX)}
            height={chartHeight}
            fill={hedgeZoneColor}
          />

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map(pct => (
            <line
              key={pct}
              x1={chartPadding.left}
              y1={chartPadding.top + chartHeight * (1 - pct)}
              x2={chartPadding.left + chartWidth}
              y2={chartPadding.top + chartHeight * (1 - pct)}
              stroke="#334155"
              strokeWidth="0.5"
              strokeDasharray="2,4"
            />
          ))}

          {/* Zero gamma line (gamma flip) */}
          <line
            x1={gammaFlipX}
            y1={chartPadding.top}
            x2={gammaFlipX}
            y2={chartPadding.top + chartHeight}
            stroke="#a78bfa"
            strokeWidth="2"
            strokeDasharray="4,2"
          />

          {/* Gamma bars */}
          {filteredLadder.map((level, i) => {
            const x = strikeX(level.strike) - barWidth / 2
            const y = gammaY(level.netGamma)
            const height = Math.max(1, chartPadding.top + chartHeight - y)
            const isPositive = level.netGamma >= 0
            const barColor = isPositive ? '#22c55e' : '#ef4444'
            const opacity = 0.4 + (Math.abs(level.netGamma) / maxGamma) * 0.6

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={height}
                fill={barColor}
                opacity={opacity}
              />
            )
          })}

          {/* Spot price line */}
          <line
            x1={spotX}
            y1={chartPadding.top}
            x2={spotX}
            y2={chartPadding.top + chartHeight}
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {/* Call wall */}
          <line
            x1={callWallX}
            y1={chartPadding.top}
            x2={callWallX}
            y2={chartPadding.top + chartHeight}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4,2"
            opacity={0.8}
          />

          {/* Put wall */}
          <line
            x1={putWallX}
            y1={chartPadding.top}
            x2={putWallX}
            y2={chartPadding.top + chartHeight}
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeDasharray="4,2"
            opacity={0.8}
          />

          {/* Max Pain */}
          <line
            x1={maxPainX}
            y1={chartPadding.top}
            x2={maxPainX}
            y2={chartPadding.top + chartHeight}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4,2"
            opacity={0.8}
          />

          {/* X-axis labels */}
          {filteredLadder
            .filter((_, i) => i % Math.max(1, Math.floor(filteredLadder.length / 6)) === 0)
            .map((level, i) => (
              <text
                key={i}
                x={strikeX(level.strike)}
                y={svgHeight - 5}
                textAnchor="middle"
                fontSize="8"
                fill="#64748b"
                fontFamily="monospace"
              >
                {level.strike.toFixed(0)}
              </text>
            ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-slate-400">Positive Net Gamma (Dealers Long)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-slate-400">Negative Net Gamma (Dealers Short)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-2 border-dashed border-white" />
          <span className="text-slate-400">Spot Price ({price.toFixed(2)})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-2 border-dashed border-amber-400" />
          <span className="text-slate-400">Max Pain ({maxPainStrike.toFixed(2)})</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Gamma Flip', value: gammaFlipStrike.toFixed(2), color: 'text-purple-400', note: '0-gamma line' },
          { label: 'Call Wall', value: callWallStrike.toFixed(2), color: 'text-red-400', note: 'ceiling' },
          { label: 'Put Wall', value: putWallStrike.toFixed(2), color: 'text-green-400', note: 'floor' },
          { label: 'Max Pain', value: maxPainStrike.toFixed(2), color: 'text-amber-400', note: 'option pain' },
        ].map(item => (
          <div key={item.label} className="rounded border border-slate-800 bg-slate-900/60 p-2 text-center">
            <div className="text-[9px] text-slate-500">{item.label}</div>
            <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
            <div className="text-[8px] text-slate-600">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
