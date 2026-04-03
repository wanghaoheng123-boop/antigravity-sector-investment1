'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiUrl } from '@/lib/apiBase'
import LiveQuoteCard from '@/components/simulator/LiveQuoteCard'
import SimulatorResults from '@/components/simulator/SimulatorResults'
import type { BacktestResult } from '@/lib/backtest/engine'
import type { StrategyConfig } from '@/lib/simulator/strategyConfig'
import {
  DEFAULT_STRATEGY_CONFIG,
  STRATEGY_PRESETS,
  type PresetName,
} from '@/lib/simulator/strategyConfig'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SimulatorApiResponse {
  runId: string
  computedAt: string
  config: StrategyConfig
  results: BacktestResult[]
  portfolio: {
    avgReturn: number
    avgAnnReturn: number
    bnhAvg: number
    alpha: number
    sharpeRatio: number | null
    sortinoRatio: number | null
    maxPortfolioDd: number
    winRate: number
    profitFactor: number
    avgTradeReturn: number
    totalTrades: number
    totalInstruments: number
    initialCapital: number
    finalCapital: number
  }
  liveQuotes?: Record<string, {
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
  }>
  tickers: Array<{ ticker: string; success: boolean; error?: string }>
}

type StrategyMode = 'regime' | 'momentum' | 'mean_reversion' | 'breakout'

// ─── Strategy Mode Descriptions ─────────────────────────────────────────────────

const STRATEGY_MODE_INFO: Record<StrategyMode, { title: string; desc: string; color: string; borderColor: string }> = {
  regime: {
    title: 'Regime Dip-Buy',
    desc: 'Buy when price dips below 200SMA into correction zones with bullish confirmations. The flagship institutional strategy.',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
  },
  momentum: {
    title: 'Momentum Breakout',
    desc: 'Buy when price breaks above SMA with positive slope. Does NOT dip-buy. Captures trending moves.',
    color: 'text-violet-400',
    borderColor: 'border-violet-500/30',
  },
  mean_reversion: {
    title: 'Mean Reversion',
    desc: 'Buy when price is statistically far below its mean (z-score entry). Sell when price reverts to mean.',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  breakout: {
    title: 'Breakout',
    desc: 'Buy on volume-confirmed price breakouts above recent consolidation. Sell on breakdown.',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
}

// ─── Default watchlist ──────────────────────────────────────────────────────────

const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'BTC-USD', 'GLD']
const MAX_WATCHLIST = 20

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtPct(v: number, sign = true): string {
  const s = sign && v >= 0 ? '+' : ''
  return `${s}${(v * 100).toFixed(2)}%`
}

// ─── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-center">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color ?? 'text-white'}`}>{value}</div>
    </div>
  )
}

// ─── Strategy Builder (inline) ─────────────────────────────────────────────────

function StrategyBuilder({
  config,
  onChange,
}: {
  config: StrategyConfig
  onChange: (cfg: StrategyConfig) => void
}) {
  const [activePreset, setActivePreset] = useState<PresetName>('Balanced')
  const [strategyMode, setStrategyMode] = useState<StrategyMode>(config.strategyMode.strategyMode)

  const update = useCallback((patch: Partial<StrategyConfig>) => {
    onChange({ ...config, ...patch })
  }, [config, onChange])

  const updatePreset = (name: PresetName) => {
    const preset = STRATEGY_PRESETS.find(p => p.name === name)
    if (preset) {
      setActivePreset(name)
      setStrategyMode(preset.config.strategyMode.strategyMode)
      onChange(preset.config)
    }
  }

  const updateMode = (mode: StrategyMode) => {
    setStrategyMode(mode)
    onChange({
      ...config,
      strategyMode: { ...config.strategyMode, strategyMode: mode },
    })
  }

  return (
    <div className="space-y-5">
      {/* Preset selector */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strategy Preset</div>
        <div className="grid grid-cols-2 gap-2">
          {STRATEGY_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => updatePreset(preset.name)}
              className={`px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                activePreset === preset.name
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="font-bold text-white mb-0.5">{preset.name}</div>
              <div className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{preset.description.slice(0, 80)}…</div>
            </button>
          ))}
        </div>
      </div>

      {/* Strategy mode */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strategy Mode</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(STRATEGY_MODE_INFO) as [StrategyMode, typeof STRATEGY_MODE_INFO[StrategyMode]][]).map(([mode, info]) => (
            <button
              key={mode}
              onClick={() => updateMode(mode)}
              className={`px-3 py-2 rounded-lg border text-left transition-all ${
                strategyMode === mode
                  ? `${info.borderColor} bg-slate-800/60`
                  : 'border-slate-700/40 bg-slate-800/20 hover:border-slate-600'
              }`}
            >
              <div className={`text-xs font-bold mb-0.5 ${strategyMode === mode ? info.color : 'text-slate-400'}`}>
                {info.title}
              </div>
              <div className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">{info.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Key parameters */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Position Sizing</div>
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Kelly Mode</span>
            <select
              value={config.positionSizing.kellyMode}
              onChange={e => update({
                positionSizing: {
                  ...config.positionSizing,
                  kellyMode: e.target.value as 'full' | 'half' | 'quarter' | 'fixed',
                },
              })}
              className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600"
            >
              <option value="half">Half-Kelly (Recommended)</option>
              <option value="quarter">Quarter-Kelly</option>
              <option value="full">Full Kelly</option>
              <option value="fixed">Fixed Size</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Max Position</span>
            <select
              value={config.positionSizing.maxKellyFraction}
              onChange={e => update({
                positionSizing: {
                  ...config.positionSizing,
                  maxKellyFraction: parseFloat(e.target.value),
                },
              })}
              className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600"
            >
              <option value="0.10">10%</option>
              <option value="0.15">15%</option>
              <option value="0.20">20%</option>
              <option value="0.25">25%</option>
              <option value="0.40">40%</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Confidence Threshold</span>
            <span className="text-xs font-mono text-cyan-400">
              {config.positionSizing.confidenceScales[0]?.confidenceThreshold ?? 55}%
            </span>
          </div>
        </div>
      </div>

      {/* Stop Loss */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Risk Management</div>
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ATR Stop Multiplier</span>
            <span className="text-xs font-mono text-amber-400">{config.stopLoss.stopLossAtrMultiplier}×</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Stop Floor</span>
            <span className="text-xs font-mono text-slate-300">{(config.stopLoss.stopLossFloor * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Stop Ceiling</span>
            <span className="text-xs font-mono text-slate-300">{(config.stopLoss.stopLossCeiling * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Max Portfolio DD</span>
            <span className="text-xs font-mono text-red-400">−{(config.stopLoss.maxDrawdownCap * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Entry confirmations */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Confirmations</div>
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Min Confirmations</span>
            <span className="text-xs font-mono text-white">{config.confirmations.minConfirmations} of 4</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">RSI Buy Threshold</span>
            <span className="text-xs font-mono text-emerald-400">&lt;{config.confirmations.rsiBullThreshold}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">RSI Sell Threshold</span>
            <span className="text-xs font-mono text-red-400">&gt;{config.confirmations.rsiBearThreshold}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ATR% Threshold</span>
            <span className="text-xs font-mono text-slate-300">&gt;{config.confirmations.atrBullThreshold}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">BB% Threshold</span>
            <span className="text-xs font-mono text-slate-300">&lt;{(config.confirmations.bbBullThreshold * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Lookback period */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Backtest Period</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={config.backtestPeriod.lookbackYears}
            onChange={e => update({
              backtestPeriod: {
                ...config.backtestPeriod,
                lookbackYears: parseInt(e.target.value),
              },
            })}
            className="flex-1 accent-cyan-500"
          />
          <span className="text-xs font-mono text-cyan-400 w-16 text-right">
            {config.backtestPeriod.lookbackYears}Y
          </span>
        </div>
        <div className="text-[10px] text-slate-600 mt-1">
          ~{config.backtestPeriod.lookbackYears * 252} trading days
        </div>
      </div>
    </div>
  )
}

// ─── Main Simulator Page ─────────────────────────────────────────────────────────

function SimulatorPageContent() {
  const searchParams = useSearchParams()

  // Parse URL params
  const urlTickers = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  const urlPreset = searchParams.get('preset') as PresetName | null

  // Initial config from preset or default
  const initialConfig = (() => {
    if (urlPreset) {
      const preset = STRATEGY_PRESETS.find(p => p.name.toLowerCase() === urlPreset.toLowerCase())
      return preset?.config ?? DEFAULT_STRATEGY_CONFIG
    }
    return DEFAULT_STRATEGY_CONFIG
  })()

  const [config, setConfig] = useState<StrategyConfig>(initialConfig)
  const [watchlist, setWatchlist] = useState<string[]>(
    urlTickers.length > 0 ? urlTickers : DEFAULT_WATCHLIST,
  )
  const [tickerQuery, setTickerQuery] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const [liveQuotes, setLiveQuotes] = useState<Record<string, {
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
  }>>({})

  const [results, setResults] = useState<SimulatorApiResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  // Refresh live quotes every 60s
  const refreshLiveQuotes = useCallback(async () => {
    if (watchlist.length === 0) return
    try {
      const res = await fetch(
        apiUrl(`/api/simulator/run`),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, tickers: watchlist, lookbackDays: 5 }) },
      )
      if (!res.ok) return
      const json: SimulatorApiResponse = await res.json()
      if (json.liveQuotes) setLiveQuotes(prev => ({ ...prev, ...json.liveQuotes }))
      setLastRefreshed(new Date())
      setSecondsAgo(0)
    } catch { /* silent */ }
  }, [config, watchlist])

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(s => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (watchlist.length > 0) void refreshLiveQuotes()
    }, 60_000)
    return () => clearInterval(interval)
  }, [refreshLiveQuotes, watchlist])

  // Initial live quote fetch
  useEffect(() => {
    if (watchlist.length > 0) void refreshLiveQuotes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Run simulation
  const runSimulation = async () => {
    if (watchlist.length === 0) {
      setError('Add at least one ticker to your watchlist.')
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/simulator/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, tickers: watchlist, lookbackDays: config.backtestPeriod.lookbackYears * 252 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const json: SimulatorApiResponse = await res.json()
      setResults(json)
      if (json.liveQuotes) setLiveQuotes(json.liveQuotes)
      setShowResults(true)
      setLastRefreshed(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setRunning(false)
    }
  }

  // Watchlist management
  const addTicker = (ticker: string) => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    if (watchlist.includes(t)) return
    if (watchlist.length >= MAX_WATCHLIST) {
      setError(`Maximum ${MAX_WATCHLIST} tickers allowed.`)
      return
    }
    setWatchlist(prev => [...prev, t])
    setTickerQuery('')
  }

  const removeTicker = (ticker: string) => {
    setWatchlist(prev => prev.filter(t => t !== ticker))
  }

  const clearWatchlist = () => setWatchlist([])

  const modeInfo = STRATEGY_MODE_INFO[config.strategyMode.strategyMode] ?? STRATEGY_MODE_INFO.regime

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div
        className="border-b border-slate-800 py-6"
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, transparent 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-white text-lg font-bold">
                SIM
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Institutional Trading Simulator</h1>
                <p className="text-xs text-slate-400">Real-time strategy backtest · Yahoo Finance data · Live signals</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Strategy mode badge */}
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${modeInfo.borderColor} ${modeInfo.color}`}
                title={modeInfo.desc}
              >
                {modeInfo.title}
              </div>

              {/* Last updated */}
              {lastRefreshed && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Live quotes</div>
                  <div className="text-xs font-mono text-slate-400">
                    {secondsAgo < 5 ? 'Just now' : `${secondsAgo}s ago`}
                  </div>
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={() => void refreshLiveQuotes()}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700 hover:bg-slate-700"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Strategy info bar */}
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 border border-slate-800 rounded-lg px-4 py-2 bg-slate-900/40 mt-4">
            <span>
              <span className="text-slate-400">Strategy:</span>{' '}
              {config.strategyMode.strategyMode === 'regime' ? '200EMA Deviation Regime + RSI/MACD/ATR%/BB% Confirmations' :
               config.strategyMode.strategyMode === 'momentum' ? 'Momentum Breakout' :
               config.strategyMode.strategyMode === 'mean_reversion' ? 'Mean Reversion (z-score)' :
               'Breakout with Volume Confirmation'}
            </span>
            <span><span className="text-slate-400">Kelly:</span> {config.positionSizing.kellyMode === 'half' ? 'Half-Kelly' : config.positionSizing.kellyMode === 'quarter' ? 'Quarter-Kelly' : config.positionSizing.kellyMode === 'full' ? 'Full Kelly' : 'Fixed'}</span>
            <span><span className="text-slate-400">Stop Loss:</span> ATR {config.stopLoss.stopLossAtrMultiplier}×, {(config.stopLoss.stopLossFloor * 100).toFixed(0)}–{(config.stopLoss.stopLossCeiling * 100).toFixed(0)}%</span>
            <span><span className="text-slate-400">Lookback:</span> {config.backtestPeriod.lookbackYears} years</span>
            <span><span className="text-slate-400">Instruments:</span> {watchlist.length} selected</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left column: Strategy Builder (60%) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">Strategy Builder</h2>
                <button
                  onClick={() => setShowGuide(g => !g)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {showGuide ? '− Hide guide' : '+ How to use'}
                </button>
              </div>

              {showGuide && (
                <div className="mb-4 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-xs text-slate-400 space-y-2">
                  <div className="text-cyan-400 font-bold mb-1">How to use the Trading Simulator</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li><strong className="text-slate-300">Configure</strong> your strategy using the preset and mode selectors, or fine-tune individual parameters below.</li>
                    <li><strong className="text-slate-300">Build your watchlist</strong> by searching and adding tickers on the right panel.</li>
                    <li><strong className="text-slate-300">Run Simulation</strong> to backtest your strategy across all watchlist instruments.</li>
                    <li><strong className="text-slate-300">Review results</strong> in the tabs: Summary, Instruments, Trades, and Analysis.</li>
                    <li><strong className="text-slate-300">Iterate</strong> by adjusting parameters and re-running to improve performance.</li>
                  </ol>
                  <div className="border-t border-slate-700/50 pt-2 mt-2 space-y-1">
                    <div className="text-slate-300 font-medium">Strategy Modes:</div>
                    {Object.entries(STRATEGY_MODE_INFO).map(([mode, info]) => (
                      <div key={mode} className="flex items-start gap-2">
                        <span className={`font-bold ${info.color}`}>•</span>
                        <span><strong className="text-slate-300">{info.title}:</strong> {info.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <StrategyBuilder config={config} onChange={setConfig} />
            </div>
          </div>

          {/* Right column: Watchlist (40%) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Watchlist search */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
                  Watchlist
                  <span className="ml-2 text-xs font-mono text-slate-500">({watchlist.length}/{MAX_WATCHLIST})</span>
                </h2>
                {watchlist.length > 0 && (
                  <button
                    onClick={clearWatchlist}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Search input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tickerQuery}
                  onChange={e => setTickerQuery(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void addTicker(tickerQuery) }
                  }}
                  placeholder="Search ticker (e.g. TSLA, AMD)"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => void addTicker(tickerQuery)}
                  disabled={!tickerQuery.trim() || watchlist.includes(tickerQuery.trim().toUpperCase())}
                  className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs rounded-lg hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              {/* Ticker pills */}
              {watchlist.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {watchlist.map(t => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] rounded"
                    >
                      {t}
                      <button
                        onClick={() => removeTicker(t)}
                        className="text-cyan-400 hover:text-white ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Live quote cards */}
              <div className="space-y-2">
                {watchlist.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    <div className="text-lg mb-1">📋</div>
                    <div>Add tickers to your watchlist to see live prices</div>
                  </div>
                ) : (
                  watchlist.map(ticker => {
                    const lq = liveQuotes[ticker]
                    return (
                      <LiveQuoteCard
                        key={ticker}
                        ticker={ticker}
                        price={lq?.price}
                        changePct={lq?.changePct}
                        rsi14={lq?.rsi14}
                        atrPct={lq?.atrPct}
                        deviationPct={lq?.deviationPct}
                        macdHist={lq?.macdHist}
                        bbPctB={lq?.bbPctB}
                        regime={lq?.regime}
                        action={lq?.action}
                        confidence={lq?.confidence}
                        onRemove={() => removeTicker(ticker)}
                      />
                    )
                  })
                )}
              </div>
            </div>

            {/* Run Simulation button */}
            <button
              onClick={() => void runSimulation()}
              disabled={running || watchlist.length === 0}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all
                bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500
                text-white shadow-lg shadow-emerald-900/40
                disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none
                flex items-center justify-center gap-3"
            >
              {running ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Simulation…
                </>
              ) : (
                <>
                  <span className="text-xl">▶</span>
                  Run Simulation
                  {watchlist.length > 0 && (
                    <span className="text-xs font-normal opacity-70">({watchlist.length} instruments)</span>
                  )}
                </>
              )}
            </button>

            {/* Error message */}
            {error && (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 text-xs text-red-400">
                <div className="font-bold mb-1">Simulation Error</div>
                <div className="text-red-300">{error}</div>
                <button
                  onClick={() => { setError(null); void runSimulation() }}
                  className="mt-2 px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-300 rounded text-[10px]"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results section */}
        {showResults && results && (
          <div className="mt-8">
            <SimulatorResults
              results={results.results}
              portfolio={results.portfolio}
              config={results.config}
              liveQuotes={results.liveQuotes}
              computedAt={results.computedAt}
              runId={results.runId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Wrap in Suspense for useSearchParams
export default function SimulatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-500 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading simulator…</p>
        </div>
      </div>
    }>
      <SimulatorPageContent />
    </Suspense>
  )
}
