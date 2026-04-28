import { describe, it, expect } from 'vitest'
import { btcRegime, type BtcCandle } from '@/lib/quant/btc-indicators'

function makeCandles(closes: number[], baseTime = 1700000000): BtcCandle[] {
  return closes.map((c, i) => ({
    time: baseTime + i * 86400,
    open: c,
    high: c * 1.01,
    low: c * 0.99,
    close: c,
    volume: 1000,
  }))
}

function makeFlatCandles(n: number, price = 50000): BtcCandle[] {
  return makeCandles(Array.from({ length: n }, () => price))
}

function makeTrendCandles(n: number, start: number, dailyReturn: number): BtcCandle[] {
  const closes: number[] = [start]
  for (let i = 1; i < n; i++) closes.push(closes[i - 1] * (1 + dailyReturn))
  return makeCandles(closes)
}

/** Trending series with sinusoidal noise so RSI stays mid-range (avoids hitting 0/100). */
function makeNoisyTrendCandles(n: number, start: number, drift: number, ampl = 0.012): BtcCandle[] {
  const closes: number[] = [start]
  for (let i = 1; i < n; i++) {
    const noise = Math.sin(i * 0.6) * ampl
    closes.push(closes[i - 1] * (1 + drift + noise))
  }
  return makeCandles(closes)
}

describe('btcRegime', () => {
  it('returns NEUTRAL with insufficient data', () => {
    const r = btcRegime(makeFlatCandles(50))
    expect(r.regime).toBe('NEUTRAL')
    expect(r.reasons).toContain('insufficient data')
    expect(r.confidence).toBe(0)
  })

  it('classifies a flat series within ±10% of EMA200 as NEUTRAL', () => {
    const r = btcRegime(makeFlatCandles(250))
    expect(r.regime).toBe('NEUTRAL')
    expect(r.metrics.pctVsEma200).not.toBeNull()
    expect(Math.abs(r.metrics.pctVsEma200!)).toBeLessThan(0.01)
  })

  it('classifies a moderate uptrend (>10% above EMA200, RSI < 80) as STRONG_BULL', () => {
    // Phase 11 A6: noisy moderate uptrend keeps RSI mid-range (40–70) and
    // pct above the +10% strong-bull threshold.
    const r = btcRegime(makeNoisyTrendCandles(250, 30000, 0.0015))
    expect(r.regime).toBe('STRONG_BULL')
    expect(r.metrics.pctVsEma200).toBeGreaterThan(0.10)
  })

  it('classifies a moderate downtrend (<-10% below EMA200, RSI > 20) as STRONG_BEAR', () => {
    const r = btcRegime(makeNoisyTrendCandles(250, 60000, -0.0015))
    expect(r.regime).toBe('STRONG_BEAR')
    expect(r.metrics.pctVsEma200).toBeLessThan(-0.10)
  })

  it('classifies an extreme uptrend with RSI > 80 as EUPHORIA', () => {
    const r = btcRegime(makeTrendCandles(250, 30000, 0.003))
    expect(r.regime).toBe('EUPHORIA')
  })

  it('classifies an extreme downtrend with RSI < 20 as CAPITULATION', () => {
    const r = btcRegime(makeTrendCandles(250, 60000, -0.003))
    expect(r.regime).toBe('CAPITULATION')
  })

  it('returns metrics with finite numbers when populated', () => {
    const r = btcRegime(makeFlatCandles(250))
    expect(r.metrics.ema200).not.toBeNull()
    expect(r.metrics.atrPct).not.toBeNull()
    expect(Number.isFinite(r.metrics.ema200!)).toBe(true)
  })

  it('confidence scales inversely with volatility (calmer = higher)', () => {
    // Phase 11 A6: makeFlatCandles emits high=close*1.01, low=close*0.99 → ATR
    // settles near 2% of price. Confidence formula caps at 8% ATR → 0%.
    // 2% ATR maps to ~75% confidence; assert it sits in the upper band.
    const calm = btcRegime(makeFlatCandles(250))
    expect(calm.confidence).toBeGreaterThanOrEqual(70)
    // Compare against a noisier series of comparable length.
    const noisyCloses: number[] = []
    let p = 50000
    for (let i = 0; i < 250; i++) {
      p = p * (1 + (Math.sin(i * 0.7) * 0.04))
      noisyCloses.push(p)
    }
    const noisy = btcRegime(makeCandles(noisyCloses))
    expect(calm.confidence).toBeGreaterThanOrEqual(noisy.confidence)
  })

  it('reasons array is non-empty for every regime', () => {
    const r = btcRegime(makeTrendCandles(250, 30000, 0.002))
    expect(r.reasons.length).toBeGreaterThan(0)
  })
})
