/**
 * Backtest engine — pure computation, no API calls, no side effects.
 * Used by Next.js API routes and the CLI runner.
 */

import type { OhlcBar } from '@/lib/quant/technicals'
import { combinedSignal, DEFAULT_CONFIG, atr, type BacktestConfig } from './signals'

// ─── Transaction cost model ─────────────────────────────────────────────────────
// Applied per trade (entry + exit) to reflect realistic execution costs.
// Source: Interactive Brokers ~$0.005/share + 0.05% spread + 0.5bps mid-price slippage
// For a $100 stock: 0.005/100 = 0.005% commission + 0.05% spread + 0.05% slippage ≈ 0.11% total = 11bps round-trip
export const TX_COST_BPS = 11  // round-trip basis points (applied at entry + exit separately)
export const TX_COST_PCT = TX_COST_BPS / 10000  // as decimal

export interface OhlcvRow extends OhlcBar {
  time: number
  volume: number
}

export interface Trade {
  date: string
  ticker: string
  sector: string
  action: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  shares: number
  value: number
  regime: string
  dipSignal: string
  confidence: number
  pnlPct: number | null
  reason: string
  atrAtrPctAtEntry?: number
  highestPriceAfterEntry?: number
}

export interface BacktestResult {
  ticker: string
  sector: string
  initialPrice: number
  finalPrice: number
  totalReturn: number
  annualizedReturn: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  maxDrawdown: number
  winRate: number
  profitFactor: number
  avgTradeReturn: number
  totalTrades: number
  closedTrades: Trade[]
  openTrade: Trade | null
  dailyReturns: number[]
  equityCurve: number[]
  days: number
  confidenceAvg: number
  stopLossPct: number
  bnhReturn: number
  excessReturn: number
}

interface PortfolioState {
  capital: number
  position: number
  avgCost: number
  peakEquity: number
  equityHistory: number[]
  dailyReturns: number[]
  closedTrades: Trade[]
  openTrade: Trade | null
  tradeWins: number
  tradeLosses: number
  grossProfit: number
  grossLoss: number
  confidenceSum: number
  confidenceCount: number
}

function newPortfolio(initialCapital: number): PortfolioState {
  return {
    capital: initialCapital, position: 0, avgCost: 0,
    peakEquity: initialCapital,
    equityHistory: [initialCapital],
    dailyReturns: [],
    closedTrades: [],
    openTrade: null,
    tradeWins: 0, tradeLosses: 0,
    grossProfit: 0, grossLoss: 0,
    confidenceSum: 0, confidenceCount: 0,
  }
}

function currentEquity(state: PortfolioState): number {
  return state.capital + state.position * state.avgCost
}

/** Walk-forward backtest for a single instrument. */
export function backtestInstrument(
  ticker: string,
  sector: string,
  rows: OhlcvRow[],
  config: Partial<BacktestConfig> = {},
): BacktestResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const initialCapital = cfg.initialCapital

  if (rows.length < 252) {
    return {
      ticker, sector,
      initialPrice: rows[0]?.close ?? 0, finalPrice: rows[rows.length - 1]?.close ?? 0,
      totalReturn: 0, annualizedReturn: 0, sharpeRatio: null, sortinoRatio: null,
      maxDrawdown: 0, winRate: 0, profitFactor: 0, avgTradeReturn: 0,
      totalTrades: 0, closedTrades: [], openTrade: null,
      dailyReturns: [], equityCurve: [initialCapital],
      days: rows.length, confidenceAvg: 0, stopLossPct: cfg.stopLossPct,
      bnhReturn: 0, excessReturn: 0,
    }
  }

  let state = newPortfolio(initialCapital)
  const closes = rows.map(r => r.close)
  const bars: OhlcBar[] = rows.map(({ open, high, low, close }) => ({ open, high, low, close }))

  // Pre-compute ATR for all bars (14-period, no look-ahead)
  const atrVals = atr(bars, 14)

  // Walk forward day by day (need 200 bars warmup)
  for (let i = 200; i < rows.length; i++) {
    const row = rows[i]
    const date = new Date(row.time * 1000).toISOString().split('T')[0]
    const price = row.close
    // Use only data up to today (no look-ahead bias)
    const lookbackCloses = closes.slice(0, i + 1)
    const lookbackBars = bars.slice(0, i + 1)

    // ── ATR-adaptive stop-loss + trailing stop ──
    if (state.openTrade) {
      // ATR% at entry for adaptive stop
      const atrAtEntry = state.openTrade.atrAtrPctAtEntry ?? 0.10
      // Adaptive stop: 1.5x ATR%, floored at 5%, capped at 15%
      const atrStopPct = Math.max(0.05, Math.min(0.15, 1.5 * atrAtEntry))
      const stopPx = state.openTrade.action === 'BUY'
        ? state.openTrade.entryPrice * (1 - atrStopPct)
        : state.openTrade.entryPrice * (1 + atrStopPct)

      // Trailing stop: track highest price after BUY entry
      if (state.openTrade.action === 'BUY') {
        const peakPrice = state.openTrade.highestPriceAfterEntry ?? state.openTrade.entryPrice
        state.openTrade.highestPriceAfterEntry = Math.max(peakPrice, price)
        // Profit measured from entry
        const profitFromEntry = (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
        // 2x ATR profit → raise stop to break-even
        const atrVal = atrVals[i] ?? 0
        const twoAtrProfit = (2 * atrVal) / state.openTrade.entryPrice
        const fourAtrProfit = (4 * atrVal) / state.openTrade.entryPrice
        if (profitFromEntry >= twoAtrProfit) {
          // Raise stop to break-even
          const trailStopPx = state.openTrade.entryPrice * (1 + 0.005) // just above break-even
          if (price <= trailStopPx) {
            const proceeds = state.position * price
            const txCost = proceeds * TX_COST_PCT
            const netProceeds = proceeds - txCost
            const pnlPct = (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
            if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
            else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
            state.capital += netProceeds
            state.openTrade.exitPrice = price
            state.openTrade.pnlPct = pnlPct
            state.closedTrades.push({ ...state.openTrade })
            state.position = 0; state.avgCost = 0; state.openTrade = null
            state.equityHistory.push(currentEquity(state))
            continue
          }
        }
        // 4x ATR profit → tighten to lock in 1x ATR gain
        if (profitFromEntry >= fourAtrProfit) {
          const lockStopPx = price - atrVal  // lock in 1x ATR profit
          if (price <= lockStopPx) {
            const proceeds = state.position * price
            const txCost = proceeds * TX_COST_PCT
            const netProceeds = proceeds - txCost
            const pnlPct = (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
            if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
            else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
            state.capital += netProceeds
            state.openTrade.exitPrice = price
            state.openTrade.pnlPct = pnlPct
            state.closedTrades.push({ ...state.openTrade })
            state.position = 0; state.avgCost = 0; state.openTrade = null
            state.equityHistory.push(currentEquity(state))
            continue
          }
        }
      }

      // Primary stop-loss check
      if ((state.openTrade.action === 'BUY' && price <= stopPx) ||
          (state.openTrade.action === 'SELL' && price >= stopPx)) {
        const proceeds = state.position * price
        const txCost = proceeds * TX_COST_PCT
        const netProceeds = proceeds - txCost
        const pnlPct = state.openTrade.action === 'BUY'
          ? (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
          : (state.openTrade.entryPrice - price) / state.openTrade.entryPrice
        if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
        else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
        state.capital += netProceeds
        state.openTrade.exitPrice = price
        state.openTrade.pnlPct = pnlPct
        state.closedTrades.push({ ...state.openTrade })
        state.position = 0; state.avgCost = 0; state.openTrade = null
        const eq = currentEquity(state)
        state.equityHistory.push(eq)
        continue
      }
    }

    // ── Portfolio max-drawdown circuit breaker ──
    const eq = currentEquity(state)
    if (eq > state.peakEquity) state.peakEquity = eq
    const dd = (state.peakEquity - eq) / state.peakEquity
    if (dd >= cfg.maxDrawdownCap && state.openTrade) {
      const proceeds = state.position * price
      const txCost = proceeds * TX_COST_PCT
      const netProceeds = proceeds - txCost
      const pnlPct = state.openTrade.action === 'BUY'
        ? (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
        : (state.openTrade.entryPrice - price) / state.openTrade.entryPrice
      if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
      else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
      state.capital += netProceeds
      state.openTrade.exitPrice = price
      state.openTrade.pnlPct = pnlPct
      state.closedTrades.push({ ...state.openTrade })
      state.position = 0; state.avgCost = 0; state.openTrade = null
      state.equityHistory.push(currentEquity(state))
      continue
    }

    // ── Signal generation ──
    const signal = combinedSignal(ticker, date, price, lookbackCloses, lookbackBars, cfg)

    if (signal.action === 'BUY' && !state.openTrade) {
      const kellyFrac = Math.min(signal.KellyFraction, 0.50)
      const allocation = state.capital * kellyFrac
      const shares = Math.floor(allocation / price)
      if (shares <= 0) {
        state.equityHistory.push(currentEquity(state))
        continue
      }
      const entryCost = shares * price
      const txCost = entryCost * TX_COST_PCT
      state.capital -= (entryCost + txCost)  // buy + transaction cost
      state.position += shares
      state.avgCost = price
      state.openTrade = {
        date, ticker, sector,
        action: 'BUY',
        entryPrice: price,
        exitPrice: 0,
        shares, value: entryCost,
        regime: signal.regime.label, dipSignal: signal.regime.dipSignal,
        confidence: signal.confidence, pnlPct: null, reason: signal.reason,
        atrAtrPctAtEntry: Number.isFinite(atrVals[i]) ? (atrVals[i] / price) * 100 : 0.10,
        highestPriceAfterEntry: price,
      }
      state.confidenceSum += signal.confidence
      state.confidenceCount++
      state.equityHistory.push(currentEquity(state))

    } else if (signal.action === 'SELL' && state.openTrade) {
      const proceeds = state.position * price
      const txCost = proceeds * TX_COST_PCT  // exit commission
      const netProceeds = proceeds - txCost
      // PnL% = gross return before transaction costs (used for strategy classification)
      const pnlPct = (price - state.openTrade.entryPrice) / state.openTrade.entryPrice
      if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
      else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
      state.capital += netProceeds
      state.openTrade.exitPrice = price
      state.openTrade.pnlPct = pnlPct
      state.closedTrades.push({ ...state.openTrade })
      state.position = 0; state.avgCost = 0; state.openTrade = null
      state.equityHistory.push(currentEquity(state))

    } else {
      state.equityHistory.push(currentEquity(state))
    }
  }

  // ── Close remaining open position at final price ──
  const finalPrice = rows[rows.length - 1].close
  if (state.openTrade) {
    const proceeds = state.position * finalPrice
    const txCost = proceeds * TX_COST_PCT
    const netProceeds = proceeds - txCost
    const pnlPct = (finalPrice - state.openTrade.entryPrice) / state.openTrade.entryPrice
    if (pnlPct > 0) { state.tradeWins++; state.grossProfit += pnlPct }
    else { state.tradeLosses++; state.grossLoss += Math.abs(pnlPct) }
    state.capital += netProceeds
    state.openTrade.exitPrice = finalPrice
    state.openTrade.pnlPct = pnlPct
    state.closedTrades.push({ ...state.openTrade })
    state.position = 0
  }

  const finalEquity = state.capital
  const days = rows.length
  const years = days / 252
  const totalReturn = (finalEquity - initialCapital) / initialCapital
  const annualizedReturn = years > 0 ? (1 + totalReturn) ** (1 / years) - 1 : 0
  const bnhReturn = (finalPrice - rows[0].close) / rows[0].close

  // Equity curve metrics
  let peak = initialCapital, maxDd = 0
  for (const eq of state.equityHistory) {
    if (eq > peak) peak = eq
    const d = (peak - eq) / peak
    if (d > maxDd) maxDd = d
  }

  // Compute daily returns from equity curve (for Sharpe/Sortino)
  const dailyReturns: number[] = []
  for (let i = 1; i < state.equityHistory.length; i++) {
    const ret = (state.equityHistory[i] - state.equityHistory[i - 1]) / state.equityHistory[i - 1]
    if (Number.isFinite(ret)) dailyReturns.push(ret)
  }

  // Win rate
  const closed = state.closedTrades
  const winRate = closed.length > 0 ? state.tradeWins / closed.length : 0
  const profitFactor = state.grossLoss > 0 ? state.grossProfit / state.grossLoss : state.grossProfit > 0 ? Infinity : 0
  const avgTradeReturn = closed.length > 0 ? closed.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / closed.length : 0

  // Sharpe (annualized, daily)
  let sharpe: number | null = null
  if (dailyReturns.length > 30) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const v = dailyReturns.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, dailyReturns.length - 1)
    const sd = Math.sqrt(Math.max(v, 0))
    if (sd > 1e-10) {
      const rfD = 0.04 / 252
      sharpe = ((mean - rfD) / sd) * Math.sqrt(252)
    }
  }

  // Sortino
  let sortino: number | null = null
  if (dailyReturns.length > 30) {
    const neg = dailyReturns.filter(x => x < 0)
    if (neg.length > 0) {
      const dsd = Math.sqrt(neg.reduce((s, x) => s + x * x, 0) / neg.length)
      if (dsd > 1e-10) {
        const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
        const rfD = 0.04 / 252
        sortino = ((mean - rfD) / dsd) * Math.sqrt(252)
      }
    }
  }

  return {
    ticker, sector,
    initialPrice: rows[0].close, finalPrice,
    totalReturn, annualizedReturn,
    sharpeRatio: Number.isFinite(sharpe) ? sharpe : null,
    sortinoRatio: Number.isFinite(sortino) ? sortino : null,
    maxDrawdown: maxDd, winRate, profitFactor, avgTradeReturn,
    totalTrades: closed.length, closedTrades: closed,
    openTrade: null,
    dailyReturns,
    equityCurve: state.equityHistory,
    days, confidenceAvg: state.confidenceCount > 0 ? state.confidenceSum / state.confidenceCount : 0,
    stopLossPct: cfg.stopLossPct,
    bnhReturn, excessReturn: totalReturn - bnhReturn,
  }
}

// ─── Portfolio aggregator ─────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalReturn: number
  annualizedReturn: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  maxDrawdown: number
  winRate: number
  profitFactor: number
  avgTradeReturn: number
  totalTrades: number
  totalInstruments: number
  sectorReturns: Record<string, { totalReturn: number; annReturn: number; tickers: string[] }>
  instruments: BacktestResult[]
  initialCapital: number
  finalCapital: number
}

export function aggregatePortfolio(results: BacktestResult[], initialCapital: number): PortfolioSummary {
  const allTrades = results.flatMap(r => r.closedTrades)
  const winningTrades = allTrades.filter(t => (t.pnlPct ?? 0) > 0)
  const winRate = allTrades.length > 0 ? winningTrades.length / allTrades.length : 0
  const grossProfit = winningTrades.reduce((s, t) => s + (t.pnlPct ?? 0), 0)
  const grossLoss = Math.abs(allTrades.filter(t => (t.pnlPct ?? 0) < 0).reduce((s, t) => s + (t.pnlPct ?? 0), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
  const avgTradeReturn = allTrades.length > 0 ? allTrades.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / allTrades.length : 0

  // Sector aggregation
  const sectorMap: Record<string, { sumRet: number; sumAnn: number; tickers: string[]; count: number }> = {}
  for (const r of results) {
    if (!sectorMap[r.sector]) sectorMap[r.sector] = { sumRet: 0, sumAnn: 0, tickers: [], count: 0 }
    sectorMap[r.sector].sumRet += r.totalReturn
    sectorMap[r.sector].sumAnn += r.annualizedReturn
    sectorMap[r.sector].tickers.push(r.ticker)
    sectorMap[r.sector].count++
  }
  const sectorReturns: Record<string, { totalReturn: number; annReturn: number; tickers: string[] }> = {}
  for (const [sector, data] of Object.entries(sectorMap)) {
    sectorReturns[sector] = {
      totalReturn: data.sumRet / Math.max(data.count, 1),
      annReturn: data.sumAnn / Math.max(data.count, 1),
      tickers: data.tickers,
    }
  }

  const maxDrawdown = Math.max(...results.map(r => r.maxDrawdown))
  const avgReturn = results.reduce((s, r) => s + r.totalReturn, 0) / Math.max(results.length, 1)
  const avgAnnReturn = results.reduce((s, r) => s + r.annualizedReturn, 0) / Math.max(results.length, 1)
  const bnhAvg = results.reduce((s, r) => s + r.bnhReturn, 0) / Math.max(results.length, 1)

  // ── Portfolio-level Sharpe/Sortino from combined equity curve ─────────────────
  // Build a proper combined equity curve: sum of all instruments' equity at each date.
  // Only use the common date range (minimum length across instruments) to avoid
  // look-ahead bias from staggered data.
  const commonLen = results.length > 0
    ? Math.min(...results.map(r => r.equityCurve.length))
    : 0

  let sharpe: number | null = null
  let sortino: number | null = null
  if (commonLen > 30) {
    // Build combined equity: sum of normalized equity (each starts at initialCapital)
    const combinedEquity: number[] = []
    for (let i = 0; i < commonLen; i++) {
      let total = 0
      for (const r of results) {
        total += r.equityCurve[i]
      }
      combinedEquity.push(total)
    }
    // Compute daily returns from combined equity
    const portfolioDailyReturns: number[] = []
    for (let i = 1; i < combinedEquity.length; i++) {
      const ret = (combinedEquity[i] - combinedEquity[i - 1]) / combinedEquity[i - 1]
      if (Number.isFinite(ret)) portfolioDailyReturns.push(ret)
    }
    if (portfolioDailyReturns.length > 30) {
      const mean = portfolioDailyReturns.reduce((a, b) => a + b, 0) / portfolioDailyReturns.length
      const variance = portfolioDailyReturns.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, portfolioDailyReturns.length - 1)
      const sd = Math.sqrt(Math.max(variance, 0))
      if (sd > 1e-10) {
        const rfD = 0.04 / 252
        sharpe = ((mean - rfD) / sd) * Math.sqrt(252)
      }
      const negReturns = portfolioDailyReturns.filter(x => x < 0)
      if (negReturns.length > 0) {
        const dsd = Math.sqrt(negReturns.reduce((s, x) => s + x * x, 0) / negReturns.length)
        if (dsd > 1e-10) {
          const rfD = 0.04 / 252
          sortino = ((mean - rfD) / dsd) * Math.sqrt(252)
        }
      }
    }
  }

  const finalCapital = initialCapital * (1 + avgReturn)

  return {
    totalReturn: avgReturn,
    annualizedReturn: avgAnnReturn,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    maxDrawdown,
    winRate,
    profitFactor,
    avgTradeReturn,
    totalTrades: allTrades.length,
    totalInstruments: results.length,
    sectorReturns,
    instruments: results,
    initialCapital,
    finalCapital,
  }
}

// ─── Walk-Forward Analysis ──────────────────────────────────────────────────────
// Splits data into N in-sample (training) and out-of-sample (testing) windows.
// This is the gold standard for detecting overfitting: if IS ≫ OOS, the strategy
// is likely curve-fit. Robust strategies show similar metrics in both periods.

export interface WFWWindow {
  periodLabel: string
  startDate: string
  endDate: string
  isReturn: number      // in-sample annualized return
  isSharpe: number | null
  osReturn: number      // out-of-sample annualized return
  osSharpe: number | null
  oosRatio: number      // OOS/IS ratio (1.0 = perfect out-of-sample, <0.5 = overfit suspicion)
}

function annualized(totalReturn: number, days: number): number {
  const years = days / 252
  return years > 0 ? ((1 + totalReturn) ** (1 / years) - 1) : 0
}

function windowSharpe(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 30) return null
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, dailyReturns.length - 1)
  const sd = Math.sqrt(Math.max(variance, 0))
  if (sd < 1e-10) return null
  const rfD = 0.04 / 252
  return ((mean - rfD) / sd) * Math.sqrt(252)
}

export function walkForwardAnalysis(
  ticker: string,
  sector: string,
  rows: OhlcvRow[],
  trainDays = 252,
  testDays = 63,
): WFWWindow[] {
  // trainDays = 1 year in-sample, testDays = 1 quarter out-of-sample
  const windows: WFWWindow[] = []
  const n = rows.length
  let trainStart = 0

  while (trainStart + trainDays + testDays <= n) {
    const trainEnd = trainStart + trainDays
    const testEnd = trainEnd + testDays

    const trainRows = rows.slice(trainStart, trainEnd)
    const testRows = rows.slice(trainEnd, testEnd)

    if (trainRows.length < 100 || testRows.length < 20) break

    const trainResult = backtestInstrument(ticker, sector, trainRows)
    const testResult = backtestInstrument(ticker, sector, testRows)

    const isAnn = annualized(trainResult.totalReturn, trainRows.length)
    const osAnn = annualized(testResult.totalReturn, testRows.length)
    const isSharpe = windowSharpe(trainResult.dailyReturns)
    const osSharpe = windowSharpe(testResult.dailyReturns)
    const oosRatio = isAnn !== 0 ? Math.min(2, Math.max(-1, osAnn / isAnn)) : 0

    windows.push({
      periodLabel: `${new Date(trainRows[0].time * 1000).toISOString().slice(0, 7)} – ${new Date(testRows[testRows.length - 1].time * 1000).toISOString().slice(0, 7)}`,
      startDate: new Date(trainRows[0].time * 1000).toISOString().split('T')[0],
      endDate: new Date(testRows[testRows.length - 1].time * 1000).toISOString().split('T')[0],
      isReturn: isAnn,
      isSharpe,
      osReturn: osAnn,
      osSharpe,
      oosRatio,
    })

    trainStart += testDays
  }

  return windows
}

export interface WalkForwardSummary {
  avgIsReturn: number
  avgOsReturn: number
  avgIsSharpe: number | null
  avgOsSharpe: number | null
  avgOosRatio: number
  overfittingIndex: number   // 0 = perfectly robust, 1 = fully overfit (IS ≫ OS)
  windows: WFWWindow[]
}

export function walkForwardSummary(windows: WFWWindow[]): WalkForwardSummary {
  if (windows.length === 0) {
    return { avgIsReturn: 0, avgOsReturn: 0, avgIsSharpe: null, avgOsSharpe: null, avgOosRatio: 0, overfittingIndex: 1, windows }
  }
  const avgIsReturn = windows.reduce((s, w) => s + w.isReturn, 0) / windows.length
  const avgOsReturn = windows.reduce((s, w) => s + w.osReturn, 0) / windows.length
  const avgIsSharpe = windows.reduce((s, w) => s + (w.isSharpe ?? 0), 0) / windows.length
  const avgOsSharpe = windows.reduce((s, w) => s + (w.osSharpe ?? 0), 0) / windows.length
  const avgOosRatio = windows.reduce((s, w) => s + w.oosRatio, 0) / windows.length
  // overfittingIndex: 0 = IS ≈ OS, > 0.5 = suspicious overfitting
  const overfittingIndex = avgIsReturn > 0
    ? Math.max(0, Math.min(1, (avgIsReturn - avgOsReturn) / (Math.abs(avgIsReturn) + 0.001)))
    : 0

  return { avgIsReturn, avgOsReturn, avgIsSharpe: Number.isFinite(avgIsSharpe) ? avgIsSharpe : null, avgOsSharpe: Number.isFinite(avgOsSharpe) ? avgOsSharpe : null, avgOosRatio, overfittingIndex, windows }
}
