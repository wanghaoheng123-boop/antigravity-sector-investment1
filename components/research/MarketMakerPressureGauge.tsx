'use client'

interface MarketMakerPressureGaugeProps {
  hedgingBias: 'buy' | 'sell' | 'neutral'
  hedgingPressure: number   // -100 to +100
  smartMoneySignal?: 'accumulating' | 'distributing' | 'neutral'
  orderImbalance?: number  // -1 to 1
  dataVerification?: { source: string; confidence: number; timestamp: string }
}

export default function MarketMakerPressureGauge({
  hedgingBias,
  hedgingPressure,
  smartMoneySignal,
  orderImbalance,
}: MarketMakerPressureGaugeProps) {
  const normalizedPressure = Math.max(-100, Math.min(100, hedgingPressure))

  // Gauge: -100 (extreme sell) to +100 (extreme buy)
  const gaugeAngle = (normalizedPressure / 100) * 90 // -90 to +90 degrees
  const gaugeColor = normalizedPressure > 20
    ? '#22c55e'
    : normalizedPressure < -20
    ? '#ef4444'
    : '#f59e0b'

  const hedgeDescription = normalizedPressure > 50
    ? 'Aggressive buying required'
    : normalizedPressure > 20
    ? 'Moderate buying pressure'
    : normalizedPressure < -50
    ? 'Aggressive selling required'
    : normalizedPressure < -20
    ? 'Moderate selling pressure'
    : 'Near equilibrium'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-white">Market Maker Pressure</div>
        <div className={`text-xs font-bold font-mono ${
          hedgingBias === 'buy' ? 'text-green-400' : hedgingBias === 'sell' ? 'text-red-400' : 'text-amber-400'
        }`}>
          {hedgingBias === 'buy' ? 'DEALERS BUYING' : hedgingBias === 'sell' ? 'DEALERS SELLING' : 'NEUTRAL'}
        </div>
      </div>

      {/* Gauge SVG */}
      <div className="flex items-center justify-center py-2">
        <svg width="200" height="100" viewBox="0 0 200 100">
          {/* Background arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Colored arc segments */}
          {/* Red (sell) segment */}
          <path
            d="M 20 90 A 80 80 0 0 1 100 10"
            fill="none"
            stroke="#ef4444"
            strokeWidth="4"
            opacity="0.3"
          />
          {/* Green (buy) segment */}
          <path
            d="M 100 10 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            opacity="0.3"
          />

          {/* Center line */}
          <line x1="100" y1="90" x2="100" y2="15" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />

          {/* Needle */}
          <g transform={`rotate(${gaugeAngle}, 100, 90)`}>
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="20"
              stroke={gaugeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="90" r="6" fill={gaugeColor} />
            <circle cx="100" cy="90" r="3" fill="#0f172a" />
          </g>

          {/* Tick marks */}
          {[-75, -50, -25, 0, 25, 50, 75].map(deg => {
            const angle = (deg / 100) * 90 - 90
            const rad = (angle * Math.PI) / 180
            const x1 = 100 + 82 * Math.cos(rad)
            const y1 = 90 + 82 * Math.sin(rad)
            const x2 = 100 + 74 * Math.cos(rad)
            const y2 = 90 + 74 * Math.sin(rad)
            return (
              <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="1" />
            )
          })}

          {/* Labels */}
          <text x="15" y="105" fontSize="8" fill="#ef4444" fontFamily="monospace">SELL</text>
          <text x="87" y="10" fontSize="8" fill="#f59e0b" fontFamily="monospace">NEUTRAL</text>
          <text x="170" y="105" fontSize="8" fill="#22c55e" fontFamily="monospace">BUY</text>

          {/* Center value */}
          <text x="100" y="90" textAnchor="middle" fontSize="10" fill={gaugeColor} fontFamily="monospace" fontWeight="bold">
            {normalizedPressure > 0 ? '+' : ''}{normalizedPressure}
          </text>
        </svg>
      </div>

      {/* Hedging description */}
      <div className={`rounded border p-2 text-center text-xs font-medium ${
        normalizedPressure > 20
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : normalizedPressure < -20
          ? 'border-red-500/30 bg-red-500/10 text-red-400'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
      }`}>
        {hedgeDescription} — {normalizedPressure > 0 ? 'Must buy stock to hedge' : normalizedPressure < 0 ? 'Must sell stock to hedge' : 'No significant hedging required'}
      </div>

      {/* Smart money */}
      {smartMoneySignal && smartMoneySignal !== 'neutral' && (
        <div className={`rounded border p-2 text-center text-xs font-medium ${
          smartMoneySignal === 'accumulating'
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {smartMoneySignal === 'accumulating' ? '🐂 SMART MONEY ACCUMULATING' : '🐻 SMART MONEY DISTRIBUTING'}
        </div>
      )}

      {/* Order imbalance */}
      {orderImbalance !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Order Imbalance</span>
            <span className={`font-mono ${orderImbalance > 0.2 ? 'text-green-400' : orderImbalance < -0.2 ? 'text-red-400' : 'text-slate-400'}`}>
              {orderImbalance > 0.2 ? 'BUY PRESSURE' : orderImbalance < -0.2 ? 'SELL PRESSURE' : 'BALANCED'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                orderImbalance > 0 ? 'bg-gradient-to-r from-slate-700 to-green-500' : 'bg-gradient-to-r from-red-500 to-slate-700'
              }`}
              style={{ width: `${50 + orderImbalance * 50}%` }}
            />
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="text-[10px] text-slate-600 leading-relaxed">
        When dealers sell options (write gamma), they must hedge by buying stock when price rises
        and selling when price falls. This creates directional pressure that can amplify moves.
      </div>
    </div>
  )
}
