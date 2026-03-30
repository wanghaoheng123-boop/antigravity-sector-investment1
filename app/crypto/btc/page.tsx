'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import BtcQuantLab from '@/components/crypto/BtcQuantLab'
import type { BtcCandle } from '@/lib/crypto'

const KLineChart = dynamic(() => import('@/components/KLineChart'), { ssr: false })

interface DpMarker {
  time: string; price: number; size: number; sentiment: 'BULLISH' | 'BEARISH'
}

interface NewsMarker {
  time: string; headline: string; impact: 'positive' | 'negative' | 'neutral'
}

const TIMEFRAMES = [
  ['5m', '5m'], ['15m', '15m'], ['1h', '1H'], ['4h', '4H'],
  ['1d', '1D'], ['1w', '1W'], ['1M', '1M'],
]
const INDICATOR_PRESETS = [
  ['ema', 'EMA'],
  ['vwap', 'VWAP'],
  ['bb', 'BB'],
  ['fib', 'Fib'],
  ['all', 'All'],
]

export default function BtcPage() {
  const [candles, setCandles] = useState<BtcCandle[]>([])
  const [darkPoolMarkers] = useState<DpMarker[]>([])
  const [newsMarkers] = useState<NewsMarker[]>([])
  const [activeTab, setActiveTab] = useState<'chart' | 'quant'>('chart')
  const [activeRange, setActiveRange] = useState('1d')
  const [activeIndicator, setActiveIndicator] = useState('ema')
  const [loading, setLoading] = useState(true)
  const [btcPrice, setBtcPrice] = useState<{ price: number; change24h: number; changePct24h: number } | null>(null)

  const fetchBtcData = useCallback((interval: string) => {
    setLoading(true)
    fetch(`/api/crypto/btc?interval=${interval}&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (data.candles) setCandles(data.candles)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const fetchBtcPrice = useCallback(() => {
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => r.json())
      .then(data => {
        setBtcPrice({
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChange),
          changePct24h: parseFloat(data.priceChangePercent),
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchBtcData(activeRange) }, [activeRange, fetchBtcData])
  useEffect(() => { fetchBtcPrice(); const t = setInterval(fetchBtcPrice, 10000); return () => clearInterval(t) }, [fetchBtcPrice])

  const isUp = (btcPrice?.changePct24h ?? 0) >= 0
  const color = '#f7931a'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-800 py-8" style={{ background: 'linear-gradient(180deg, #f7931a08 0%, transparent 100%)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg font-bold font-mono text-white bg-[#f7931a20] border border-[#f7931a40]">
                ₿
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">Markets</Link>
                  <span className="text-slate-700 text-xs">/</span>
                  <span className="text-xs text-slate-400">Crypto</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-wide">Bitcoin (BTC)</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  BTC/USDT · Binance · On-chain analytics · Quant tools
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 flex-wrap">
              {btcPrice ? (
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">${btcPrice.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={`text-sm font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(btcPrice.changePct24h).toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    24h: {isUp ? '+' : ''}{btcPrice.change24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
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

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
            {([['chart', 'Chart'], ['quant', 'Quant Lab']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
          {activeTab === 'chart' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
                {TIMEFRAMES.map(([val, label]) => (
                  <button key={val} onClick={() => setActiveRange(val)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${activeRange === val ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
                {INDICATOR_PRESETS.map(([val, label]) => (
                  <button key={val} onClick={() => setActiveIndicator(val)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${activeIndicator === val ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTab === 'chart' ? (
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">BTC/USDT · Binance Public API</span>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span>{activeRange.toUpperCase()} BARS</span>
                <span className="text-amber-400/60">₿ BTC/USD</span>
              </div>
            </div>
            {loading ? (
              <div className="h-[480px] bg-slate-800/20 rounded-xl animate-pulse flex flex-col items-center justify-center border border-slate-800/50">
                <span className="text-slate-500 text-sm font-mono mb-2">Connecting to Binance...</span>
              </div>
            ) : candles.length > 0 ? (
              <KLineChart
                candles={candles as any}
                darkPoolMarkers={darkPoolMarkers as any}
                newsMarkers={newsMarkers as any}
                color={color}
                ticker="BTC"
                range={activeRange}
                showRSI
                indicators={
                  activeIndicator === 'all'
                    ? { ema20: true, ema50: true, vwap: true, bollingerBands: true, fibonacci: true }
                    : activeIndicator === 'ema'
                    ? { ema20: true, ema50: true, vwap: false, bollingerBands: false, fibonacci: false }
                    : activeIndicator === 'vwap'
                    ? { ema20: false, ema50: false, vwap: true, bollingerBands: false, fibonacci: false }
                    : activeIndicator === 'bb'
                    ? { ema20: false, ema50: false, vwap: false, bollingerBands: true, fibonacci: false }
                    : { ema20: false, ema50: false, vwap: false, bollingerBands: false, fibonacci: true }
                }
              />
            ) : (
              <div className="h-[480px] bg-slate-800/10 rounded-xl flex items-center justify-center border border-dashed border-slate-800">
                <span className="text-slate-600 text-sm">No BTC data available from Binance</span>
              </div>
            )}
          </div>
        ) : (
          <BtcQuantLab candles={candles} />
        )}
      </div>
    </div>
  )
}
