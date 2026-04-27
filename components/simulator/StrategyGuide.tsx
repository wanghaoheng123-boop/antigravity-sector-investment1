'use client'

import { useState, useMemo, useCallback, type ReactNode } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StrategyGuideProps {
  isOpen?: boolean
  onToggle?: () => void
  activeSection?: string | null
}

// ─── Theme constants ───────────────────────────────────────────────────────────

const ACCENT = 'text-cyan-400'
const MUTED = 'text-slate-400'
const BORDER = 'border-slate-700'
const BG_CARD = 'bg-slate-800/60'
const BG_HOVER = 'hover:bg-slate-700/50'
const BG_HEADER = 'bg-slate-800'
const BG_DARK = 'bg-slate-900'

// ─── SVG Chart Illustrations ──────────────────────────────────────────────────

function RegimeChartSvg() {
  return (
    <svg viewBox="0 0 280 100" className="w-full h-auto mt-2 mb-1">
      {/* Grid lines */}
      <line x1="0" y1="75" x2="280" y2="75" stroke="#334155" strokeWidth="1" />
      <line x1="0" y1="50" x2="280" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
      {/* SMA line */}
      <line x1="0" y1="60" x2="280" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
      {/* Price line */}
      <polyline
        points="0,55 30,52 60,58 90,50 120,45 150,48 180,35 200,30 220,28 250,20 280,15"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.5"
      />
      {/* Dip zones */}
      <rect x="150" y="48" width="30" height="20" fill="#f59e0b" fillOpacity="0.15" rx="2" />
      <rect x="200" y="30" width="30" height="30" fill="#f59e0b" fillOpacity="0.25" rx="2" />
      {/* Labels */}
      <text x="5" y="72" fill="#64748b" fontSize="7">SMA</text>
      <text x="155" y="46" fill="#f59e0b" fontSize="6">BUY</text>
      <text x="205" y="28" fill="#f59e0b" fontSize="6">DEEP</text>
    </svg>
  )
}

function MomentumChartSvg() {
  return (
    <svg viewBox="0 0 280 100" className="w-full h-auto mt-2 mb-1">
      {/* Grid */}
      <line x1="0" y1="80" x2="280" y2="80" stroke="#334155" strokeWidth="1" />
      {/* Range box */}
      <rect x="60" y="30" width="80" height="50" fill="#6366f1" fillOpacity="0.1" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" />
      {/* Breakout arrow */}
      <polyline
        points="60,55 100,52 140,50 145,48 150,45 155,30"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.5"
      />
      <polygon points="158,28 168,25 162,35" fill="#22d3ee" />
      {/* Volume bars */}
      <rect x="140" y="68" width="8" height="12" fill="#6366f1" fillOpacity="0.5" />
      <rect x="152" y="60" width="8" height="20" fill="#22d3ee" />
      <text x="100" y="25" fill="#6366f1" fontSize="7">Consolidation</text>
      <text x="165" y="20" fill="#22d3ee" fontSize="7">BREAKOUT</text>
    </svg>
  )
}

function MeanReversionChartSvg() {
  return (
    <svg viewBox="0 0 280 100" className="w-full h-auto mt-2 mb-1">
      {/* Mean line */}
      <line x1="0" y1="50" x2="280" y2="50" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5,3" />
      {/* Bollinger bands */}
      <line x1="0" y1="25" x2="280" y2="25" stroke="#6366f1" strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1="0" y1="75" x2="280" y2="75" stroke="#6366f1" strokeWidth="0.8" strokeDasharray="2,2" />
      {/* Price oscillating */}
      <polyline
        points="0,50 30,30 60,55 90,20 120,60 150,30 180,50 210,70 240,45 280,50"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.5"
      />
      {/* Buy/sell markers */}
      <circle cx="90" cy="20" r="4" fill="#f59e0b" />
      <circle cx="210" cy="70" r="4" fill="#ef4444" />
      <text x="84" y="15" fill="#f59e0b" fontSize="7">SELL</text>
      <text x="200" y="82" fill="#f59e0b" fontSize="7">BUY</text>
      <text x="0" y="22" fill="#6366f1" fontSize="6">+2σ</text>
      <text x="0" y="78" fill="#6366f1" fontSize="6">-2σ</text>
    </svg>
  )
}

function BreakoutChartSvg() {
  return (
    <svg viewBox="0 0 280 100" className="w-full h-auto mt-2 mb-1">
      {/* Range */}
      <rect x="50" y="35" width="100" height="40" fill="#6366f1" fillOpacity="0.08" stroke="#6366f1" strokeWidth="1" strokeDasharray="4,2" />
      {/* Volume spike */}
      <rect x="150" y="55" width="10" height="25" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="162" y="40" width="10" height="40" fill="#f59e0b" fillOpacity="0.8" />
      {/* Price breakout */}
      <polyline
        points="50,55 80,52 110,58 150,56 160,50 170,35 190,22 220,18 250,20"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.5"
      />
      <polygon points="195,18 205,15 200,25" fill="#22d3ee" />
      <text x="55" y="30" fill="#6366f1" fontSize="7">Range</text>
      <text x="165" y="15" fill="#22d3ee" fontSize="7">Volume + Price</text>
    </svg>
  )
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

interface SectionProps {
  id: string
  title: string
  icon: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}

function Section({ id, title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border ${BORDER} rounded-lg overflow-hidden mb-2`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${BG_HEADER} ${BG_HOVER} transition-colors text-left`}
      >
        <span className={ACCENT}>{icon}</span>
        <span className="font-medium text-slate-100 text-sm flex-1">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[8000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 py-3 space-y-3">{children}</div>
      </div>
    </div>
  )
}

// ─── Parameter Badge ──────────────────────────────────────────────────────────

function ParamBadge({ name, defaultVal, range }: { name: string; defaultVal: string; range: string }) {
  return (
    <div className="inline-flex flex-col bg-slate-700/40 rounded px-2 py-1 mr-2 mb-1">
      <span className="text-cyan-300 text-xs font-mono">{name}</span>
      <span className="text-slate-400 text-xs">default: <span className="text-slate-300">{defaultVal}</span></span>
      <span className="text-slate-500 text-xs">range: {range}</span>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 h-px bg-slate-700" />
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  )
}

function Callout({ type, children }: { type: 'info' | 'warn' | 'tip'; children: ReactNode }) {
  const colors = {
    info: 'border-cyan-500/30 bg-cyan-900/10',
    warn: 'border-amber-500/30 bg-amber-900/10',
    tip: 'border-emerald-500/30 bg-emerald-900/10',
  }
  const icons = {
    info: (
      <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warn: (
      <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    tip: (
      <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  }
  return (
    <div className={`flex gap-2 p-3 rounded-lg border ${colors[type]}`}>
      {icons[type]}
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StrategyGuide({ isOpen = true, onToggle, activeSection }: StrategyGuideProps) {
  const [search, setSearch] = useState('')

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }, [])

  const searchLower = search.toLowerCase()

  const filtered = useMemo(() => {
    if (!search.trim()) return null
    return searchLower
  }, [searchLower])

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 top-24 z-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Strategy Guide
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h2 className="font-semibold text-slate-100 text-sm">Strategy Guide</h2>
          </div>
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close guide"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search parameters, concepts..."
            className="w-full bg-slate-700/50 border border-slate-600 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">

        {/* ── 1. Strategy Modes ───────────────────────────────────────────── */}
        <Section
          id="strategy-modes"
          title="1 · Strategy Modes"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          defaultOpen
        >
          {/* Regime Trading */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">Regime Trading</span>
              <span className="text-xs bg-cyan-900/30 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/20">200EMA Deviation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Buy dips in established uptrends. The strategy classifies price into deviation zones based on how far it trades from the 200-period SMA. When price pulls back to the &ldquo;first dip&rdquo; or &ldquo;deep dip&rdquo; zone, and the 200SMA slope is positive, the regime is considered bullish — the entry is a buy-the-dip opportunity within a confirmed uptrend.
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-slate-400 font-medium">Core idea:</span> Not all dips are buys. Only dip-buy when the long-term trend (SMA slope) is healthy. This prevents catching falling knives in bear markets.
            </p>
            <RegimeChartSvg />
            <div className="grid grid-cols-2 gap-x-4 mt-1">
              <div className="text-xs text-slate-500"><span className="text-amber-400">Amber zones</span> = BUY (dip entry)</div>
              <div className="text-xs text-slate-500"><span className="text-slate-400">Gray line</span> = 200 SMA</div>
            </div>
          </div>

          <SectionDivider label="Momentum Mode" />

          <div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Momentum mode trades <span className="text-cyan-300">with</span> the trend rather than fading it. Entry fires when price breaks above the SMA with enough rate-of-change (momentum) over the lookback window. There is no dip-buying — the signal requires price to already be rising.
            </p>
            <MomentumChartSvg />
            <p className="text-xs text-slate-500 mt-1">
              Best for: strong trending markets (e.g., 2020–2021 bull runs). Underperforms in mean-reversion and range-bound regimes.
            </p>
          </div>

          <SectionDivider label="Mean Reversion Mode" />

          <div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mean reversion fades extremes. When price deviates more than N standard deviations from its rolling mean (z-score threshold), the strategy expects a statistical snap-back to the mean. This is the opposite of momentum — you are betting that extended moves will revert.
            </p>
            <MeanReversionChartSvg />
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-amber-400">Orange dot</span> = overbought extreme (SELL signal). <span className="text-cyan-400">Cyan dot</span> = oversold extreme (BUY signal). Dashed lines = ±2 standard deviations.
            </p>
          </div>

          <SectionDivider label="Breakout Mode" />

          <div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Captures explosive moves when price breaks above a consolidation range with volume confirmation. The strategy waits for price to trade above the highest high of the lookback period, and requires volume to exceed 1.5× the average volume of the consolidation — this prevents false breakouts.
            </p>
            <BreakoutChartSvg />
            <p className="text-xs text-slate-500 mt-1">
              The orange volume bars show the volume spike confirming the breakout. Without volume confirmation, breakout signals are rejected.
            </p>
          </div>

          <Callout type="tip">
            <span className="font-medium text-slate-200">Mode selection tip:</span> If you do not know which to choose, start with <span className="text-cyan-300">Regime Trading</span>. It has the longest track record in institutional quantitative finance and adapts across market cycles.
          </Callout>
        </Section>

        {/* ── 2. Moving Averages ──────────────────────────────────────────── */}
        <Section
          id="moving-averages"
          title="2 · Moving Averages & Regime"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">SMA Period (Simple Moving Average)</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The 200-period SMA is the industry standard for institutional trend-following. Price above the 200SMA = long-term uptrend; below = downtrend. Shorter periods (50, 100) are more reactive but produce noisier regime signals. The regime classifier needs at least 200 warmup bars before generating signals.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="smaPeriod" defaultVal="200" range="50–500" />
            </div>
            <Callout type="info">
              For indices and ETFs (SPY, QQQ): use 200. For individual stocks with shorter histories: 50 or 100 may be more practical.
            </Callout>
          </div>

          <SectionDivider label="Slope Threshold" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">SMA Slope Threshold</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The SMA slope measures whether the long-term trend is actually rising. A slope of 0.005 (0.5%) means the 200SMA must be rising at least 0.5% over the slope lookback window to qualify as a healthy uptrend. Below this threshold, the market is treated as &ldquo;flat&rdquo; and dip-buy signals are suppressed — even if price is below the SMA.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="smaSlopeThreshold" defaultVal="0.005" range="0.001–0.02" />
              <ParamBadge name="smaSlopeLookback" defaultVal="20" range="10–50" />
            </div>
            <Callout type="warn">
              Setting <span className="text-cyan-300 font-mono">smaSlopeThreshold</span> too high (e.g., &gt;0.01) will suppress almost all signals in volatile or sideways markets. Setting it too low (&lt;0.001) defeats the purpose of trend filtering.
            </Callout>
          </div>

          <SectionDivider label="Deviation Zones" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Deviation Zone Thresholds</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              These 7 thresholds partition the price-SMA relationship into regimes. The key insight is that you do NOT want to buy when price is extended (far above SMA, chasing). You want to buy when price has pulled back (dip zones) but the underlying trend is still healthy (positive slope).
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">EXTREME_BULL</span>
                <span className="text-red-400">&gt; +20%</span>
                <span className="text-slate-500">no buy (chasing)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">EXTENDED_BULL</span>
                <span className="text-amber-400">+10–20%</span>
                <span className="text-slate-500">hold</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">HEALTHY_BULL</span>
                <span className="text-emerald-400">0–+10%</span>
                <span className="text-slate-500">acceptable</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">FIRST_DIP</span>
                <span className="text-cyan-300">−10–0%</span>
                <span className="text-cyan-300">primary buy</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">DEEP_DIP</span>
                <span className="text-amber-300">−20–−10%</span>
                <span className="text-amber-300">high-conviction buy</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">BEAR_ALERT</span>
                <span className="text-orange-400">−30–−20%</span>
                <span className="text-slate-500">strongest confirmations needed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">CRASH_ZONE</span>
                <span className="text-red-400/70">&lt; −30%</span>
                <span className="text-slate-500">only if slope is positive</span>
              </div>
            </div>
            <Callout type="info">
              High-volatility assets (TQQQ, ARKK, MEME stocks) need wider negative bands — the defaults are calibrated for large-cap indices. Set <span className="text-cyan-300 font-mono">deepDipThreshold</span> to −25 or −30 for volatile assets.
            </Callout>
          </div>
        </Section>

        {/* ── 3. Entry Confirmations ─────────────────────────────────────── */}
        <Section
          id="confirmations"
          title="3 · Entry Confirmations"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">RSI — Relative Strength Index</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              RSI measures the magnitude of recent gains vs losses on a 0–100 scale. The <span className="text-cyan-300 font-mono">rsiBullThreshold</span> (default 35) is the oversold level — RSI must be at or below this for a bullish confirmation. The <span className="text-cyan-300 font-mono">rsiBearThreshold</span> (default 65) triggers sell/exit confirmations. Classic interpretation: below 30 = oversold (buy opportunity), above 70 = overbought (sell opportunity).
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-slate-300 font-medium">Divergence:</span> When price makes a new high but RSI makes a lower high (bearish divergence), it suggests momentum is weakening even in an uptrend. This is one of the most reliable leading signals in technical analysis.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="rsiPeriod" defaultVal="14" range="7–21" />
              <ParamBadge name="rsiBullThreshold" defaultVal="35" range="25–40" />
              <ParamBadge name="rsiBearThreshold" defaultVal="65" range="60–70" />
            </div>
          </div>

          <SectionDivider label="MACD" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">MACD — Moving Average Convergence Divergence</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              MACD consists of three components: the MACD line (12-period EMA − 26-period EMA), the Signal line (9-period EMA of MACD), and the Histogram (MACD − Signal). A bullish confirmation fires when the MACD histogram is positive — meaning the 12-period EMA is above the 26-period EMA, indicating short-term momentum is outperforming long-term.
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-slate-300 font-medium">Signal line crossover:</span> When MACD crosses above the Signal line = bullish. When MACD crosses below = bearish. The histogram bars visually represent the distance between MACD and Signal — growing bars mean momentum is strengthening.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="macdFast" defaultVal="12" range="8–16" />
              <ParamBadge name="macdSlow" defaultVal="26" range="20–30" />
              <ParamBadge name="macdSignal" defaultVal="9" range="6–12" />
            </div>
          </div>

          <SectionDivider label="ATR%" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">ATR — Average True Range</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              ATR measures average daily price range (high to low) over N periods, expressed as a percentage of price (ATR%). A higher ATR% means the asset has larger daily moves — suitable for swing trading. The <span className="text-cyan-300 font-mono">atrBullThreshold</span> (default 2.0%) filters out low-volatility regimes where price barely moves enough to generate profitable swing trade candidates.
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>ATR% &lt; 1.0%</span>
                <span className="text-red-400">Too quiet — low profit potential</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>ATR% 1.0–2.0%</span>
                <span className="text-amber-400">Moderate — acceptable</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>ATR% &gt; 2.0%</span>
                <span className="text-emerald-400">Good — suitable for swing trades</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="atrPeriod" defaultVal="14" range="10–30" />
              <ParamBadge name="atrBullThreshold" defaultVal="2.0%" range="1.0–4.0%" />
            </div>
          </div>

          <SectionDivider label="Bollinger Bands" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Bollinger Bands % (BB%)</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              BB% (Bollinger Percent) normalizes price position within the bands: BB% = (price − lower band) / (upper band − lower band). When BB% &lt; 0.20, price is in the lower 20% of its recent range — near the lower band — a bullish mean-reversion signal. BB% &gt; 0.80 means price is extended near the upper band (bearish).
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              The standard settings are 20-period SMA with 2 standard deviations. 68% of price action falls within ±1σ, 95% within ±2σ. When price walks outside the bands, it signals strong momentum — in the opposite direction of mean reversion.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="bbPeriod" defaultVal="20" range="10–30" />
              <ParamBadge name="bbStdDev" defaultVal="2" range="1.5–3.0" />
              <ParamBadge name="bbBullThreshold" defaultVal="0.20" range="0.10–0.40" />
            </div>
          </div>

          <SectionDivider label="minConfirmations" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Minimum Confirmations Required</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The strategy requires at least N of the 4 indicators (RSI, MACD, ATR, BB) to be bullish before issuing a BUY signal. Default is 2 — meaning at least half of the indicators must confirm. Setting this to 1 produces more trades (lower quality); setting to 3 or 4 produces very few, high-conviction trades.
            </p>
            <Callout type="tip">
              <span className="font-medium text-slate-200">Recommended:</span> Conservative = 3 confirmations. Balanced = 2. Aggressive = 1. More confirmations = fewer trades but higher win rate typically.
            </Callout>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="minConfirmations" defaultVal="2" range="1–4" />
            </div>
          </div>
        </Section>

        {/* ── 4. Stop Loss & Risk ────────────────────────────────────────── */}
        <Section
          id="stop-loss"
          title="4 · Stop Loss & Risk Management"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">ATR Multiplier — The Most Important Stop Parameter</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The ATR-multiplied stop is volatility-adaptive, meaning it automatically widens in volatile markets and tightens in calm markets. With <span className="text-cyan-300 font-mono">stopLossAtrMultiplier = 1.5</span> and ATR% = 2%, your stop is placed 3% from entry. If ATR% doubles to 4% (volatile day), the stop widens to 6% — preventing stop-out on normal volatility spikes.
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2 space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>1.0× ATR</span>
                <span className="text-red-400">Tight — high stop-out rate</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>1.5× ATR</span>
                <span className="text-emerald-400">Balanced — recommended default</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>2.0× ATR</span>
                <span className="text-amber-400">Wider — for volatile assets</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>3.0× ATR</span>
                <span className="text-slate-500">Very wide — position must have strong conviction</span>
              </div>
            </div>
            <Callout type="warn">
              A stop tighter than 1× ATR almost guarantees being stopped out by normal market noise. Never set below 0.5× ATR. The floor parameter prevents this.
            </Callout>
          </div>

          <SectionDivider label="Stop Loss Floor & Ceiling" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Stop Loss Floor / Ceiling</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The <span className="text-cyan-300 font-mono">stopLossFloor</span> (default 3%) prevents the stop from being unreasonably tight in low-volatility assets. Without a floor, a low-ATR stock might get a 1% stop — easily hit by random noise. The <span className="text-cyan-300 font-mono">stopLossCeiling</span> (default 15%) prevents you from taking a 25% loss on a volatile day thinking a wide stop is &ldquo;safe&rdquo; — it caps maximum risk per trade.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="stopLossFloor" defaultVal="3%" range="1–5%" />
              <ParamBadge name="stopLossCeiling" defaultVal="15%" range="8–25%" />
            </div>
          </div>

          <SectionDivider label="Trailing Stop" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Two-Stage Trailing Stop Logic</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The trailing stop uses two ATR-based profit-lock levels after entry:
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2 space-y-2">
              <div>
                <p className="text-xs text-amber-300 font-medium">Stage 1 — Lock partial profit (trailAtrMultiplier1)</p>
                <p className="text-xs text-slate-400">When price reaches entry + 2×ATR profit, the stop rises to lock in at least 1×ATR of profit above entry. You cannot lose on this trade anymore.</p>
              </div>
              <div>
                <p className="text-xs text-emerald-300 font-medium">Stage 2 — Tighten to break-even safety net (trailAtrMultiplier2)</p>
                <p className="text-xs text-slate-400">When price reaches entry + 4×ATR profit, the stop is raised to entry + 1×ATR. The position now has a guaranteed locked profit floor.</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="trailAtrMultiplier1" defaultVal="2" range="1.5–3" />
              <ParamBadge name="trailAtrMultiplier2" defaultVal="4" range="3–6" />
              <ParamBadge name="trailLockMultiplier" defaultVal="1" range="0.5–2" />
            </div>
          </div>

          <SectionDivider label="Max Drawdown Cap" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Portfolio-Level Circuit Breaker</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The <span className="text-cyan-300 font-mono">maxDrawdownCap</span> (default 25%) is a portfolio-level drawdown limit. If your equity curve drops 25% from its peak, all open positions are closed and no new entries are taken until the strategy is reset. This prevents the classic trading spiral: small losses → revenge trading → large losses → blowup.
            </p>
            <Callout type="warn">
              A 25% drawdown requires a 33% gain to recover. A 50% drawdown requires a 100% gain. Most traders underestimate how damaging drawdowns are to recovery. Conservative accounts should set this to 10–15%.
            </Callout>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="maxDrawdownCap" defaultVal="25%" range="10–40%" />
            </div>
          </div>
        </Section>

        {/* ── 5. Position Sizing ─────────────────────────────────────────── */}
        <Section
          id="position-sizing"
          title="5 · Position Sizing & Kelly Criterion"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Kelly Criterion — Optimal Bet Sizing</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Kelly Criterion calculates the optimal fraction of capital to risk on a single trade based on your win rate (W) and average win/loss ratio (R): <span className="text-cyan-300 font-mono">K = W − (1−W)/R</span>. If you win 55% of trades with 1.5× average win, Kelly = 0.55 − 0.45/1.5 = 0.25 (25% of capital per trade).
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-amber-400 font-medium">Full Kelly</span> is mathematically optimal for infinite repetition but has extreme volatility — a 25% Kelly fraction means a 1-in-4 adverse sequence can wipe you out. <span className="text-emerald-400 font-medium">Half-Kelly</span> (50% of the calculated fraction) reduces volatility by ~75% while retaining ~65% of the growth advantage. <span className="text-slate-400 font-medium">Quarter-Kelly</span> is for maximum safety.
            </p>
            <Callout type="info">
              <span className="font-medium text-slate-200">Kelly requires accurate inputs.</span> If your backtest shows 70% win rate, that is likely over-fitted. Use realistic win rates (45–55%) and conservative R multiples (1.5–2.0) when estimating Kelly fractions.
            </Callout>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="kellyMode" defaultVal="half" range="full/half/quarter/fixed" />
              <ParamBadge name="maxKellyFraction" defaultVal="25%" range="10–50%" />
            </div>
          </div>

          <SectionDivider label="Position Cap" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Single Position Concentration Limit</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The <span className="text-cyan-300 font-mono">positionCap</span> (default 25%) prevents any single trade from consuming more than 25% of your capital. This is a hard limit — even if Kelly says to bet 40%, the cap constrains it to 25%. Concentrating &gt;30% in one position is behaviorally dangerous and statistically reckless for a multi-asset portfolio.
            </p>
            <Callout type="warn">
              Never allocate more than 25% to a single trade. A 33% loss on one position requires a 50% gain on the rest of your portfolio just to break even. The 25% cap is not conservative — it is the outer boundary of reasonableness.
            </Callout>
          </div>

          <SectionDivider label="Confidence Scaling" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Signal Strength → Position Size</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The confidence scale table maps composite signal confidence (0–100) to Kelly fractions. High-conviction signals (90+ confidence) get a larger position (25% Kelly). Lower conviction signals (55–75) get smaller positions (10–15%). This means strong signals are bet more, weak signals are bet less — automatically adapting position size to your confidence in each setup.
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-300">90%+ confidence</span>
                <span className="text-slate-300">25% Kelly (max)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-cyan-300">75–89% confidence</span>
                <span className="text-slate-300">15% Kelly</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">55–74% confidence</span>
                <span className="text-slate-300">10% Kelly</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">&lt;55% confidence</span>
                <span className="text-slate-400">5% Kelly (minimum)</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 6. Options Filters ─────────────────────────────────────────── */}
        <Section
          id="options-filters"
          title="6 · Options Market Filters"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Options Data as Institutional Signal Filters</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Options market data provides a window into institutional positioning. The open interest at each strike, and the Greeks (gamma, vanna, charm), reveal where dealers and large players have hedged — and how they will behave when price moves. Options filters add this institutional intelligence to your entry signals.
            </p>
            <Callout type="info">
              Options filters require a live or end-of-day options data feed (e.g., from an options data provider). They are disabled by default — enable them when you have access to quality options data.
            </Callout>
          </div>

          <SectionDivider label="Call Wall & Put Wall" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Strike Walls — Gravitational Ceilings and Floors</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              A <span className="text-cyan-300">call wall</span> is a cluster of call open interest at a specific strike — it acts as a gravitational ceiling. When price trades above the call wall, market makers who sold those calls are forced to buy stock to hedge (gamma dynamics). This creates upward pressure. The <span className="text-cyan-300">put wall</span> (cluster of put OI) acts as a support floor — dealers must sell stock to hedge when price approaches a large put concentration.
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-slate-300 font-medium">requireCallWallClearance</span> = only buy when price is above the call wall (confirmed institutional bullishness). <span className="text-slate-300 font-medium">requirePutWallClearance</span> = only buy when price is above the put wall (strong support underneath).
            </p>
          </div>

          <SectionDivider label="Gamma Exposure (GEX)" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">GEX — The Most Important Options Greek for Direction</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gamma Exposure (GEX) = sum(gamma × open interest × contract multiplier) across all strikes. <span className="text-emerald-400">Positive GEX</span> means dealers are long gamma — as price rises, they must buy more stock (amplifying the move up); as price falls, they must sell (providing a floor). <span className="text-red-400">Negative GEX</span> means dealers are short gamma — they must sell into rallies and buy into dips, amplifying volatility in both directions.
            </p>
            <div className="mt-2 bg-slate-700/30 rounded p-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Positive GEX (&gt; 0)</span>
                <span className="text-emerald-400">Bullish — upward moves amplify</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Negative GEX (&lt; 0)</span>
                <span className="text-red-400">Bearish — volatile in both directions</span>
              </div>
            </div>
            <Callout type="tip">
              Institutional traders use positive GEX as a directional filter: only take long positions when GEX &gt; 0. This aligns your trade with dealer hedging flow that amplifies upward moves.
            </Callout>
          </div>

          <SectionDivider label="Vanna & Charm" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Vanna and Charm — Second-Order Greeks</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-cyan-300">Vanna</span> = ∂Delta/∂IV = ∂Vega/∂Spot — measures how delta changes when implied volatility changes, or how vega changes when price changes. Positive Vanna means delta increases as IV rises (good for long positions: upward moves bring more buying). <span className="text-cyan-300">Charm</span> = ∂Delta/∂Time = rate of delta decay per day. High charm means delta is eroding quickly — time is working against your position.
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-slate-300 font-medium">requirePositiveVanna</span> filters entries to only when Vanna &gt; 0, ensuring that rising volatility (which often accompanies price rises) works in your favor rather than against you.
            </p>
          </div>
        </Section>

        {/* ── 7. Market Microstructure ────────────────────────────────────── */}
        <Section
          id="microstructure"
          title="7 · Market Microstructure Filters"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Reading the Tape — Order Flow as a Signal</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Market microstructure filters add real-time order flow intelligence to entries. Instead of waiting for price to move (lagging), these filters read the bid/ask pressure and aggressive buyer/seller activity in real time. They require Level 2 / time-of-sale data feeds.
            </p>
          </div>

          <SectionDivider label="Order Imbalance" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Bid/Ask Volume Imbalance</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Order Imbalance (OI) = (bid volume − ask volume) / (bid volume + ask volume). A reading of +0.30 means the bid side has 30% more volume than the ask side — aggressive buyers are dominating. Signals are rejected when OI &lt; −0.30 (heavy selling pressure). This is a real-time flow indicator that can confirm or reject a price-based entry signal.
            </p>
            <div className="mt-2 flex flex-wrap">
              <ParamBadge name="maxOrderImbalance" defaultVal="0.3" range="0.1–0.5" />
            </div>
          </div>

          <SectionDivider label="Cumulative Delta" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Buyer vs Seller Aggression (Delta)</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cumulative Delta tracks whether trades are executing at the bid (aggressive selling) or at the ask (aggressive buying). Each trade has a &ldquo;delta&rdquo;: +1 if it occurred at the ask (buyer initiated), −1 if at the bid (seller initiated). <span className="text-emerald-400">Positive cumulative delta</span> means buyers are more aggressive — institutional buying is pushing price up. <span className="text-cyan-300 font-mono">requirePositiveDelta</span> filters entries to only when delta is confirming the direction.
            </p>
            <Callout type="tip">
              Delta divergence (price rising but delta turning negative) often precedes reversals — even if your price-based indicators are bullish, negative delta says &ldquo;buyers are exhausted.&rdquo; This makes delta a powerful leading indicator.
            </Callout>
          </div>

          <SectionDivider label="Dealer Hedging Bias" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Estimated Gamma-Related Hedging Flow</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dealers (options market makers) must hedge their gamma exposure by buying or selling stock as price moves. This creates predictable flows: with positive GEX, dealers buy on upticks and sell on downticks (stabilizing). With negative GEX, dealers sell on upticks and buy on dips (destabilizing). The <span className="text-cyan-300 font-mono">maxDealerHedgingBias</span> parameter limits how much net dealer hedging flow you will tolerate before accepting an entry.
            </p>
            <Callout type="info">
              A high positive dealer hedging bias means dealers are heavily long gamma and providing a floor — they will buy when price drops. This is bullish. A negative bias means they are short gamma and will accelerate downward moves — a warning sign.
            </Callout>
          </div>
        </Section>

        {/* ── 8. Trading Guide ─────────────────────────────────────────────── */}
        <Section
          id="trading-guide"
          title="8 · Trading Guide & Examples"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Conservative Swing Trade Setup</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              For a capital-preservation focus, use the <span className="text-amber-300">Conservative preset</span> as your starting point. This setup requires 3 confirmations (vs default 2), uses a tighter 1.0× ATR stop, and sizes at quarter Kelly. Best for: retirement accounts, volatile markets, or when you want to benchmark against a buy-and-hold baseline.
            </p>
            <div className="mt-1 bg-slate-700/30 rounded p-2 text-xs text-slate-400 space-y-0.5">
              <div>• Strategy mode: <span className="text-cyan-300">Regime Trading</span></div>
              <div>• minConfirmations: <span className="text-cyan-300">3</span></div>
              <div>• stopLossAtrMultiplier: <span className="text-cyan-300">1.0×</span></div>
              <div>• Kelly: <span className="text-cyan-300">quarter</span>, max 10% per trade</div>
              <div>• maxDrawdownCap: <span className="text-cyan-300">15%</span></div>
            </div>
          </div>

          <SectionDivider label="Momentum Mode Setup" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Trend-Following Momentum Strategy</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switch to <span className="text-amber-300">Momentum mode</span> when markets are in strong trending regimes (e.g., parabolic moves, breakout markets). This strategy does NOT buy dips — it buys when price is already moving up with strength. The entry requires positive SMA slope, 20-bar momentum &gt; 5%, and 2 confirmations. Wider 2.5× ATR stop gives trends room to develop.
            </p>
            <div className="mt-1 bg-slate-700/30 rounded p-2 text-xs text-slate-400 space-y-0.5">
              <div>• Strategy mode: <span className="text-cyan-300">Momentum</span></div>
              <div>• momentumThreshold: <span className="text-cyan-300">5%</span> (20-bar rate of change)</div>
              <div>• stopLossAtrMultiplier: <span className="text-cyan-300">2.5×</span> (wide, let trends run)</div>
              <div>• trailAtrMultiplier1: <span className="text-cyan-300">3.0×</span> (lock profit later)</div>
              <div>• Exit when: price crosses below SMA with negative slope</div>
            </div>
          </div>

          <SectionDivider label="Using Options Data to Improve Entries" />

          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Institutional Entry Enhancement</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              When you have access to options data, enable the options filter and set <span className="text-cyan-300 font-mono">minGammaExposure = 0</span> to only take long entries when GEX &gt; 0. Additionally, enable <span className="text-cyan-300 font-mono">requirePositiveVanna</span> to ensure rising volatility dynamics are working in your favor. These two settings alone will significantly reduce false breakouts and align your entries with institutional dealer flow.
            </p>
            <Callout type="tip">
              Combine options filters with microstructure filters for the most robust institutional-grade entry quality. A signal that passes both options and microstructure filters has price-based, flow-based, and Greek-based confirmation.
            </Callout>
          </div>

          <SectionDivider label="Common Mistakes to Avoid" />

          <div className="space-y-2">
            {[
              {
                mistake: 'Lowering minConfirmations to 1 for more trades',
                why: 'One confirmation is essentially a random entry. minConfirmations = 1 backtests well in trending periods but catastrophically in choppy markets. Always benchmark against minConfirmations = 2.',
                severity: 'high',
              },
              {
                mistake: 'Using full Kelly or high Kelly fractions',
                why: 'Full Kelly has ~33% chance of a 50% drawdown in any given year. Half-Kelly is the practical maximum for most traders. Quarter-Kelly is safer for accounts where capital preservation matters.',
                severity: 'high',
              },
              {
                mistake: 'Setting stop loss too tight (< 1.0× ATR)',
                why: 'A stop below 1× ATR will be hit by normal daily volatility. You will have a high win rate but small winners and occasional catastrophic losses — the exact opposite of what you want.',
                severity: 'high',
              },
              {
                mistake: 'Ignoring the SMA slope in a bear market',
                why: 'The regime strategy suppresses dip-buying when the SMA slope is negative or flat. Ignoring this and buying in a bear market is the #1 way to blow up a portfolio using this strategy.',
                severity: 'high',
              },
              {
                mistake: 'Backtesting with unrealistic transaction costs',
                why: 'Always use the conservative txCostBpsPerSide estimate (11 bps or higher). Backtesting with 2 bps and live trading with 11 bps will produce completely different equity curves.',
                severity: 'medium',
              },
              {
                mistake: 'Not setting maxDrawdownCap',
                why: 'Without a drawdown cap, a string of losses can wipe out a portfolio before the strategy has a chance to recover. Set maxDrawdownCap to 15–25% and treat it as a non-negotiable circuit breaker.',
                severity: 'medium',
              },
            ].map(({ mistake, why, severity }) => (
              <div key={mistake} className="flex gap-2">
                <span className={`flex-shrink-0 mt-0.5 text-xs font-bold ${severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                  {severity === 'high' ? '✕' : '△'}
                </span>
                <div>
                  <p className="text-xs text-slate-300 font-medium">{mistake}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{why}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 9. Quick Reference Card ────────────────────────────────────── */}
        <Section
          id="quick-reference"
          title="9 · Quick Reference Card"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
          defaultOpen
        >
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Recommended Parameter Ranges by Risk Profile</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium pb-1 pr-2">Parameter</th>
                    <th className="text-center text-emerald-400 font-medium pb-1 px-1">Conservative</th>
                    <th className="text-center text-cyan-400 font-medium pb-1 px-1">Balanced</th>
                    <th className="text-center text-amber-400 font-medium pb-1 pl-1">Aggressive</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400 space-y-0.5">
                  {[
                    ['smaPeriod', '200', '200', '200'],
                    ['smaSlopeThreshold', '0.005', '0.005', '0.003'],
                    ['rsiBullThreshold', '30', '35', '40'],
                    ['rsiBearThreshold', '60', '65', '60'],
                    ['atrBullThreshold', '2.5%', '2.0%', '1.5%'],
                    ['bbBullThreshold', '0.10', '0.20', '0.30'],
                    ['minConfirmations', '3', '2', '1'],
                    ['stopLossAtrMultiplier', '1.0×', '1.5×', '2.0×'],
                    ['stopLossFloor', '2%', '3%', '4%'],
                    ['stopLossCeiling', '10%', '15%', '20%'],
                    ['trailAtrMultiplier1', '1.5×', '2.0×', '3.0×'],
                    ['trailAtrMultiplier2', '3.0×', '4.0×', '6.0×'],
                    ['maxDrawdownCap', '15%', '25%', '35%'],
                    ['positionCap', '15%', '25%', '30%'],
                    ['kellyMode', 'quarter', 'half', 'full'],
                    ['maxKellyFraction', '10%', '25%', '40%'],
                    ['txCostBpsPerSide', '15', '11', '8'],
                  ].map(([param, conservative, balanced, aggressive]) => (
                    <tr key={param} className="border-b border-slate-800">
                      <td className="py-1 pr-2 text-cyan-300 font-mono">{param}</td>
                      <td className="py-1 px-1 text-center text-emerald-300">{conservative}</td>
                      <td className="py-1 px-1 text-center text-cyan-300">{balanced}</td>
                      <td className="py-1 pl-1 text-center text-amber-300">{aggressive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-300 font-medium mb-2">Indicator Interpretation Cheat Sheet</p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="bg-slate-700/30 rounded p-2">
                <p className="text-cyan-300 font-medium mb-1">RSI</p>
                <p className="text-slate-400">Below <span className="text-emerald-300">30</span> = oversold (buy). Above <span className="text-red-400">70</span> = overbought (sell). Divergence = leading reversal signal.</p>
              </div>
              <div className="bg-slate-700/30 rounded p-2">
                <p className="text-cyan-300 font-medium mb-1">MACD</p>
                <p className="text-slate-400">Histogram positive = bullish momentum. Signal line crossover above 0 = strong bullish. Histogram shrinking = momentum waning.</p>
              </div>
              <div className="bg-slate-700/30 rounded p-2">
                <p className="text-cyan-300 font-medium mb-1">ATR%</p>
                <p className="text-slate-400">&gt; 2% = good swing trade candidate. &lt; 1% = too quiet. Higher ATR% = wider stop needed.</p>
              </div>
              <div className="bg-slate-700/30 rounded p-2">
                <p className="text-cyan-300 font-medium mb-1">Bollinger Band %</p>
                <p className="text-slate-400">&lt; 0.20 = near lower band (buy). &gt; 0.80 = near upper band (sell). Walk outside bands = strong momentum continuation.</p>
              </div>
            </div>
          </div>

          <Callout type="tip">
            <span className="font-medium text-slate-200">Bookmark this:</span> The single most impactful change you can make is raising <span className="text-cyan-300 font-mono">minConfirmations</span> from 1 to 2. It dramatically improves signal quality with only a modest reduction in trade frequency.
          </Callout>
        </Section>
      </div>
    </div>
  )
}
