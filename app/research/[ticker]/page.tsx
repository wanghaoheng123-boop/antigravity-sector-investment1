'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import VerificationBadge from '@/components/research/VerificationBadge'
import GammaWallChart from '@/components/options/GammaWallChart'
import DeltaFlowChart from '@/components/research/DeltaFlowChart'
import MarketMakerPressureGauge from '@/components/research/MarketMakerPressureGauge'
import { RESEARCH_TEAM } from '@/lib/research/team'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SignalScore {
  type: string
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  evidence: string
  source: string
}

interface Verdict {
  overall: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  signals: SignalScore[]
  teamNarratives: { agent: string; narrative: string }[]
  keyLevels: { floor: number | null; ceiling: number | null }
  riskFactors: string[]
  opportunities: string[]
}

interface ResearchData {
  ticker: string
  spotPrice: number
  quoteTime: string
  change: number
  changePct: number
  regime: string
  sma200DevPct: number
  sma200Slope: number
  atr14: number
  floorCeiling: {
    floor: { price: number; strength: number; type: string; sources: string[]; distanceFromSpot: number } | null
    ceiling: { price: number; strength: number; type: string; sources: string[]; distanceFromSpot: number } | null
    vwapZone: { upper: number; mid: number; lower: number }
    bias: 'bullish' | 'bearish' | 'neutral'
    nearbyLevels: Array<{ price: number; strength: number; type: string; sources: string[] }>
  }
  marketMaker: {
    hedgingBias: 'buy' | 'sell' | 'neutral'
    hedgingPressure: number
    smartMoneySignal: 'accumulating' | 'distributing' | 'neutral'
    orderImbalance: number
    imbalanceDirection: string
  }
  delta: {
    totalDelta: number
    deltaRatio: number
    divergenceFound: boolean
    divergenceType: string
  }
  dataQuality: { anomalyCount: number }
  verdict: Verdict
  team: Array<{ id: string; name: string; specialty: string }>
}

interface OptionsData {
  ticker: string
  spotPrice: number
  quoteTime: string
  gamma: {
    totalGammaExposure: number
    netDelta: number
    totalVega: number
    totalTheta: number
    gammaFlipStrike: number
    maxPainStrike: number
    callWallStrike: number
    callWallStrength: number
    putWallStrike: number
    putWallStrength: number
    vannaExposure: number
    charmExposure: number
    zeroGammaLower: number
    zeroGammaUpper: number
  }
  interpretation: {
    dealerPosture: string
    hedgingBias: string
    marketImplication: string
  }
  gammaLadder: Array<{
    strike: number
    callGamma: number
    putGamma: number
    netGamma: number
    callOi: number
    putOi: number
    callVolume: number
    putVolume: number
  }>
  dataVerification: { source: string; confidence: number; methodology: string; timestamp: string }
}

interface DeltaData {
  recentBars: Array<{
    time: string
    close: number
    volume: number
    delta: number
    cumulativeDelta: number
    deltaPercent: number
  }>
  totalVolume: number
  totalDelta: number
  deltaRatio: number
  divergenceFound: boolean
  divergenceType: string
  divergenceStrength: number
}

function formatTs(ts: string): string {
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(d)
}

function regimeColor(regime: string): string {
  if (regime.includes('BULL')) return 'text-green-400'
  if (regime.includes('BEAR') || regime.includes('CRASH')) return 'text-red-400'
  if (regime === 'FLAT') return 'text-slate-400'
  return 'text-amber-400'
}

function directionBadge(d: 'bullish' | 'bearish' | 'neutral'): { label: string; color: string; bg: string } {
  if (d === 'bullish') return { label: 'BULLISH', color: 'text-green-400', bg: 'bg-green-400/10 border-green-500/30' }
  if (d === 'bearish') return { label: 'BEARISH', color: 'text-red-400', bg: 'bg-red-400/10 border-red-500/30' }
  return { label: 'NEUTRAL', color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-600/30' }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ResearchPage({ params }: { params: { ticker: string } }) {
  const { ticker } = params
  const [research, setResearch] = useState<ResearchData | null>(null)
  const [options, setOptions] = useState<OptionsData | null>(null)
  const [delta, setDelta] = useState<DeltaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'gamma' | 'delta' | 'signals'>('overview')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [researchRes, optionsRes, mmRes] = await Promise.allSettled([
        fetch(`/api/research/analysis/${encodeURIComponent(ticker)}`),
        fetch(`/api/options/chain/${encodeURIComponent(ticker)}`),
        fetch(`/api/market-maker/${encodeURIComponent(ticker)}`),
      ])

      if (researchRes.status === 'fulfilled' && researchRes.value.ok) {
        const data = await researchRes.value.json()
        setResearch(data)
      }

      if (optionsRes.status === 'fulfilled' && optionsRes.value.ok) {
        const data = await optionsRes.value.json()
        if (!data.error) setOptions(data)
      }

      if (mmRes.status === 'fulfilled' && mmRes.value.ok) {
        const data = await mmRes.value.json()
        if (!data.error) setDelta({ recentBars: data.recentBars, totalVolume: data.delta.totalVolume, totalDelta: data.delta.totalDelta, deltaRatio: data.delta.deltaRatio, divergenceFound: data.delta.divergenceFound, divergenceType: data.delta.divergenceType, divergenceStrength: data.delta.divergenceStrength })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-slate-400 text-sm">Running institutional analysis...</div>
          <div className="text-slate-600 text-xs">Dr. Sarah Chen · Marcus Webb · Elena Rodriguez · Dr. James Park · Aisha Patel</div>
        </div>
      </div>
    )
  }

  if (error || !research) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Analysis Failed</div>
          <div className="text-slate-500 text-sm mb-4">{error ?? 'No data returned'}</div>
          <button onClick={fetchAll} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { verdict } = research
  const verdictBadge = directionBadge(verdict.overall)
  const mmBias = research.marketMaker.hedgingBias

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top nav */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">← Markets</Link>
            <div className="text-lg font-bold font-mono">{ticker}</div>
            <div className="text-sm text-slate-400 font-mono">
              ${research.spotPrice.toFixed(2)}
              <span className={`ml-1 text-xs ${research.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {research.change >= 0 ? '+' : ''}{research.change.toFixed(2)} ({research.changePct.toFixed(2)}%)
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded border font-mono ${regimeColor(research.regime)} border-current/20`}>
              {research.regime.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{formatTs(research.quoteTime)}</span>
            <button onClick={fetchAll} className="hover:text-white transition-colors">↻ Refresh</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Research Verdict Banner */}
        <div className={`rounded-2xl border p-6 ${verdictBadge.bg}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-black font-mono ${verdictBadge.color}`}>
                {verdict.overall === 'bullish' ? '🐂' : verdict.overall === 'bearish' ? '🐻' : '⚖️'}
              </div>
              <div>
                <div className={`text-2xl font-bold ${verdictBadge.color}`}>
                  {verdict.overall.toUpperCase()} — {verdict.confidence}% CONFIDENCE
                </div>
                <div className="text-slate-400 text-sm mt-1">
                  Based on {verdict.signals.length} signals across {verdict.teamNarratives.length} analysts
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="text-center px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-xl font-bold text-green-400 font-mono">
                  {verdict.signals.filter(s => s.direction === 'bullish').length}
                </div>
                <div className="text-[10px] text-slate-500">Bullish</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-xl font-bold text-red-400 font-mono">
                  {verdict.signals.filter(s => s.direction === 'bearish').length}
                </div>
                <div className="text-[10px] text-slate-500">Bearish</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-xl font-bold text-slate-400 font-mono">
                  {verdict.signals.filter(s => s.direction === 'neutral').length}
                </div>
                <div className="text-[10px] text-slate-500">Neutral</div>
              </div>
            </div>
          </div>

          {/* Risk / Opportunity pills */}
          {verdict.riskFactors.length > 0 && (
            <div className="mt-4 space-y-1">
              {verdict.riskFactors.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-400">
                  <span>⚠️</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
          {verdict.opportunities.length > 0 && (
            <div className="mt-2 space-y-1">
              {verdict.opportunities.map((o, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-green-400">
                  <span>✨</span>
                  <span>{o}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Levels */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Floor (Support)', value: research.floorCeiling.floor?.price, color: 'text-green-400', bg: 'border-green-500/30', note: research.floorCeiling.floor?.sources.join(', ') },
            { label: 'Ceiling (Resistance)', value: research.floorCeiling.ceiling?.price, color: 'text-red-400', bg: 'border-red-500/30', note: research.floorCeiling.ceiling?.sources.join(', ') },
            { label: 'VWAP Zone Mid', value: research.floorCeiling.vwapZone.mid, color: 'text-cyan-400', bg: 'border-cyan-500/30', note: `±${((research.floorCeiling.vwapZone.upper - research.floorCeiling.vwapZone.mid) / research.floorCeiling.vwapZone.mid * 100).toFixed(1)}%` },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border bg-slate-900/60 p-4 ${item.bg}`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
              <div className={`text-2xl font-bold font-mono mt-1 ${item.color}`}>
                {item.value != null ? `$${item.value.toFixed(2)}` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{item.note}</div>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-slate-800">
          {([
            ['overview', 'Research Overview'],
            ['gamma', 'Gamma / Options'],
            ['delta', 'Delta Flow'],
            ['signals', `${verdict.signals.length} Signals`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Narratives */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Research Team Assessment</h3>
              {verdict.teamNarratives.map((entry, i) => {
                const agent = RESEARCH_TEAM.find(a => a.name === entry.agent)
                return (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{agent?.emoji ?? '👤'}</span>
                      <span className="text-sm font-bold text-white">{entry.agent}</span>
                      <span className="text-xs text-slate-500">{agent?.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{entry.narrative}</p>
                  </div>
                )
              })}
            </div>

            {/* Regime + MM summary */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Regime & Market Structure</h3>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">200SMA Deviation</span>
                  <span className={`text-sm font-mono font-bold ${research.sma200DevPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {research.sma200DevPct > 0 ? '+' : ''}{research.sma200DevPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">200SMA Slope</span>
                  <span className={`text-sm font-mono ${research.sma200Slope > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {research.sma200Slope > 0 ? '↑ Positive' : '↓ Negative'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">ATR(14)</span>
                  <span className="text-sm font-mono text-slate-300">${research.atr14.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Data Anomalies (1Y)</span>
                  <span className={`text-sm font-mono ${research.dataQuality.anomalyCount > 5 ? 'text-red-400' : research.dataQuality.anomalyCount > 2 ? 'text-amber-400' : 'text-green-400'}`}>
                    {research.dataQuality.anomalyCount} outliers
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">MM Hedging Bias</span>
                  <span className={`text-sm font-mono font-bold ${mmBias === 'buy' ? 'text-green-400' : mmBias === 'sell' ? 'text-red-400' : 'text-amber-400'}`}>
                    {mmBias.toUpperCase()}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white">Market Maker Pressure</h3>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <MarketMakerPressureGauge
                  hedgingBias={research.marketMaker.hedgingBias}
                  hedgingPressure={research.marketMaker.hedgingPressure}
                  smartMoneySignal={research.marketMaker.smartMoneySignal as 'accumulating' | 'distributing' | 'neutral'}
                  orderImbalance={research.marketMaker.orderImbalance}
                />
              </div>
            </div>
          </div>
        )}

        {/* Gamma tab */}
        {activeTab === 'gamma' && (
          <div className="space-y-6">
            {options ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total GEX', value: `${(options.gamma.totalGammaExposure / 1_000_000).toFixed(1)}M`, note: 'shares equiv' },
                    { label: 'Net Delta', value: `${(options.gamma.netDelta / 1_000_000).toFixed(1)}M`, note: 'shares' },
                    { label: 'Daily Theta', value: `${(options.gamma.totalTheta / 1_000_000).toFixed(1)}M`, note: 'burn/day' },
                    { label: 'Dealer Posture', value: options.interpretation.dealerPosture.replace('_', ' '), note: options.interpretation.hedgingBias },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
                      <div className="text-[9px] text-slate-500">{item.label}</div>
                      <div className="text-lg font-bold font-mono text-white mt-1">{item.value}</div>
                      <div className="text-[9px] text-slate-600">{item.note}</div>
                    </div>
                  ))}
                </div>

                <GammaWallChart
                  analysis={{
                    spotPrice: options.spotPrice,
                    totalGammaExposure: options.gamma.totalGammaExposure,
                    gammaFlipStrike: options.gamma.gammaFlipStrike,
                    maxPainStrike: options.gamma.maxPainStrike,
                    callWallStrike: options.gamma.callWallStrike,
                    putWallStrike: options.gamma.putWallStrike,
                    gammaLadder: options.gammaLadder,
                  }}
                  currentPrice={options.spotPrice}
                />

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-bold text-white mb-2">Dealer Positioning Interpretation</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{options.interpretation.marketImplication}</p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-500">
                Options data not available for {ticker}. ETFs and some securities may not have listed options.
              </div>
            )}
          </div>
        )}

        {/* Delta tab */}
        {activeTab === 'delta' && (
          <div className="space-y-6">
            {delta && delta.recentBars.length > 0 ? (
              <>
                <DeltaFlowChart
                  bars={delta.recentBars.map(b => ({
                    time: b.time,
                    open: b.close,
                    high: b.close,
                    low: b.close,
                    close: b.close,
                    volume: b.volume,
                    delta: b.delta,
                    cumulativeDelta: b.cumulativeDelta,
                    bidVolume: 0,
                    askVolume: 0,
                    deltaPercent: b.deltaPercent,
                  }))}
                  ticker={ticker}
                  divergenceFound={delta.divergenceFound}
                  divergenceType={delta.divergenceType as 'bullish' | 'bearish' | 'none'}
                  divergenceStrength={delta.divergenceStrength}
                />

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                    <div className="text-[9px] text-slate-500">Net Delta</div>
                    <div className={`text-xl font-bold font-mono mt-1 ${delta.totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {delta.totalDelta >= 0 ? '+' : ''}{(delta.totalDelta / 1_000_000).toFixed(2)}M
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                    <div className="text-[9px] text-slate-500">Delta Ratio</div>
                    <div className={`text-xl font-bold font-mono mt-1 ${delta.deltaRatio > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(delta.deltaRatio * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                    <div className="text-[9px] text-slate-500">Total Volume</div>
                    <div className="text-xl font-bold font-mono mt-1 text-slate-300">
                      {(delta.totalVolume / 1_000_000).toFixed(1)}M
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-500">
                Delta flow data not available for {ticker}
              </div>
            )}
          </div>
        )}

        {/* Signals tab */}
        {activeTab === 'signals' && (
          <div className="space-y-3">
            {verdict.signals.map((signal, i) => {
              const badge = directionBadge(signal.direction)
              return (
                <div key={i} className={`rounded-xl border p-4 ${badge.bg}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold font-mono ${badge.color}`}>{badge.label}</span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-400">{signal.type}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{signal.source}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{signal.evidence}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-black font-mono ${badge.color}`}>{signal.confidence}%</div>
                      <div className="text-[9px] text-slate-600">confidence</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
