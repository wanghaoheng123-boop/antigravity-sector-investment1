/**
 * Market Maker Behavior Reverse-Engineering Module
 *
 * Elena Rodriguez's methodology for reverse-engineering what market makers are doing:
 *
 * 1. Cumulative Delta: Tick-rule approximation of buyer/seller-initiated volume
 * 2. Order Flow Imbalance: Bid/ask size ratio as proxy for order imbalance
 * 3. Dealer Hedging Pressure: From options gamma — dealers must hedge their options exposure
 * 4. Smart Money Detection: Compare delta flow vs price movement to find divergences
 * 5. Dark Pool Flow: Estimate off-exchange vs on-exchange volume ratio
 *
 * All calculations annotated with DataVerification for investor transparency.
 */

import { createVerification, DataVerification } from '@/lib/research/dataVerification'
import type { OhlcvRow } from '@/lib/backtest/dataLoader'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DeltaBar {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
  delta: number         // buyer-initiated - seller-initiated volume
  cumulativeDelta: number  // running sum
  bidVolume: number    // estimated
  askVolume: number    // estimated
  deltaPercent: number // delta / volume
}

export interface MarketMakerState {
  ticker: string
  quoteTime: string
  // Bid-Ask
  bid: number
  ask: number
  bidSize: number
  askSize: number
  spread: number
  spreadPct: number
  midPrice: number
  // Order Imbalance
  orderImbalance: number         // -1 (all ask) to +1 (all bid)
  imbalanceDirection: 'bid' | 'ask' | 'balanced'
  imbalanceStrength: 'extreme' | 'strong' | 'moderate' | 'weak'
  // Delta flow
  netDelta1d: number           // cumulative delta today
  deltaVsPrice: 'converging' | 'diverging' | 'aligned'
  smartMoneySignal: 'accumulating' | 'distributing' | 'neutral'
  // MM Hedging
  hedgingBias: 'buy' | 'sell' | 'neutral'
  hedgingPressure: number        // -100 to +100
  // Verification
  dataVerification: DataVerification
}

export interface DeltaAnalysis {
  ticker: string
  bars: DeltaBar[]
  summary: {
    totalVolume: number
    totalDelta: number
    deltaRatio: number      // delta / volume — positive = buyer-initiated dominant
    maxConcentration: { time: string; delta: number } | null
    divergenceFound: boolean
    divergenceType: 'bearish' | 'bullish' | 'none'
    divergenceStrength: number  // 0-100
  }
  dataVerification: DataVerification
}

// ─── Delta Calculation (Tick Rule) ──────────────────────────────────────────

/**
 * Tick Rule Delta Approximation
 *
 * The tick rule classifies each trade as buyer-initiated or seller-initiated:
 * - If price goes UP from last price → buyer-initiated (delta positive)
 * - If price goes DOWN from last price → seller-initiated (delta negative)
 *
 * For OHLCV bars, we use the bar's OHLC to approximate:
 * buyerVolume ≈ volume * (close - low) / (high - low)
 * sellerVolume ≈ volume - buyerVolume
 * delta = buyerVolume - sellerVolume
 *
 * This is a standard approximation used in all major order flow tools.
 */
export function calcDeltaBar(candle: OhlcvRow, prevClose?: number): {
  delta: number
  bidVolume: number
  askVolume: number
} {
  const { open, high, low, close, volume } = candle

  if (high === low) {
    // No range — use tick rule with previous close
    const priceChange = prevClose != null ? close - prevClose : 0
    if (priceChange > 0) {
      return { delta: volume, bidVolume: volume, askVolume: 0 }
    } else if (priceChange < 0) {
      return { delta: -volume, bidVolume: 0, askVolume: volume }
    }
    return { delta: 0, bidVolume: volume / 2, askVolume: volume / 2 }
  }

  // Volume at price approximation
  const buyerVolume = volume * (close - low) / (high - low)
  const sellerVolume = volume - buyerVolume
  const delta = buyerVolume - sellerVolume

  return {
    delta,
    bidVolume: buyerVolume,
    askVolume: sellerVolume,
  }
}

/**
 * Build delta bars from OHLCV candles
 * Works on any timeframe (intraday, daily, etc.)
 */
export function buildDeltaBars(candles: OhlcvRow[]): DeltaBar[] {
  let cumulativeDelta = 0
  let prevClose: number | undefined

  return candles.map((candle) => {
    const { delta, bidVolume, askVolume } = calcDeltaBar(candle, prevClose)
    cumulativeDelta += delta
    prevClose = candle.close

    return {
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      delta,
      cumulativeDelta,
      bidVolume,
      askVolume,
      deltaPercent: candle.volume > 0 ? delta / candle.volume : 0,
    }
  })
}

// ─── Order Flow Imbalance ───────────────────────────────────────────────────

export interface OrderImbalanceResult {
  imbalance: number         // -1 to 1
  direction: 'bid' | 'ask' | 'balanced'
  strength: 'extreme' | 'strong' | 'moderate' | 'weak'
  rawRatio: number          // bidVol / askVol
  confidence: number        // 0-1
}

/**
 * Calculate order imbalance from bid/ask sizes
 *
 * Imbalance = (bidVol - askVol) / (bidVol + askVol)
 * +1 = all buy-side pressure
 * -1 = all sell-side pressure
 *
 * If Bloomberg bid/ask not available, uses delta-based approximation
 */
export function calcOrderImbalance(
  bidSize: number,
  askSize: number
): OrderImbalanceResult {
  const total = bidSize + askSize
  if (total === 0) {
    return { imbalance: 0, direction: 'balanced', strength: 'weak', rawRatio: 1, confidence: 0 }
  }

  const imbalance = (bidSize - askSize) / total
  const rawRatio = askSize > 0 ? bidSize / askSize : bidSize > 0 ? Infinity : 1

  let direction: OrderImbalanceResult['direction']
  if (imbalance > 0.1) direction = 'bid'
  else if (imbalance < -0.1) direction = 'ask'
  else direction = 'balanced'

  let strength: OrderImbalanceResult['strength']
  const absImb = Math.abs(imbalance)
  if (absImb > 0.7) strength = 'extreme'
  else if (absImb > 0.4) strength = 'strong'
  else if (absImb > 0.2) strength = 'moderate'
  else strength = 'weak'

  const confidence = Math.min(1, Math.abs(imbalance))

  return { imbalance, direction, strength, rawRatio, confidence }
}

// ─── Smart Money Detection ─────────────────────────────────────────────────

export type SmartMoneySignal = 'accumulating' | 'distributing' | 'neutral' | 'uncertain'

/**
 * Smart Money Detection: Compare price movement vs delta flow
 *
 * Accumulating (bullish divergence):
 *   - Price FALLS but delta is POSITIVE → smart money is buying while others sell
 *
 * Distributing (bearish divergence):
 *   - Price RISES but delta is NEGATIVE → smart money is selling while others buy
 *
 * Baseline (aligned):
 *   - Price and delta move together — no divergence signal
 */
export function detectSmartMoneyDivergence(
  bars: DeltaBar[],
  lookback: number = 20
): {
  signal: SmartMoneySignal
  divergenceType: 'bullish' | 'bearish' | 'none'
  strength: number  // 0-100
  description: string
} {
  const recent = bars.slice(-lookback)
  if (recent.length < 5) {
    return { signal: 'uncertain', divergenceType: 'none', strength: 0, description: 'Insufficient data for smart money analysis' }
  }

  // Calculate correlation between delta and price returns
  const deltas = recent.map(b => b.delta)
  const returns = recent.map((b, i) => i > 0 ? (b.close - recent[i - 1].close) / recent[i - 1].close : 0)

  const deltaMean = deltas.reduce((s, d) => s + d, 0) / deltas.length
  const retMean = returns.reduce((s, r) => s + r, 0) / returns.length

  // Simple correlation: positive = aligned, negative = diverging
  let covariance = 0, deltaVar = 0, retVar = 0
  for (let i = 0; i < recent.length; i++) {
    const dDiff = deltas[i] - deltaMean
    const rDiff = returns[i] - retMean
    covariance += dDiff * rDiff
    deltaVar += dDiff * dDiff
    retVar += rDiff * rDiff
  }

  const correlation = deltaVar > 0 && retVar > 0 ? covariance / Math.sqrt(deltaVar * retVar) : 0

  // Detect divergences
  const lastPrice = recent[recent.length - 1].close
  const firstPrice = recent[0].close
  const priceChangePct = ((lastPrice - firstPrice) / firstPrice) * 100

  const lastDelta = recent[recent.length - 1].cumulativeDelta
  const firstDelta = recent[0].cumulativeDelta
  const deltaChange = lastDelta - firstDelta

  const priceUp = priceChangePct > 0.5
  const priceDown = priceChangePct < -0.5
  const deltaUp = deltaChange > 0
  const deltaDown = deltaChange < 0

  let signal: SmartMoneySignal
  let divergenceType: 'bullish' | 'bearish' | 'none' = 'none'
  let strength = 50

  if (correlation < -0.3) {
    // Negative correlation = divergence
    if (priceDown && deltaUp) {
      signal = 'accumulating'
      divergenceType = 'bullish'
      strength = Math.min(100, Math.round(Math.abs(correlation) * 100 + 20))
    } else if (priceUp && deltaDown) {
      signal = 'distributing'
      divergenceType = 'bearish'
      strength = Math.min(100, Math.round(Math.abs(correlation) * 100 + 20))
    } else {
      signal = 'neutral'
    }
  } else if (correlation > 0.5) {
    // Aligned — no divergence
    signal = 'neutral'
  } else {
    signal = 'uncertain'
  }

  const descriptions: Record<SmartMoneySignal, string> = {
    accumulating: `Price down ${Math.abs(priceChangePct).toFixed(2)}% but delta positive → institutional accumulation detected. Smart money buying while retail sells.`,
    distributing: `Price up ${priceChangePct.toFixed(2)}% but delta negative → institutional distribution detected. Smart money selling while retail buys.`,
    neutral: `Price and delta aligned — no divergence. Institutional and retail flow in same direction.`,
    uncertain: `Insufficient divergence signal. Correlation=${correlation.toFixed(2)}. More data needed.`,
  }

  return { signal, divergenceType, strength, description: descriptions[signal] }
}

// ─── Dealer Hedging Pressure ─────────────────────────────────────────────────

export interface HedgingPressureResult {
  hedgingBias: 'buy' | 'sell' | 'neutral'
  pressure: number      // -100 to +100 (negative=sell, positive=buy)
  reason: string
  totalGamma: number    // net gamma exposure
  spotDirection: 'up' | 'down' | 'flat'
}

/**
 * Calculate dealer hedging pressure from options gamma
 *
 * When dealers are SHORT gamma (negative total gamma exposure):
 *   - Price goes UP → dealers must BUY stock to hedge their short calls
 *   - Price goes DOWN → dealers must SELL stock to hedge their short puts
 *   → This AMPLIFIES market moves (destabilizing)
 *
 * When dealers are LONG gamma (positive total gamma exposure):
 *   - Price goes UP → dealers must SELL stock to hedge their long calls
 *   - Price goes DOWN → dealers must BUY stock to hedge their long puts
 *   → This STABILIZES market (mean-reverting)
 *
 * pressure scale:
 *   +100 = dealers must aggressively buy stock
 *   -100 = dealers must aggressively sell stock
 *     0 = gamma-neutral, no hedging needed
 */
export function calcDealerHedgingPressure(
  netGamma: number,       // sum of (callGamma - putGamma) across all strikes
  spotPrice: number,
  spotChangePct: number  // intraday change %
): HedgingPressureResult {
  const absNetGamma = Math.abs(netGamma)

  // Normalize gamma to a pressure scale
  // Higher absolute gamma = more hedging pressure when price moves
  const gammaScale = Math.min(1, absNetGamma / 1_000_000)  // normalize to ~1M shares equivalent

  let hedgingBias: HedgingPressureResult['hedgingBias']
  let pressure: number
  let reason: string

  if (netGamma >= 0) {
    // Dealers are LONG gamma (long calls > long puts)
    // They must sell stock when price rises, buy when price falls
    // = STABILIZING (mean-reverting)
    if (spotChangePct > 0.5) {
      hedgingBias = 'sell'
      pressure = -Math.round(gammaScale * 80)
      reason = `Dealers long gamma: selling to hedge long calls as price rises. Stabilizing pressure.`
    } else if (spotChangePct < -0.5) {
      hedgingBias = 'buy'
      pressure = Math.round(gammaScale * 80)
      reason = `Dealers long gamma: buying to hedge long calls as price falls. Stabilizing pressure.`
    } else {
      hedgingBias = 'neutral'
      pressure = 0
      reason = `Dealers long gamma, price flat. No immediate hedging required.`
    }
  } else {
    // Dealers are SHORT gamma (sold more puts than calls)
    // They must buy stock when price rises (hedge short calls), sell when price falls (hedge short puts)
    // = DESTABILIZING (momentum amplifying)
    if (spotChangePct > 0.5) {
      hedgingBias = 'buy'
      pressure = Math.round(gammaScale * 80)
      reason = `Dealers short gamma: buying to hedge short calls as price rises. Destabilizing — amplifies rallies.`
    } else if (spotChangePct < -0.5) {
      hedgingBias = 'sell'
      pressure = -Math.round(gammaScale * 80)
      reason = `Dealers short gamma: selling to hedge short puts as price falls. Destabilizing — amplifies selloffs.`
    } else {
      hedgingBias = 'neutral'
      pressure = 0
      reason = `Dealers short gamma, price flat. No immediate hedging required.`
    }
  }

  return {
    hedgingBias,
    pressure,
    reason,
    totalGamma: netGamma,
    spotDirection: spotChangePct > 0.5 ? 'up' : spotChangePct < -0.5 ? 'down' : 'flat',
  }
}

// ─── Dark Pool Flow Estimation ───────────────────────────────────────────────

export interface DarkPoolFlowResult {
  estimatedOffExchangePct: number  // estimated % off-exchange
  onOffRatio: number
  flowSignal: 'buy_side' | 'sell_side' | 'balanced'
  darkPoolBias: 'institutional_buy' | 'institutional_sell' | 'neutral'
}

/**
 * Estimate dark pool flow from volume and delta
 *
 * If delta is strongly positive but price is flat/mixed →
 *   volume is happening off-exchange (dark pool matches buyers/sellers)
 *
 * If delta is negative but price is rising →
 *   institutional sellers using dark pool to offload without moving price
 *
 * This is an approximation using the delta-volume relationship
 */
export function estimateDarkPoolFlow(
  bars: DeltaBar[],
  lookback: number = 20
): DarkPoolFlowResult {
  const recent = bars.slice(-lookback)
  if (recent.length < 3) {
    return {
      estimatedOffExchangePct: 0,
      onOffRatio: 1,
      flowSignal: 'balanced',
      darkPoolBias: 'neutral',
    }
  }

  // Compare on-exchange delta vs actual price movement
  const netDelta = recent[recent.length - 1].cumulativeDelta - recent[0].cumulativeDelta
  const priceStart = recent[0].open
  const priceEnd = recent[recent.length - 1].close
  const priceReturn = (priceEnd - priceStart) / priceStart

  const totalVolume = recent.reduce((s, b) => s + b.volume, 0)

  // If delta is much smaller than price movement suggests, heavy off-exchange activity
  // If delta and price align, mostly on-exchange
  const deltaRatio = totalVolume > 0 ? netDelta / totalVolume : 0

  // Simple model: if delta and price sign disagree, lots of dark pool
  // Estimate % dark = 1 - |delta_alignment|
  const alignment = Math.abs(priceReturn) > 0 ? deltaRatio / (priceReturn * 100) : 0
  const clampedAlignment = Math.max(-1, Math.min(1, alignment))
  const estimatedOffExchangePct = Math.max(0, Math.min(60, (1 - Math.abs(clampedAlignment)) * 50))

  const onOffRatio = estimatedOffExchangePct > 0
    ? (100 - estimatedOffExchangePct) / estimatedOffExchangePct
    : 99

  let flowSignal: DarkPoolFlowResult['flowSignal']
  if (deltaRatio > 0.1) flowSignal = 'buy_side'
  else if (deltaRatio < -0.1) flowSignal = 'sell_side'
  else flowSignal = 'balanced'

  let darkPoolBias: DarkPoolFlowResult['darkPoolBias']
  if (priceReturn > 0.01 && deltaRatio < -0.1) {
    darkPoolBias = 'institutional_sell'  // price up but delta down = selling into rallies via dark pool
  } else if (priceReturn < -0.01 && deltaRatio > 0.1) {
    darkPoolBias = 'institutional_buy'   // price down but delta up = buying dips via dark pool
  } else {
    darkPoolBias = 'neutral'
  }

  return { estimatedOffExchangePct, onOffRatio, flowSignal, darkPoolBias }
}

// ─── Full Market Maker State ───────────────────────────────────────────────

export function buildMarketMakerState(
  ticker: string,
  quoteTime: string,
  candles: OhlcvRow[],
  bid: number,
  ask: number,
  bidSize: number,
  askSize: number,
  netGamma: number = 0,
  spotChangePct: number = 0
): MarketMakerState {
  const bars = buildDeltaBars(candles)
  const { signal, divergenceType, strength: divStrength } = detectSmartMoneyDivergence(bars)
  const { imbalance, direction, strength } = calcOrderImbalance(bidSize, askSize)
  const hedging = calcDealerHedgingPressure(netGamma, bid, spotChangePct)
  const darkPool = estimateDarkPoolFlow(bars)

  const spread = ask - bid
  const spreadPct = bid > 0 ? (spread / bid) * 100 : 0
  const midPrice = (bid + ask) / 2

  // Determine overall MM state
  let smartMoneySignal: MarketMakerState['smartMoneySignal']
  if (signal === 'accumulating') smartMoneySignal = 'accumulating'
  else if (signal === 'distributing') smartMoneySignal = 'distributing'
  else smartMoneySignal = 'neutral'

  const dataVerification = createVerification(
    bidSize > 0 && askSize > 0 ? 'yahoo' : 'illustrative',
    bidSize > 0 && askSize > 0
      ? `Market maker state from bid/ask sizes (bid=${bid}, ask=${ask}, bidSize=${bidSize}, askSize=${askSize}) and ${candles.length} OHLCV candles. Delta calculated via tick rule. Hedging pressure from options gamma.`
      : `Inferred from ${candles.length} OHLCV candles only. Bid/ask sizes not available — delta used as proxy for order imbalance.`,
    {
      confidence: bidSize > 0 && askSize > 0 ? 0.85 : 0.6,
      rawFields: ['bid', 'ask', 'bidSize', 'askSize', 'high', 'low', 'close', 'open', 'volume'],
      notes: darkPool.darkPoolBias !== 'neutral'
        ? `Dark pool signal: ${darkPool.darkPoolBias}`
        : undefined,
    }
  )

  return {
    ticker,
    quoteTime,
    bid,
    ask,
    bidSize,
    askSize,
    spread,
    spreadPct,
    midPrice,
    orderImbalance: imbalance,
    imbalanceDirection: direction,
    imbalanceStrength: strength,
    netDelta1d: bars.length > 0 ? bars[bars.length - 1].cumulativeDelta : 0,
    deltaVsPrice: divergenceType === 'none' ? 'aligned' : divergenceType === 'bullish' ? 'converging' : 'diverging',
    smartMoneySignal,
    hedgingBias: hedging.hedgingBias,
    hedgingPressure: hedging.pressure,
    dataVerification,
  }
}

// ─── Full Delta Analysis ────────────────────────────────────────────────────

export function buildDeltaAnalysis(
  ticker: string,
  candles: OhlcvRow[]
): DeltaAnalysis {
  const bars = buildDeltaBars(candles)

  if (bars.length === 0) {
    const emptyVerification = createVerification('illustrative', 'No candle data available', { confidence: 0 })
    return {
      ticker,
      bars: [],
      summary: { totalVolume: 0, totalDelta: 0, deltaRatio: 0, maxConcentration: null, divergenceFound: false, divergenceType: 'none', divergenceStrength: 0 },
      dataVerification: emptyVerification,
    }
  }

  const totalVolume = bars.reduce((s, b) => s + b.volume, 0)
  const totalDelta = bars[bars.length - 1].cumulativeDelta
  const deltaRatio = totalVolume > 0 ? totalDelta / totalVolume : 0

  const { divergenceType, strength } = detectSmartMoneyDivergence(bars)

  // Find max delta concentration bar
  let maxBar: DeltaBar | null = null
  for (const bar of bars) {
    if (!maxBar || Math.abs(bar.delta) > Math.abs(maxBar.delta)) {
      maxBar = bar
    }
  }

  const verification = createVerification(
    'yahoo',
    `Delta analysis from ${bars.length} OHLCV candles using tick rule approximation. Cumulative delta: ${totalDelta.toFixed(0)}. Smart money divergence: ${divergenceType}.`,
    { confidence: 0.85, rawFields: ['open', 'high', 'low', 'close', 'volume'] }
  )

  return {
    ticker,
    bars,
    summary: {
      totalVolume,
      totalDelta,
      deltaRatio,
      maxConcentration: maxBar ? { time: String(maxBar.time), delta: maxBar.delta } : null,
      divergenceFound: divergenceType !== 'none',
      divergenceType,
      divergenceStrength: strength,
    },
    dataVerification: verification,
  }
}

// ─── Narrative generation ────────────────────────────────────────────────────

export function buildMmNarrative(state: MarketMakerState): string {
  const parts: string[] = []

  // Hedging
  if (state.hedgingBias === 'buy') {
    parts.push(`Dealers must BUY stock — ${Math.abs(state.hedgingPressure)}% hedging pressure. Market stabilizing.`)
  } else if (state.hedgingBias === 'sell') {
    parts.push(`Dealers must SELL stock — ${Math.abs(state.hedgingPressure)}% hedging pressure. Market destabilizing.`)
  }

  // Smart money
  if (state.smartMoneySignal === 'accumulating') {
    parts.push(`Smart money ACCUMULATING — price falling but delta positive. Institutional buyers active.`)
  } else if (state.smartMoneySignal === 'distributing') {
    parts.push(`Smart money DISTRIBUTING — price rising but delta negative. Institutional sellers active.`)
  }

  // Order imbalance
  if (state.imbalanceDirection === 'bid' && state.imbalanceStrength === 'extreme') {
    parts.push(`EXTREME order imbalance to BUY side. Bid/Ask ratio extremely skewed.`)
  } else if (state.imbalanceDirection === 'ask' && state.imbalanceStrength === 'extreme') {
    parts.push(`EXTREME order imbalance to SELL side. Bid/Ask ratio extremely skewed.`)
  }

  // Spread
  if (state.spreadPct > 0.5) {
    parts.push(`Wide spread: ${state.spreadPct.toFixed(2)}% — low liquidity environment.`)
  }

  if (parts.length === 0) {
    return 'No significant market maker signals detected. Order flow balanced.'
  }

  return parts.join(' ')
}
