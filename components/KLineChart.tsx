'use client'

import { useEffect, useRef, useCallback } from 'react'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
  SeriesMarker,
  SeriesMarkerPosition,
  SeriesMarkerShape,
} from 'lightweight-charts'

interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface DarkPoolMarker {
  time: string
  price: number
  size: number
  sentiment: 'BULLISH' | 'BEARISH'
}

interface NewsMarker {
  time: string
  headline: string
  impact: 'positive' | 'negative' | 'neutral'
}

interface KLineChartProps {
  candles: Candle[]
  darkPoolMarkers?: DarkPoolMarker[]
  newsMarkers?: NewsMarker[]
  color: string
  ticker: string
  range?: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'
  showRSI?: boolean
}

const RANGE_DAYS: Record<string, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1Y': 252,
  'ALL': 9999,
}

export default function KLineChart({
  candles,
  darkPoolMarkers = [],
  newsMarkers = [],
  color,
  ticker: _ticker,
  range = '6M',
  showRSI = true,
}: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const visibleCandles = useCallback(() => {
    return candles
  }, [candles])

  useEffect(() => {
    const displayCandles = visibleCandles()
    if (!containerRef.current || displayCandles.length === 0) return

    let mounted = true

    const loadChart = async () => {
      const { createChart, CrosshairMode, LineStyle } = await import('lightweight-charts')
      if (!mounted || !containerRef.current) return

      const chart = createChart(containerRef.current, {
        layout: { background: { color: '#0a0a12' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: '#1e1e2e' }, horzLines: { color: '#1e1e2e' } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
          horzLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
        },
        rightPriceScale: { borderColor: '#1e1e2e' },
        timeScale: { borderColor: '#1e1e2e', timeVisible: true, secondsVisible: false, rightOffset: 5 },
        width: containerRef.current.clientWidth,
        height: showRSI ? 300 : 380,
      })
      chartRef.current = chart

      const candleSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
        upColor: '#00d084',
        downColor: '#ff4757',
        borderUpColor: '#00d084',
        borderDownColor: '#ff4757',
        wickUpColor: '#00d084',
        wickDownColor: '#ff4757',
      })

      const volumeSeries: ISeriesApi<'Histogram'> = chart.addHistogramSeries({
        color: '#3b82f630',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

      const ema20Series: ISeriesApi<'Line'> = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
      })

      const ema50Series: ISeriesApi<'Line'> = chart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
      })

      // Data
      candleSeries.setData(displayCandles.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })) as CandlestickData<Time>[])

      volumeSeries.setData(displayCandles.map(c => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? '#00d08430' : '#ff475730',
      })) as HistogramData<Time>[])

      const closes = displayCandles.map(c => c.close)
      const ema20Values = calcEMA(closes, 20)
      const ema50Values = calcEMA(closes, 50)

      ema20Series.setData(
        displayCandles
          .map((c, i) => ({ time: c.time as Time, value: ema20Values[i] }))
          .filter(d => !isNaN(d.value)) as LineData<Time>[]
      )
      ema50Series.setData(
        displayCandles
          .map((c, i) => ({ time: c.time as Time, value: ema50Values[i] }))
          .filter(d => !isNaN(d.value)) as LineData<Time>[]
      )

      // Markers
      const dpMarkers: SeriesMarker<Time>[] = darkPoolMarkers
        .filter(m => displayCandles.some(c => c.time === m.time))
        .map(m => ({
          time: m.time as Time,
          position: (m.sentiment === 'BULLISH' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
          color: m.sentiment === 'BULLISH' ? '#3b82f6' : '#a855f7',
          shape: 'circle' as SeriesMarkerShape,
          text: `${(m.size / 1000).toFixed(0)}K`,
          size: 0.6,
        }))

      const nMarkers: SeriesMarker<Time>[] = newsMarkers
        .filter(n => n.time && displayCandles.some(c => c.time === n.time))
        .map(n => ({
          time: n.time as Time,
          position: (n.impact === 'negative' ? 'aboveBar' : 'belowBar') as SeriesMarkerPosition,
          color: n.impact === 'positive' ? '#00d084' : n.impact === 'negative' ? '#ff4757' : '#94a3b8',
          shape: (n.impact === 'positive' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
          text: '📰',
          size: 0.8,
        }))

      const allMarkers = [...dpMarkers, ...nMarkers].sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time
        }
        return String(a.time).localeCompare(String(b.time))
      })
      if (allMarkers.length > 0) candleSeries.setMarkers(allMarkers)

      chart.timeScale().fitContent()

      // RSI sub-chart
      if (showRSI && rsiRef.current && mounted) {
        const rsiChart = createChart(rsiRef.current, {
          layout: { background: { color: '#0a0a12' }, textColor: '#94a3b8' },
          grid: { vertLines: { color: '#1e1e2e' }, horzLines: { color: '#1e1e2e' } },
          rightPriceScale: { borderColor: '#1e1e2e' },
          timeScale: { borderColor: '#1e1e2e', timeVisible: true, secondsVisible: false },
          crosshair: { mode: CrosshairMode.Normal },
          width: rsiRef.current.clientWidth,
          height: 90,
        })
        rsiChartRef.current = rsiChart

        const rsiLine: ISeriesApi<'Line'> = rsiChart.addLineSeries({
          color: color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
        })
        const ob: ISeriesApi<'Line'> = rsiChart.addLineSeries({
          color: '#ff475750',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: LineStyle.Dashed,
        })
        const os: ISeriesApi<'Line'> = rsiChart.addLineSeries({
          color: '#00d08450',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: LineStyle.Dashed,
        })

        const rsiValues = calcRSI(closes, 14)
        const rsiData = displayCandles
          .map((c, i) => ({ time: c.time as Time, value: rsiValues[i] }))
          .filter(d => !isNaN(d.value)) as LineData<Time>[]

        rsiLine.setData(rsiData)
        ob.setData(rsiData.map(d => ({ time: d.time, value: 70 })))
        os.setData(rsiData.map(d => ({ time: d.time, value: 30 })))
        rsiChart.timeScale().fitContent()

        // Synchronize crosshair
        chart.subscribeCrosshairMove(param => {
          if (!param.time) return
          rsiChart.setCrosshairPosition(param.point ? param.point.y : 0, param.time, rsiLine)
        })
        rsiChart.subscribeCrosshairMove(param => {
          if (!param.time) return
          chart.setCrosshairPosition(param.point ? param.point.y : 0, param.time, candleSeries)
        })
      }

      // MACD sub-chart
      if (showRSI && macdRef.current && mounted) {
        const macdChart = createChart(macdRef.current, {
          layout: { background: { color: '#0a0a12' }, textColor: '#94a3b8' },
          grid: { vertLines: { color: '#1e1e2e' }, horzLines: { color: '#1e1e2e' } },
          rightPriceScale: { borderColor: '#1e1e2e' },
          timeScale: { borderColor: '#1e1e2e', timeVisible: true, secondsVisible: false },
          crosshair: { mode: CrosshairMode.Normal },
          width: macdRef.current.clientWidth,
          height: 90,
        })
        macdChartRef.current = macdChart

        const macdLine = macdChart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true })
        const signalLine = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: true })
        const histogramSeries = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })

        const macdValues = calcMACD(closes)
        
        const macdData: LineData<Time>[] = []
        const signalData: LineData<Time>[] = []
        const histData: HistogramData<Time>[] = []

        for (let i = 0; i < displayCandles.length; i++) {
          const m = macdValues[i]
          if (!m || isNaN(m.macd)) continue
          const time = displayCandles[i].time as Time
          macdData.push({ time, value: m.macd })
          if (!isNaN(m.signal)) signalData.push({ time, value: m.signal })
          if (!isNaN(m.histogram)) {
            const isGrowing = histData.length > 0 && m.histogram > histData[histData.length - 1].value
            const color = m.histogram >= 0 
              ? (isGrowing ? '#00d084' : '#00d08450') 
              : (isGrowing ? '#ff475750' : '#ff4757')
            histData.push({ time, value: m.histogram, color })
          }
        }

        macdLine.setData(macdData)
        signalLine.setData(signalData)
        histogramSeries.setData(histData)
        
        macdChart.timeScale().fitContent()

        chart.subscribeCrosshairMove(param => {
          if (!param.time) return
          macdChart.setCrosshairPosition(param.point ? param.point.y : 0, param.time, macdLine)
        })
        macdChart.subscribeCrosshairMove(param => {
          if (!param.time) return
          chart.setCrosshairPosition(param.point ? param.point.y : 0, param.time, candleSeries)
        })
      }

      // ResizeObserver
      const observer = new ResizeObserver(entries => {
        if (!mounted) return
        const entry = entries[0]
        if (!entry) return
        const { width } = entry.contentRect
        chart.applyOptions({ width })
        rsiChartRef.current?.applyOptions({ width })
        macdChartRef.current?.applyOptions({ width })
      })
      resizeObserverRef.current = observer
      if (containerRef.current) observer.observe(containerRef.current)
    }

    loadChart()

    return () => {
      mounted = false
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      chartRef.current?.remove()
      chartRef.current = null
      rsiChartRef.current?.remove()
      rsiChartRef.current = null
      macdChartRef.current?.remove()
      macdChartRef.current = null
    }
  }, [candles, range, darkPoolMarkers, newsMarkers, color, showRSI, visibleCandles])

  return (
    <div className="relative select-none">
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 text-xs bg-slate-950/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-800/50">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-yellow-400 inline-block rounded" />
          <span className="text-slate-400">EMA 20</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-purple-400 inline-block rounded" />
          <span className="text-slate-400">EMA 50</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-blue-400 text-[10px]">●</span>
          <span className="text-slate-400">Dark Pool</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-green-400 text-[10px]">▲</span>
          <span className="text-slate-400">News</span>
        </span>
      </div>

      <div ref={containerRef} className="w-full rounded-t-lg overflow-hidden" />

      {showRSI && (
        <>
          <div className="relative border-t border-slate-800">
            <div className="absolute left-3 top-1 z-10 text-[10px] text-slate-500 font-mono">RSI(14)</div>
            <div ref={rsiRef} className="w-full overflow-hidden" />
          </div>
          <div className="relative border-t border-slate-800">
            <div className="absolute left-3 top-1 z-10 text-[10px] text-slate-500 font-mono">MACD(12,26,9)</div>
            <div ref={macdRef} className="w-full rounded-b-lg overflow-hidden" />
          </div>
        </>
      )}
    </div>
  )
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = new Array(prices.length).fill(NaN)
  if (prices.length < period) return ema
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema[period - 1] = prev
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    ema[i] = prev
  }
  return ema
}

function calcRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(NaN)
  if (prices.length < period + 1) return rsi
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs)
  }
  return rsi
}

function calcMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
  const macdResult = new Array(prices.length).fill({ macd: NaN, signal: NaN, histogram: NaN })
  if (prices.length < slow) return macdResult

  const fastEMA = calcEMA(prices, fast)
  const slowEMA = calcEMA(prices, slow)
  
  const macdLine = new Array(prices.length).fill(NaN)
  for (let i = slow - 1; i < prices.length; i++) {
    macdLine[i] = fastEMA[i] - slowEMA[i]
  }

  // Calculate signal line (EMA of MACD line)
  const signalLine = new Array(prices.length).fill(NaN)
  const validMacdLine = macdLine.slice(slow - 1)
  const macdSignalEMA = calcEMA(validMacdLine, signal)
  
  for (let i = 0; i < macdSignalEMA.length; i++) {
    signalLine[i + slow - 1] = macdSignalEMA[i]
  }

  const result = []
  for (let i = 0; i < prices.length; i++) {
    const m = macdLine[i]
    const s = signalLine[i]
    result.push({
      macd: m,
      signal: s,
      histogram: !isNaN(m) && !isNaN(s) ? m - s : NaN
    })
  }

  return result
}
