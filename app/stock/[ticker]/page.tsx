'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import DarkPoolPanel from '@/components/DarkPoolPanel'
import WatchlistButton from '@/components/WatchlistButton'
import QuantLabPanel from '@/components/stock/QuantLabPanel'
import NewsFeed from '@/components/NewsFeed'
import { getNewsForSector, generateDarkPoolPrints } from '@/lib/mockData'
import { DarkPoolPrint } from '@/lib/sectors'

const KLineChart = dynamic(() => import('@/components/KLineChart'), { ssr: false })

interface Candle {
  time: string; open: number; high: number; low: number; close: number; volume: number;
}
interface DpMarker {
  time: string; price: number; size: number; sentiment: 'BULLISH' | 'BEARISH';
}

export default function StockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase()
  
  const [candles, setCandles] = useState<Candle[]>([])
  const [darkPoolMarkers, setDarkPoolMarkers] = useState<DpMarker[]>([])
  const [quote, setQuote] = useState<{ price: number; change: number; changePct: number; marketCap: string } | null>(null)
  const [darkPoolPrints, setDarkPoolPrints] = useState<DarkPoolPrint[]>([])
  const [activeTab, setActiveTab] = useState<'chart' | 'quant' | 'darkpool' | 'news'>('chart')
  const [activeRange, setActiveRange] = useState('1Y')
  const [loading, setLoading] = useState(true)

  // Hardcode color to a generic blue for generic stocks, or we could map from their sector if needed.
  const color = '#3b82f6'

  useEffect(() => {
    // 1. Fetch real historical chart data
    setLoading(true)
    fetch(`/api/chart/${ticker}?range=${activeRange}`)
      .then(r => r.json())
      .then(data => {
        setCandles(data.candles ?? [])
        setDarkPoolMarkers(data.darkPoolMarkers ?? [])
      })
      .catch(e => console.error('Error fetching chart data:', e))
      .finally(() => setLoading(false))
  }, [ticker, activeRange])

  useEffect(() => {
    // 2. Fetch real live quote
    const fetchQuote = () => {
      fetch(`/api/prices?tickers=${ticker}`)
        .then(r => r.json())
        .then(data => {
          const q = data.quotes?.find((q: { ticker: string }) => q.ticker === ticker)
          if (q) setQuote(q)
        })
        .catch(() => {})
    }
    
    fetchQuote()
    const intervalId = setInterval(fetchQuote, 10000)

    // 3. Mock dynamic dark pools & news strictly for presentation density
    setDarkPoolPrints(generateDarkPoolPrints(ticker))
    
    return () => clearInterval(intervalId)
  }, [ticker])

  const news = getNewsForSector('technology') // Fallback generic news
  
  const newsMarkers = news.slice(0, 3).map((n, i) => {
    if (candles.length === 0) return null
    const idx = Math.max(0, candles.length - 15 - i * 10)
    return {
      time: candles[idx]?.time ?? '',
      headline: n.title,
      impact: 'neutral' as const,
    }
  }).filter(Boolean) as { time: string; headline: string; impact: 'positive' | 'negative' | 'neutral' }[]

  const isUp = (quote?.changePct ?? 0) >= 0

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="border-b border-slate-800 py-8"
        style={{ background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)` }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg font-bold font-mono text-white"
                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
              >
                {ticker}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">Markets</Link>
                  <span className="text-slate-700 text-xs">/</span>
                  <span className="text-xs text-slate-400">Individual Stock</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-wide">{ticker}</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Live prices & charts + Quant Lab (fundamentals, DCF scenarios, Codex frameworks).
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 flex-wrap">
              <WatchlistButton ticker={ticker} className="shrink-0 self-start" />
              {quote ? (
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">${quote.price.toFixed(2)}</div>
                  <div className={`text-sm font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.changePct).toFixed(2)}%)
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">Market Cap: {quote.marketCap}</div>
                </div>
              ) : (
                <div className="space-y-2 text-right w-32">
                  <div className="h-7 bg-slate-800 rounded animate-pulse" />
                  <div className="h-5 bg-slate-800 rounded animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
            {(
              [
                ['chart', 'Chart'],
                ['quant', 'Quant Lab'],
                ['darkpool', 'Dark Pool'],
                ['news', 'News'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === 'chart' && (
            <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
              {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'].map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    activeRange === r ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'quant' ? (
          <QuantLabPanel ticker={ticker} />
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-6">
            {/* Chart tab */}
            {activeTab === 'chart' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white">{ticker} · Advanced Technicals</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                    <span>{activeRange === '1D' || activeRange === '1W' ? 'INTRADAY' : 'DAILY+'} BARS</span>
                  </div>
                </div>
                {loading ? (
                   <div className="h-[480px] bg-slate-800/20 rounded-xl animate-pulse flex flex-col items-center justify-center border border-slate-800/50">
                     <span className="text-slate-500 text-sm font-mono mb-2">Connecting to Data Feed...</span>
                   </div>
                ) : candles.length > 0 ? (
                  <KLineChart
                    candles={candles}
                    darkPoolMarkers={darkPoolMarkers}
                    newsMarkers={newsMarkers}
                    color={color}
                    ticker={ticker}
                    range={activeRange as any}
                    showRSI
                  />
                ) : (
                  <div className="h-[480px] bg-slate-800/10 rounded-xl flex items-center justify-center border border-dashed border-slate-800">
                    <span className="text-slate-600 text-sm">No historical data available for {ticker}</span>
                  </div>
                )}
              </div>
            )}

            {/* Dark Pool tab */}
            {activeTab === 'darkpool' && (
              <DarkPoolPanel prints={darkPoolPrints} ticker={ticker} color={color} />
            )}

            {/* News tab */}
            {activeTab === 'news' && (
              <NewsFeed news={news} color={color} />
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">Session snapshot</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-sm text-slate-400">1d change</span>
                  {quote ? (
                    <span
                      className={`text-sm font-mono font-medium ${quote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {quote.changePct >= 0 ? '+' : ''}
                      {quote.changePct.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-sm text-slate-600">—</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Open <strong className="text-slate-400">Quant Lab</strong> for live fundamentals, DCF bear/base/bull, volatility-aware buy/sell bands, and Codex-style allocator checklists (not trade advice).
                </p>
              </div>
            </div>

            {/* Dark Pool Summary */}
            {darkPoolPrints.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">Dark Pool Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Total Block Vol</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {(darkPoolPrints.reduce((s, p) => s + p.size, 0) / 1e6).toFixed(2)}M
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Bullish Prints</div>
                    <div className="text-lg font-bold text-green-400 font-mono">
                      {darkPoolPrints.filter(p => p.sentiment === 'BULLISH').length}
                      <span className="text-slate-600 text-sm font-normal">/{darkPoolPrints.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
               <h3 className="text-sm font-bold text-white mb-2 relative z-10">Real-Time Data Feed Status</h3>
               <p className="text-xs text-slate-400 leading-relaxed relative z-10">
                 This detailed stock view uses live connections to fetch accurate pricing and historical 1Y timeframe indicators via API.
               </p>
            </div>

          </div>
        </div>
        )}
      </div>
    </div>
  )
}
