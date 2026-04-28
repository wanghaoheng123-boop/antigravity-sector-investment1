/**
 * Phase 11 — Regression tests for div-by-zero guards in lib/backtest/engine.ts
 * Targets the three guards added in Phase A1:
 *   L339 bnhReturn  — guard rows[0].close > 0
 *   L345 drawdown   — guard peak > 0
 *   L352 dailyReturn — guard prev equity > 0 + finite check
 */

import { describe, it, expect } from 'vitest'
import { backtestInstrument } from '@/lib/backtest/engine'
import type { OhlcvRow } from '@/lib/backtest/engine'

const START_TIME = Math.floor(new Date('2019-01-01').getTime() / 1000)

function makeRow(i: number, close: number): OhlcvRow {
  return {
    time: START_TIME + i * 86400,
    open: close,
    high: close * 1.005 || 0.005,
    low: close * 0.995,
    close,
    volume: 1_000_000,
  }
}

function makeRows(count: number, dailyReturn = 0.0005, startPrice = 100): OhlcvRow[] {
  const rows: OhlcvRow[] = []
  let price = startPrice
  for (let i = 0; i < count; i++) {
    rows.push(makeRow(i, price))
    price = price * (1 + dailyReturn)
  }
  return rows
}

describe('engine div-by-zero guards', () => {
  it('zero starting close does not produce Infinity/NaN in bnhReturn', () => {
    // 252+ rows so we exit the early-return path. First bar has close=0; rest are normal.
    const rows = makeRows(300, 0.0005, 100)
    rows[0] = makeRow(0, 0) // pathological: zero starting close

    const result = backtestInstrument('TEST', 'Technology', rows)

    expect(Number.isFinite(result.bnhReturn)).toBe(true)
    expect(result.bnhReturn).toBe(0) // guard returns 0 when rows[0].close is 0
    expect(Number.isFinite(result.totalReturn)).toBe(true)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(result.maxDrawdown).toBeLessThanOrEqual(1)
  })

  it('drawdown stays in [0,1] on healthy data', () => {
    const rows = makeRows(500, 0.0003, 100)
    const result = backtestInstrument('TEST', 'Technology', rows)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(result.maxDrawdown).toBeLessThanOrEqual(1)
  })

  it('daily returns array contains only finite values', () => {
    const rows = makeRows(400, 0.0002, 50)
    const result = backtestInstrument('TEST', 'Technology', rows)
    for (const r of result.dailyReturns) {
      expect(Number.isFinite(r)).toBe(true)
    }
    // Sharpe must be either null (insufficient data) or finite
    if (result.sharpeRatio !== null) {
      expect(Number.isFinite(result.sharpeRatio)).toBe(true)
    }
  })

  it('single-bar input returns zeros without crashing', () => {
    const rows = [makeRow(0, 100)]
    const result = backtestInstrument('TEST', 'Technology', rows)
    expect(result.totalTrades).toBe(0)
    expect(result.bnhReturn).toBe(0)
    expect(result.maxDrawdown).toBe(0)
    expect(result.totalReturn).toBe(0)
    expect(result.equityCurve).toHaveLength(1)
  })

  it('insufficient bars (<252) returns safe zeros', () => {
    const rows = makeRows(100, 0.001)
    const result = backtestInstrument('TEST', 'Technology', rows)
    expect(result.totalTrades).toBe(0)
    expect(Number.isFinite(result.bnhReturn)).toBe(true)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
  })

  it('regression: healthy 500-bar uptrend produces sensible stats', () => {
    const rows = makeRows(500, 0.0008, 100)
    const result = backtestInstrument('TEST', 'Technology', rows)
    // Healthy data: bnhReturn must be positive (we trended up) and finite
    expect(Number.isFinite(result.bnhReturn)).toBe(true)
    expect(result.bnhReturn).toBeGreaterThan(0)
    expect(Number.isFinite(result.totalReturn)).toBe(true)
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(result.maxDrawdown).toBeLessThanOrEqual(1)
    // Sharpe may be null on a synthetic monotone trend (low variance) but never NaN
    if (result.sharpeRatio !== null) {
      expect(Number.isFinite(result.sharpeRatio)).toBe(true)
    }
  })
})
