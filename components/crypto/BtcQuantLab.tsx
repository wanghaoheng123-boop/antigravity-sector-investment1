'use client'

import { useState, useEffect } from 'react'
import { BtcCandle, calcRSI, calcMACD, calcEMA, calcBollingerBands, calcVWAP, interpretFundingRate, RAINBOW_BANDS, getRainbowBand } from '@/lib/crypto'

interface Props { candles: BtcCandle[] }

interface MetricsData {
  fundingRate: number | null
  nextFundingTime: string | null
  openInterest: number | null
  takerBuyVolume: number | null
  takerSellVolume: number | null
  longShortRatio: number | null
  longAccountPct: number | null
  shortAccountPct: number | null
  source: string
  fetchedAt: string
}

interface LiqData {
  totalLiquidations: number
  buyLiquidations: number
  sellLiquidations: number
  buyVolume: number
  sellVolume: number
  netDirection: string
  source: string
  fetchedAt: string
}

// ─── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
      <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6">
      <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest text-slate-400">{title}</h3>
      {children}
    </div>
  )
}

export default function BtcQuantLab({ candles }: Props) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [liq, setLiq] = useState<LiqData | null>(null)
  const [activeMetricTab, setActiveMetricTab] = useState<'funding' | 'liquidations' | 'signals'>('funding')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/crypto/btc/metrics').then(r => r.json()),
      fetch('/api/crypto/btc/liquidations').then(r => r.json()),
    ]).then(([m, l]) => {
      setMetrics(m)
      setLiq(l)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const closes = candles.map(c => c.close)
  const latestClose = closes[closes.length - 1] ?? 0
  const high20 = closes.length >= 20 ? Math.max(...closes.slice(-20)) : latestClose
  const low20 = closes.length >= 20 ? Math.min(...closes.slice(-20)) : latestClose

  const rsiValues = calcRSI(closes)
  const latestRSI = rsiValues[rsiValues.length - 1]
  const macdValues = calcMACD(closes)
  const latestMACD = macdValues[macdValues.length - 1]
  const ema20 = calcEMA(closes, 20)
  const latestEMA20 = ema20[ema20.length - 1]
  const ema50 = calcEMA(closes, 50)
  const latestEMA50 = ema50[ema50.length - 1]
  const bb = calcBollingerBands(closes)
  const latestBB = bb[bb.length - 1]
  const vwapData = calcVWAP(candles)
  const latestVWAP = vwapData[vwapData.length - 1]?.value ?? latestClose
  const fundingInfo = metrics?.fundingRate != null ? interpretFundingRate(metrics.fundingRate) : null

  // Rainbow model — approximate BTC rainbow from halving cycles
  const rainbowHigh = high20 * 1.5
  const rainbowLow = low20 * 0.6
  const rainbowBand = getRainbowBand(latestClose, rainbowHigh, rainbowLow)

  // Signal summary
  const signals = [
    {
      label: 'RSI(14)',
      value: latestRSI.toFixed(1),
      signal: latestRSI > 70 ? 'OVERBOUGHT' : latestRSI < 30 ? 'OVERSOLD' : 'NEUTRAL',
      color: latestRSI > 70 ? 'text-red-400' : latestRSI < 30 ? 'text-green-400' : 'text-slate-400',
    },
    {
      label: 'MACD Histogram',
      value: (latestMACD.histogram ?? NaN).toFixed(2),
      signal: (latestMACD.histogram ?? 0) > 0 ? 'BULLISH' : 'BEARISH',
      color: (latestMACD.histogram ?? 0) > 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'EMA 20 vs 50',
      value: latestEMA20 > latestEMA50 ? 'E20>E50 ↑' : 'E20<E50 ↓',
      signal: latestEMA20 > latestEMA50 ? 'BULLISH CROSS' : 'BEARISH CROSS',
      color: latestEMA20 > latestEMA50 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'VWAP',
      value: `$${latestVWAP.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      signal: latestClose > latestVWAP ? 'ABOVE VWAP ↑' : 'BELOW VWAP ↓',
      color: latestClose > latestVWAP ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'BB Position',
      value: latestBB.upper ? `${((latestClose - latestBB.lower) / (latestBB.upper - latestBB.lower) * 100).toFixed(0)}%` : 'N/A',
      signal: latestClose > latestBB.upper ? 'ABOVE UPPER BAND' : latestClose < latestBB.lower ? 'BELOW LOWER BAND' : 'WITHIN BANDS',
      color: latestClose > latestBB.upper ? 'text-red-400' : latestClose < latestBB.lower ? 'text-green-400' : 'text-slate-400',
    },
    {
      label: 'Funding Rate',
      value: metrics?.fundingRate != null ? `${(metrics.fundingRate * 100).toFixed(4)}%` : 'N/A',
      signal: fundingInfo?.signal ?? 'N/A',
      color: fundingInfo?.signal === 'BULLISH' ? 'text-green-400' : fundingInfo?.signal === 'BEARISH' ? 'text-red-400' : 'text-slate-400',
    },
    {
      label: 'OI Net Direction',
      value: liq?.netDirection ?? 'N/A',
      signal: liq?.netDirection === 'LONG_BIAS' ? 'MORE LONG LIQUIDATIONS' : liq?.netDirection === 'SHORT_BIAS' ? 'MORE SHORT LIQUIDATIONS' : 'N/A',
      color: liq?.netDirection === 'LONG_BIAS' ? 'text-red-400' : liq?.netDirection === 'SHORT_BIAS' ? 'text-green-400' : 'text-slate-400',
    },
    {
      label: 'Rainbow Band',
      value: rainbowBand.label,
      signal: 'STRATEGY',
      color: 'text-amber-400',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top signals grid */}
      <Section title="BTC Quant Signals">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {signals.map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</div>
              <div className={`text-base font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className={`text-[10px] mt-1 ${s.color}`}>{s.signal}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Metrics tabs */}
      <Section title="On-Chain & Derivatives Metrics">
        <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 mb-4 w-fit">
          {([['funding', 'Funding & OI'], ['liquidations', 'Liquidations'], ['signals', 'Analysis']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveMetricTab(tab)}
              className={`px-4 py-1.5 text-xs rounded-md transition-all ${activeMetricTab === tab ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeMetricTab === 'funding' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Funding Rate (8h)"
              value={metrics?.fundingRate != null ? `${(metrics.fundingRate * 100).toFixed(4)}%` : '—'}
              sub={metrics?.nextFundingTime ? `Next: ${new Date(metrics.nextFundingTime).toLocaleTimeString()}` : undefined}
              color={fundingInfo?.color ?? 'text-slate-400'}
            />
            <MetricCard
              label="Open Interest"
              value={metrics?.openInterest != null ? `$${(metrics.openInterest / 1e9).toFixed(2)}B` : '—'}
              sub="BTC notional open"
            />
            <MetricCard
              label="Long/Short Ratio"
              value={metrics?.longShortRatio != null ? metrics.longShortRatio.toFixed(2) : '—'}
              sub={metrics?.longAccountPct != null ? `Longs: ${(metrics.longAccountPct * 100).toFixed(1)}%` : undefined}
              color="text-slate-400"
            />
            <MetricCard
              label="Data Source"
              value="Binance"
              sub={metrics?.fetchedAt ? `Updated ${new Date(metrics.fetchedAt).toLocaleTimeString()}` : undefined}
              color="text-slate-500"
            />
          </div>
        )}

        {activeMetricTab === 'liquidations' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Large Trades (24h)"
              value={String(liq?.totalLiquidations ?? '—')}
              sub=">$100k notional"
              color="text-amber-400"
            />
            <MetricCard
              label="Buy (Long Liq)"
              value={liq?.buyVolume != null ? `$${(liq.buyVolume / 1e6).toFixed(1)}M` : '—'}
              sub={`${liq?.buyLiquidations ?? 0} trades`}
              color="text-red-400"
            />
            <MetricCard
              label="Sell (Short Liq)"
              value={liq?.sellVolume != null ? `$${(liq.sellVolume / 1e6).toFixed(1)}M` : '—'}
              sub={`${liq?.sellLiquidations ?? 0} trades`}
              color="text-green-400"
            />
            <MetricCard
              label="Net Bias"
              value={liq?.netDirection ?? '—'}
              sub="24h liquidation direction"
              color={liq?.netDirection === 'LONG_BIAS' ? 'text-red-400' : liq?.netDirection === 'SHORT_BIAS' ? 'text-green-400' : 'text-slate-400'}
            />
          </div>
        )}

        {activeMetricTab === 'signals' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              BTC analysis combines price-action signals (RSI, MACD, EMAs), on-chain derivatives data (funding rate, open interest, liquidations), and the Rainbow Chart model. Toggle individual indicators on the chart to see their levels.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Trend</div>
                <div className={`text-lg font-bold ${latestEMA20 > latestEMA50 ? 'text-green-400' : 'text-red-400'}`}>
                  {latestEMA20 > latestEMA50 ? '↑ BULLISH TREND' : '↓ BEARISH TREND'}
                </div>
                <div className="text-[10px] text-slate-600 mt-1">EMA20 ${latestEMA20.toLocaleString('en-US', { maximumFractionDigits: 0 })} · EMA50 ${latestEMA50.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Momentum</div>
                <div className={`text-lg font-bold ${latestRSI > 70 ? 'text-red-400' : latestRSI < 30 ? 'text-green-400' : 'text-slate-400'}`}>
                  RSI {latestRSI.toFixed(1)} — {latestRSI > 70 ? 'OVERBOUGHT' : latestRSI < 30 ? 'OVERSOLD' : 'NEUTRAL'}
                </div>
                <div className="text-[10px] text-slate-600 mt-1">MACD Histogram: {(latestMACD.histogram ?? 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Rainbow Stage</div>
                <div className={`text-lg font-bold`} style={{ color: rainbowBand.color === '#f59e0b' ? '#f59e0b' : undefined }}>
                  {rainbowBand.label}
                </div>
                <div className="text-[10px] text-slate-600 mt-1">Based on 20-week high/low range</div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Volatility</div>
                <div className={`text-lg font-bold text-slate-400`}>
                  {latestBB.upper ? `${((latestClose - latestBB.lower) / (latestBB.upper - latestBB.lower) * 100).toFixed(0)}%` : 'N/A'} BB Position
                </div>
                <div className="text-[10px] text-slate-600 mt-1">Upper: ${latestBB.upper?.toLocaleString('en-US', { maximumFractionDigits: 0 })} · Lower: ${latestBB.lower?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Disclaimer */}
      <div className="text-center text-[10px] text-slate-700">
        BTC signals are calculated from Binance public data and are for informational purposes only, not financial advice.
      </div>
    </div>
  )
}
