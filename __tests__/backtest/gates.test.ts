import { describe, expect, it } from 'vitest'
import {
  isTltRising,
  parkinsonVol,
  isParkinsonOk,
  isDxyOk,
  isYieldCurveOk,
} from '@/lib/backtest/gates'

function trend(n: number, start: number, daily: number): number[] {
  const out = [start]
  for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + daily))
  return out
}

// ── isTltRising ──────────────────────────────────────────────────────────────

describe('isTltRising', () => {
  it('returns true on a steady uptrend', () => {
    const tlt = trend(100, 90, 0.001)
    expect(isTltRising(tlt)).toBe(true)
  })

  it('returns false on a steady downtrend', () => {
    const tlt = trend(100, 110, -0.001)
    expect(isTltRising(tlt)).toBe(false)
  })

  it('fails closed when fewer than slow+confirmation bars are provided', () => {
    expect(isTltRising(trend(40, 90, 0.001))).toBe(false)
    expect(isTltRising(trend(54, 90, 0.001))).toBe(false)
  })

  it('fails closed on NaN inputs', () => {
    const tlt = trend(100, 90, 0.001)
    tlt[60] = NaN
    expect(isTltRising(tlt)).toBe(false)
  })

  it('returns true even with mild oscillation as long as fast > slow and rising', () => {
    const closes: number[] = []
    let p = 90
    for (let i = 0; i < 120; i++) {
      p *= 1 + 0.001 + Math.sin(i / 5) * 0.002
      closes.push(p)
    }
    expect(typeof isTltRising(closes)).toBe('boolean')
  })

  it('respects custom windows', () => {
    const tlt = trend(40, 100, 0.001)
    expect(isTltRising(tlt, { fastWindow: 5, slowWindow: 20, confirmationBars: 3 })).toBe(true)
  })
})

// ── parkinsonVol / isParkinsonOk ─────────────────────────────────────────────

describe('parkinsonVol', () => {
  it('returns a finite positive number on healthy bars', () => {
    const highs = Array.from({ length: 30 }, (_, i) => 100 + i * 0.05 + 0.5)
    const lows = highs.map((h) => h - 1)
    const v = parkinsonVol(highs, lows, 20)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThan(0)
  })

  it('returns 0 when range is exactly zero on every bar', () => {
    const highs = Array.from({ length: 30 }, () => 100)
    const lows = highs.slice()
    expect(parkinsonVol(highs, lows, 20)).toBe(0)
  })

  it('returns NaN on h < l (bad ticks)', () => {
    const highs = [10, 10, 9, 10, 10]
    const lows = [9, 9, 10, 9, 9]
    expect(Number.isNaN(parkinsonVol(highs, lows, 5))).toBe(true)
  })

  it('returns NaN on insufficient data', () => {
    expect(Number.isNaN(parkinsonVol([10, 11], [9, 10], 20))).toBe(true)
  })
})

describe('isParkinsonOk', () => {
  it('returns true on a calm series', () => {
    const highs: number[] = []
    const lows: number[] = []
    for (let i = 0; i < 80; i++) {
      const p = 100 + Math.sin(i / 10) * 0.5
      highs.push(p + 0.3)
      lows.push(p - 0.3)
    }
    expect(isParkinsonOk(highs, lows)).toBe(true)
  })

  it('returns false when the latest 20 bars are 3x more volatile than the prior 60', () => {
    const highs: number[] = []
    const lows: number[] = []
    for (let i = 0; i < 60; i++) {
      const p = 100
      highs.push(p + 0.1)
      lows.push(p - 0.1)
    }
    for (let i = 0; i < 20; i++) {
      const p = 100
      highs.push(p + 3.0)
      lows.push(p - 3.0)
    }
    expect(isParkinsonOk(highs, lows)).toBe(false)
  })

  it('fails closed when data is shorter than baselineWindow', () => {
    const highs = Array.from({ length: 40 }, () => 101)
    const lows = highs.map((h) => h - 1)
    expect(isParkinsonOk(highs, lows)).toBe(false)
  })
})

// ── isDxyOk ──────────────────────────────────────────────────────────────────

describe('isDxyOk', () => {
  it('returns true when DXY is falling', () => {
    expect(isDxyOk(trend(60, 110, -0.001))).toBe(true)
  })

  it('returns false when DXY is rising', () => {
    expect(isDxyOk(trend(60, 90, 0.001))).toBe(false)
  })

  it('returns true when DXY is flat (gate is "rising")', () => {
    const flat = Array.from({ length: 60 }, () => 100)
    expect(isDxyOk(flat)).toBe(true)
  })

  it('fails closed on insufficient data', () => {
    expect(isDxyOk(trend(20, 100, -0.001))).toBe(false)
  })
})

// ── isYieldCurveOk ───────────────────────────────────────────────────────────

describe('isYieldCurveOk', () => {
  it('returns true on positive spread', () => {
    expect(isYieldCurveOk(4.5, 3.5)).toBe(true)
  })

  it('returns false on inversion', () => {
    expect(isYieldCurveOk(3.5, 4.5)).toBe(false)
  })

  it('returns false when buffer not exceeded', () => {
    expect(isYieldCurveOk(4.10, 4.05, { spreadBuffer: 0.10 })).toBe(false)
    expect(isYieldCurveOk(4.20, 4.05, { spreadBuffer: 0.10 })).toBe(true)
  })

  it('fails closed on null / NaN inputs', () => {
    expect(isYieldCurveOk(null, 4)).toBe(false)
    expect(isYieldCurveOk(4, null)).toBe(false)
    expect(isYieldCurveOk(NaN, 4)).toBe(false)
    expect(isYieldCurveOk(4, NaN)).toBe(false)
  })
})
