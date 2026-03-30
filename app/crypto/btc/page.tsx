'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
] as const
const INDICATOR_PRESETS = [
  ['ema', 'EMA'], ['vwap', 'VWAP'], ['bb', 'BB'], ['fib', 'Fib'], ['all', 'All'],
] as const

// Binance WebSocket streams (wss — secure)
const PRICE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@ticker'
const KLINE_WS = (interval: string) =>
  `wss://stream.binance.com:9443/stream?streams=btcusdt@kline_${interval}`

export default function BtcPage() {
  const [candles, setCandles] = useState<BtcCandle[]>([])
  const [activeTab, setActiveTab] = useState<'chart' | 'quant'>('chart')
  const [activeRange, setActiveRange] = useState<string>('1d')
  const [activeIndicator, setActiveIndicator] = useState<string>('ema')
  const [loading, setLoading] = useState(true)
  const [btcPrice, setBtcPrice] = useState<{
    price: number; change24h: number; changePct24h: number; high24h: number; low24h: number; volume24h: number
  } | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Client-side candle cache: Map<interval, BtcCandle[]>
  const candleCacheRef = useRef<Map<string, BtcCandle[]>>(new Map())
  // WebSocket refs
  const priceWsRef = useRef<WebSocket | null>(null)
  const klineWsRef = useRef<WebSocket | null>(null)

  // Memoized indicators object — never recreated unless activeIndicator changes
  const indicatorConfig = useMemo(() => {
    if (activeIndicator === 'all') return { ema20: true, ema50: true, vwap: true, bollingerBands: true, fibonacci: true }
    if (activeIndicator === 'ema') return { ema20: true, ema50: true, vwap: false, bollingerBands: false, fibonacci: false }
    if (activeIndicator === 'vwap') return { ema20: false, ema50: false, vwap: true, bollingerBands: false, fibonacci: false }
    if (activeIndicator === 'bb') return { ema20: false, ema50: false, vwap: false, bollingerBands: true, fibonacci: false }
    return { ema20: false, ema50: false, vwap: false, bollingerBands: false, fibonacci: true }
  }, [activeIndicator])

  // ── Fetch initial candles (REST) ──────────────────────────────────────────
  const fetchCandles = useCallback((interval: string) => {
    // Return cached data immediately if available
    const cached = candleCacheRef.current.get(interval)
    if (cached) { setCandles(cached); setLoading(false) }

    setLoading(true)
    fetch(`/api/crypto/btc?interval=${interval}&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (data.candles) {
          candleCacheRef.current.set(interval, data.candles)
          setCandles(data.candles)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Connect / reconnect WebSocket for live candle updates ─────────────────
  const connectKlineWs = useCallback((interval: string) => {
    // Close existing kline WS
    klineWsRef.current?.close()
    klineWsRef.current = null

    const ws = new WebSocket(KLINE_WS(interval))

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        // Binance combined stream format: { stream: "...", data: { kline: {...} } }
        const k = msg.data?.k
        if (!k) return

        const candle: BtcCandle = {
          time: Math.floor(new Date(k.t).getTime() / 1000),
          open:   parseFloat(k.o),
          high:   parseFloat(k.h),
          low:    parseFloat(k.l),
          close:  parseFloat(k.c),
          volume: parseFloat(k.v),
        }

        // Update cache AND state
        candleCacheRef.current.set(interval, prev => {
          if (!prev || prev.length === 0) return [candle]
          const last = prev[prev.length - 1]
          if (last.time === candle.time) {
            // Update current candle in place
            return [...prev.slice(0, -1), candle]
          }
          // New candle
          return [...prev, candle]
        })

        setCandles(prev => {
          if (!prev || prev.length === 0) return [candle]
          const last = prev[prev.length - 1]
          if (last.time === candle.time) return [...prev.slice(0, -1), candle]
          return [...prev, candle]
        })
      } catch {}
    }

    ws.onopen = () => setWsConnected(true)
    ws.onerror = () => setWsConnected(false)
    ws.onclose = () => {
      setWsConnected(false)
      // Reconnect after 3 seconds if still on chart tab
      setTimeout(() => {
        if (activeTab === 'chart') connectKlineWs(interval)
      }, 3000)
    }

    klineWsRef.current = ws
  }, [activeTab])

  // ── Connect price WebSocket ────────────────────────────────────────────────
  const connectPriceWs = useCallback(() => {
    priceWsRef.current?.close()
    const ws = new WebSocket(PRICE_WS)

    ws.onmessage = (event) => {
      try {
        const d = JSON.parse(event.data)
        if (d.lastPrice) {
          setBtcPrice(prev => ({
            price:         parseFloat(d.lastPrice),
            change24h:     parseFloat(d.priceChange),
            changePct24h:  parseFloat(d.priceChangePercent),
            high24h:       parseFloat(d.highPrice),
            low24h:        parseFloat(d.lowPrice),
            volume24h:     parseFloat(d.volume),
          }))
        }
      } catch {}
    }

    ws.onerror = () => {}
    ws.onclose = () => {
      setTimeout(connectPriceWs, 5000)
    }

    priceWsRef.current = ws
  }, [])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCandles(activeRange)
    connectKlineWs(activeRange)
    connectPriceWs()

    return () => {
      priceWsRef.current?.close()
      klineWsRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // ── When timeframe changes ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'chart') return
    fetchCandles(activeRange)
    connectKlineWs(activeRange)
  }, [activeRange, activeTab, fetchCandles, connectKlineWs])

  const isUp = (btcPrice?.changePct24h ?? 0) >= 0
  const color = '#f7931a'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-800 py-6" style={{ background: 'linear-gradient(180deg, #f7931a08 0%, transparent 100%)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold text-white bg-[#f7931a20] border border-[#f7931a40]">
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
                  BTC/USDT · Binance · Real-time WebSocket stream
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {wsConnected && (
                <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-medium">LIVE</span>
                </div>
              )}
              {!wsConnected && (
                <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="text-[10px] text-slate-400 font-medium">RECONNECTING</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-4 flex-wrap">
              {btcPrice ? (
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">
                    ${btcPrice.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-sm font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(btcPrice.changePct24h).toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1 font-mono">
                    H${btcPrice.high24h.toLocaleString('en-US', { maximumFractionDigits: 0 })} · L${btcPrice.low24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-right w-36">
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
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">BTC/USDT · Binance</span>
                <span className="text-[10px] text-amber-400/60 font-mono border border-amber-400/20 px-1.5 py-0.5 rounded">WSS LIVE</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span>{activeRange.toUpperCase()} BARS</span>
                <span>{candles.length} candles</span>
              </div>
            </div>
            {loading && candles.length === 0 ? (
              <div className="h-[480px] bg-slate-800/20 rounded-xl animate-pulse flex flex-col items-center justify-center border border-slate-800/50">
                <span className="text-slate-500 text-sm font-mono mb-2">Connecting to Binance...</span>
              </div>
            ) : candles.length > 0 ? (
              <KLineChart
                candles={candles as any}
                darkPoolMarkers={[]}
                newsMarkers={[]}
                color={color}
                ticker="BTC"
                range={activeRange}
                showRSI
                indicators={indicatorConfig}
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

        {/* Live data footer */}
        <div className="text-center text-[10px] text-slate-700">
          Data sourced from Binance Public API via WebSocket (real-time) and REST (historical). Prices are indicative.
        </div>
      </div>
    </div>
  )
}
