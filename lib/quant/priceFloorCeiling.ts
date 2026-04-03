/**
 * Price Floor / Ceiling Detection Engine
 *
 * Multi-algorithm institutional-grade support/resistance detection:
 * 1. Volume-Weighted Support/Resistance (VWSR) — clusters high-volume price levels
 * 2. Institutional Order Block — candles with heavy directional volume
 * 3. VWAP Deviation Bands — statistical mean-reversion zones
 * 4. Gamma Wall Mapping — from options gamma (call wall = ceiling, put wall = floor)
 * 5. Kelly ATR Zones — regime-based dynamic entry/exit levels
 * 6. Fibonacci Retracement — key golden ratio levels from recent swing
 *
 * Each detected level carries a confidence score, evidence summary,
 * and source attribution so investors can verify the basis.
 */

import { createVerification, DataVerification } from '@/lib/research/dataVerification'
import type { OhlcvRow } from '@/lib/backtest/dataLoader'

// ─── Types ─────────────────────────────────────────────────────────────────

export type PriceLevelType = 'floor' | 'ceiling' | 'pivot' | 'vwap_zone' | 'gamma_wall' | 'order_block' | 'fibonacci'

export interface PriceLevelEvidence {
  touchCount: number       // how many times price bounced/rejected here
  avgBouncePct: number    // average reversal % from this level
  totalVolume: number      // relative volume at this level (normalized)
  lastTouch: string | null // ISO timestamp of last touch
}

export interface PriceLevel {
  price: number
  type: PriceLevelType
  strength: number          // 0-100 composite confidence score
  sources: string[]         // which algorithms confirmed this level
  evidence: PriceLevelEvidence
  distanceFromSpot: number  // % distance from current price
  label?: string            // e.g. "Gamma Call Wall", "VWAP +1σ"
}

export interface VwapBand {
  upper: number
  mid: number
  lower: number
  upper2std: number
  lower2std: number
}

export interface FloorCeilingResult {
  ticker: string
  currentPrice: number
  quoteTime: string
  floor: PriceLevel | null
  ceiling: PriceLevel | null
  vwapZone: VwapBand
  nearbyLevels: PriceLevel[]
  bias: 'bullish' | 'bearish' | 'neutral'
  biasConfidence: number
  // Per-algorithm scores
  algorithmScores: {
    vwsrFloorScore: number
    vwsrCeilingScore: number
    orderBlockFloorScore: number
    orderBlockCeilingScore: number
    gammaFloorScore: number
    gammaCeilingScore: number
    fibFloorScore: number
    fibCeilingScore: number
  }
  dataVerification: DataVerification
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(a: number, b: number): number {
  return b > 0 ? ((a - b) / b) * 100 : 0
}

function touchScore(touches: number): number {
  return Math.min(1, touches / 3)   // 3 touches = full score
}

function volumeScore(relVol: number): number {
  return relVol > 2 ? 1 : relVol / 2  // 2x avg vol = full score
}

function compositeStrength(
  touches: number,
  relVol: number,
  bouncePct: number,
  sourceCount: number
): number {
  const t = touchScore(touches)
  const v = volumeScore(relVol)
  const b = Math.min(1, Math.abs(bouncePct) / 3)   // 3% bounce = full score
  const s = Math.min(1, sourceCount / 3)             // 3 sources = full score
  return Math.round((t * 0.35 + v * 0.25 + b * 0.2 + s * 0.2) * 100)
}

// ─── Algorithm 1: Volume-Weighted Support/Resistance (VWSR) ────────────────

interface VwsrLevel {
  price: number
  volume: number
  touchCount: number
  rejections: number   // times price bounced down from here
  bounces: number       // times price bounced up from here
  lastTouch: string | null
}

/**
 * VWSR: Cluster price levels by volume
 * High volume at a price = institutional interest = support/resistance
 * Uses a grid-based clustering approach: bin prices into buckets,
 * sum volume per bucket, identify clusters
 */
export function detectVwsrLevels(
  candles: OhlcvRow[],
  gridPct: number = 0.5   // 0.5% price grid resolution
): { floors: VwsrLevel[], ceilings: VwsrLevel[] } {
  if (candles.length < 20) return { floors: [], ceilings: [] }

  const minPrice = Math.min(...candles.map(c => c.low))
  const maxPrice = Math.max(...candles.map(c => c.high))
  const range = maxPrice - minPrice
  const bucketSize = range * (gridPct / 100)

  // Build volume-at-price histogram
  const buckets = new Map<number, { vol: number; touches: number; bounces: number; rejections: number; lastTouch: string | null }>()

  for (const candle of candles) {
    const lowBucket = Math.floor(candle.low / bucketSize) * bucketSize
    const highBucket = Math.floor(candle.high / bucketSize) * bucketSize
    const vol = candle.volume

    // Add volume to all buckets the candle spanned
    for (let p = lowBucket; p <= highBucket; p += bucketSize) {
      const b = buckets.get(p) ?? { vol: 0, touches: 0, bounces: 0, rejections: 0, lastTouch: null }
      b.vol += vol
      b.touches += 1
      if (candle.close > candle.open) {
        b.bounces += 1
      } else if (candle.close < candle.open) {
        b.rejections += 1
      }
      b.lastTouch = String(candle.time)
      buckets.set(p, b)
    }
  }

  // Find volume clusters: local maxima in volume histogram
  const sortedPrices = [...buckets.keys()].sort((a, b) => a - b)
  const avgVol = [...buckets.values()].reduce((s, b) => s + b.vol, 0) / buckets.size
  const threshold = avgVol * 2.5   // cluster = 2.5x average volume

  const clusters: VwsrLevel[] = []
  for (let i = 1; i < sortedPrices.length - 1; i++) {
    const price = sortedPrices[i]
    const b = buckets.get(price)!
    const prev = buckets.get(sortedPrices[i - 1])?.vol ?? 0
    const next = buckets.get(sortedPrices[i + 1])?.vol ?? 0

    // Local maximum
    if (b.vol > prev && b.vol > next && b.vol > threshold) {
      clusters.push({
        price,
        volume: b.vol,
        touchCount: b.touches,
        bounces: b.bounces,
        rejections: b.rejections,
        lastTouch: b.lastTouch,
      })
    }
  }

  // Separate into floors (more bounces) and ceilings (more rejections)
  const floors = clusters
    .filter(c => c.bounces > c.rejections)
    .sort((a, b) => b.bounces - a.bounces)

  const ceilings = clusters
    .filter(c => c.rejections > c.bounces)
    .sort((a, b) => b.rejections - a.rejections)

  return { floors, ceilings }
}

// ─── Algorithm 2: Institutional Order Block ────────────────────────────────

interface OrderBlock {
  price: number
  high: number
  low: number
  type: 'bullish' | 'bearish'
  volume: number
  candleCount: number
  startTime: string
  endTime: string
}

/**
 * Institutional Order Block: A sequence of candles with strong directional movement + high volume
 * Bullish OB = large green candle(s) following a downtrend
 * Bearish OB = large red candle(s) following an uptrend
 * These represent zones where institutions accumulated/distributed
 */
export function detectOrderBlocks(
  candles: OhlcvRow[],
  minBodyPct: number = 1.5,   // candle body must be >1.5% of price
  minVolMultiple: number = 2.0  // volume must be >2x average
): OrderBlock[] {
  if (candles.length < 10) return []

  const avgVol = candles.reduce((s, c) => s + c.volume, 0) / candles.length
  const blocks: OrderBlock[] = []

  for (let i = 2; i < candles.length - 2; i++) {
    const prev = candles.slice(i - 2, i)
    const curr = candles[i]
    const next = candles.slice(i + 1, i + 3)

    // Bullish OB: preceding downtrend, large green candle, high volume
    const prevAvgBody = prev.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / prev.length
    const currBody = Math.abs(curr.close - curr.open)
    const currBodyPct = (currBody / curr.open) * 100

    const prevTrendingDown = prev.every((c, j) => j === 0 || c.close <= prev[j - 1].close)
    const bullishPrevConsolidation = prev.every(c => Math.abs(c.close - c.open) / c.open < 0.005)

    if (
      currBodyPct > minBodyPct &&
      curr.close > curr.open &&   // bullish candle
      curr.volume > avgVol * minVolMultiple &&
      prevTrendingDown &&
      bullishPrevConsolidation
    ) {
      const obLow = Math.min(...candles.slice(i, i + 3).map(c => c.low))
      const obHigh = Math.max(...candles.slice(i, i + 3).map(c => c.high))
      blocks.push({
        price: obLow,
        high: obHigh,
        low: obLow,
        type: 'bullish',
        volume: candles.slice(i, i + 3).reduce((s, c) => s + c.volume, 0),
        candleCount: 3,
        startTime: String(curr.time),
        endTime: String(candles[i + 2].time),
      })
    }

    // Bearish OB: preceding uptrend, large red candle, high volume
    const prevTrendingUp = prev.every((c, j) => j === 0 || c.close >= prev[j - 1].close)
    const bearishPrevConsolidation = prev.every(c => Math.abs(c.close - c.open) / c.open < 0.005)

    if (
      currBodyPct > minBodyPct &&
      curr.close < curr.open &&   // bearish candle
      curr.volume > avgVol * minVolMultiple &&
      prevTrendingUp &&
      bearishPrevConsolidation
    ) {
      const obLow = Math.min(...candles.slice(i, i + 3).map(c => c.low))
      const obHigh = Math.max(...candles.slice(i, i + 3).map(c => c.high))
      blocks.push({
        price: obHigh,
        high: obHigh,
        low: obLow,
        type: 'bearish',
        volume: candles.slice(i, i + 3).reduce((s, c) => s + c.volume, 0),
        candleCount: 3,
        startTime: String(curr.time),
        endTime: String(candles[i + 2].time),
      })
    }
  }

  return blocks
}

// ─── Algorithm 3: VWAP Deviation Bands ─────────────────────────────────────

export function calcVwapBands(
  candles: OhlcvRow[],
  multipliers: number[] = [1, 2]
): VwapBand {
  if (candles.length === 0) return { upper: 0, mid: 0, lower: 0, upper2std: 0, lower2std: 0 }

  // Use a rolling VWAP (30-day lookback for efficiency)
  const lookback = candles.slice(-30)
  let cumVp = 0  // cumulative volume * price
  let cumV = 0   // cumulative volume

  for (const c of lookback) {
    const typical = (c.high + c.low + c.close) / 3
    cumVp += typical * c.volume
    cumV += c.volume
  }

  const vwap = cumV > 0 ? cumVp / cumV : lookback[lookback.length - 1].close

  // Standard deviation of deviations from VWAP
  const deviations = lookback.map(c => {
    const typical = (c.high + c.low + c.close) / 3
    return typical - vwap
  })
  const meanDev = deviations.reduce((s, d) => s + d, 0) / deviations.length
  const variance = deviations.reduce((s, d) => s + (d - meanDev) ** 2, 0) / deviations.length
  const stdDev = Math.sqrt(variance)

  return {
    mid: vwap,
    upper: vwap + multipliers[0] * stdDev,
    lower: vwap - multipliers[0] * stdDev,
    upper2std: vwap + multipliers[1] * stdDev,
    lower2std: vwap - multipliers[1] * stdDev,
  }
}

// ─── Algorithm 4: Gamma Wall ───────────────────────────────────────────────

export interface GammaLevelInput {
  callWallStrike: number
  putWallStrike: number
  callWallStrength: number
  putWallStrength: number
  gammaFlipStrike: number
}

/**
 * Map gamma analysis to floor/ceiling levels
 * Call wall above = ceiling
 * Put wall below = floor
 * Gamma flip strike = pivotal level
 */
export function gammaLevels(input: GammaLevelInput, spotPrice: number): {
  ceiling: PriceLevel | null
  floor: PriceLevel | null
} {
  const ceiling: PriceLevel = {
    price: input.callWallStrike,
    type: 'gamma_wall',
    strength: input.callWallStrength,
    sources: ['gamma_wall'],
    evidence: {
      touchCount: 0,
      avgBouncePct: 0,
      totalVolume: 0,
      lastTouch: null,
    },
    distanceFromSpot: pct(input.callWallStrike, spotPrice),
    label: `Call Wall @ ${input.callWallStrike.toFixed(2)}`,
  }

  const floor: PriceLevel = {
    price: input.putWallStrike,
    type: 'gamma_wall',
    strength: input.putWallStrength,
    sources: ['gamma_wall'],
    evidence: {
      touchCount: 0,
      avgBouncePct: 0,
      totalVolume: 0,
      lastTouch: null,
    },
    distanceFromSpot: pct(input.putWallStrike, spotPrice),
    label: `Put Wall @ ${input.putWallStrike.toFixed(2)}`,
  }

  return { ceiling, floor }
}

// ─── Algorithm 5: Kelly ATR Zones ─────────────────────────────────────────

export interface KellyZoneInput {
  regime: 'EXTREME_BULL' | 'EXTENDED_BULL' | 'HEALTHY_BULL' | 'FIRST_DIP' | 'DEEP_DIP' | 'BEAR_ALERT' | 'CRASH_ZONE' | 'FLAT'
  atr: number
  entry: number
  priceVs200EmaPct: number
}

/**
 * Kelly-based floor/ceiling from regime + ATR
 * Each regime has a different risk multiplier for stop/target placement
 */
export function calcKellyAtrZones(input: KellyZoneInput): {
  floor: PriceLevel
  ceiling: PriceLevel
} {
  const regimeMultipliers: Record<KellyZoneInput['regime'], { stop: number; target: number }> = {
    EXTREME_BULL:  { stop: 1.5, target: 4 },   // tight stop in froth
    EXTENDED_BULL: { stop: 2.0, target: 3.5 },
    HEALTHY_BULL:  { stop: 2.5, target: 3 },    // normal bull market
    FIRST_DIP:     { stop: 2.5, target: 3 },    // buy the dip
    DEEP_DIP:      { stop: 3.0, target: 2.5 },  // wider stop, lower target
    BEAR_ALERT:    { stop: 2.0, target: 2 },    // defensive
    CRASH_ZONE:    { stop: 4.0, target: 1.5 },  // crash = small positions
    FLAT:          { stop: 2.0, target: 2.5 },
  }

  const m = regimeMultipliers[input.regime]
  const atr = input.atr

  const floor: PriceLevel = {
    price: input.entry - m.stop * atr,
    type: 'floor',
    strength: Math.round(50 + Math.min(40, Math.abs(input.priceVs200EmaPct))),
    sources: ['kelly_atr'],
    evidence: { touchCount: 0, avgBouncePct: m.stop, totalVolume: 0, lastTouch: null },
    distanceFromSpot: -m.stop * (atr / input.entry) * 100,
    label: `${input.regime.replace('_', ' ')} Floor`,
  }

  const ceiling: PriceLevel = {
    price: input.entry + m.target * atr,
    type: 'ceiling',
    strength: Math.round(50 + Math.min(40, Math.abs(input.priceVs200EmaPct))),
    sources: ['kelly_atr'],
    evidence: { touchCount: 0, avgBouncePct: m.target, totalVolume: 0, lastTouch: null },
    distanceFromSpot: m.target * (atr / input.entry) * 100,
    label: `${input.regime.replace('_', ' ')} Target`,
  }

  return { floor, ceiling }
}

// ─── Algorithm 6: Fibonacci Retracement ────────────────────────────────────

export interface FibLevel {
  label: string
  retracement: number   // e.g. 0.618, 0.786
  type: 'floor' | 'ceiling'
  price?: number
}

/**
 * Identify recent swing high/low and compute Fibonacci retracement levels
 * Primary levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%
 */
export function calcFibonacciLevels(
  candles: OhlcvRow[],
  lookback: number = 60
): FibLevel[] {
  const recent = candles.slice(-lookback)
  if (recent.length < 20) return []

  const swingHigh = Math.max(...recent.map(c => c.high))
  const swingLow = Math.min(...recent.map(c => c.low))
  const range = swingHigh - swingLow

  const currentClose = recent[recent.length - 1].close
  const priceAboveSwing = currentClose > swingHigh
  const getLevelType = (retracement: number): 'floor' | 'ceiling' => {
    if (!priceAboveSwing) return 'floor'
    const levelPrice = swingHigh - range * retracement
    return levelPrice > currentClose ? 'ceiling' : 'floor'
  }

  const levels: FibLevel[] = [
    { label: '23.6%', retracement: 0.236, type: getLevelType(0.236) },
    { label: '38.2%', retracement: 0.382, type: getLevelType(0.382) },
    { label: '50.0%', retracement: 0.5, type: getLevelType(0.5) },
    { label: '61.8%', retracement: 0.618, type: getLevelType(0.618) },
    { label: '78.6%', retracement: 0.786, type: getLevelType(0.786) },
  ]

  return levels.map(l => ({
    ...l,
    // price = swingHigh - (range * retracement) for floors
    price: l.type === 'floor'
      ? swingHigh - range * l.retracement
      : swingLow + range * l.retracement,
  }))
}

// ─── Pivot Points ──────────────────────────────────────────────────────────

export function calcClassicPivots(
  candles: OhlcvRow[],
  lookback: number = 1
): { floor: PriceLevel; ceiling: PriceLevel } {
  const recent = candles.slice(-(lookback + 1))
  if (recent.length < 2) {
    const last = candles[candles.length - 1]
    return {
      floor: { price: last.close * 0.99, type: 'pivot', strength: 30, sources: ['pivot'], evidence: { touchCount: 0, avgBouncePct: 1, totalVolume: 0, lastTouch: null }, distanceFromSpot: -1 },
      ceiling: { price: last.close * 1.01, type: 'pivot', strength: 30, sources: ['pivot'], evidence: { touchCount: 0, avgBouncePct: 1, totalVolume: 0, lastTouch: null }, distanceFromSpot: 1 },
    }
  }

  const prev = recent[recent.length - 1]
  const pivot = (prev.high + prev.low + prev.close) / 3
  const r1 = 2 * pivot - prev.low
  const s1 = 2 * pivot - prev.high
  const r2 = pivot + (prev.high - prev.low)
  const s2 = pivot - (prev.high - prev.low)

  return {
    floor: {
      price: s1,
      type: 'pivot',
      strength: 55,
      sources: ['classic_pivot'],
      evidence: { touchCount: 1, avgBouncePct: Math.abs(pct(s1, pivot)), totalVolume: 1, lastTouch: String(prev.time) },
      distanceFromSpot: pct(s1, prev.close),
      label: `S1 Pivot`,
    },
    ceiling: {
      price: r1,
      type: 'pivot',
      strength: 55,
      sources: ['classic_pivot'],
      evidence: { touchCount: 1, avgBouncePct: Math.abs(pct(r1, pivot)), totalVolume: 1, lastTouch: String(prev.time) },
      distanceFromSpot: pct(r1, prev.close),
      label: `R1 Pivot`,
    },
  }
}

// ─── Touch counting ────────────────────────────────────────────────────────

function countTouches(
  level: number,
  candles: OhlcvRow[],
  tolerancePct: number = 1.0
): { touches: number; rejections: number; bounces: number; lastTouch: string | null } {
  const tolerance = level * (tolerancePct / 100)
  let touches = 0
  let rejections = 0
  let bounces = 0
  let lastTouch: string | null = null

  for (const c of candles) {
    const distFromLevel = Math.abs(c.close - level)

    if (distFromLevel <= tolerance) {
      touches++
      lastTouch = String(c.time)

      // Was this a rejection from above (ceiling) or below (floor)?
      const wickToLevel = Math.abs(c.high - level) < tolerance || Math.abs(c.low - level) < tolerance
      if (wickToLevel) {
        if (c.close < level) rejections++
        else bounces++
      }
    }
  }

  return { touches, rejections, bounces, lastTouch }
}

// ─── Master Floor/Ceiling Detection ─────────────────────────────────────────

export function detectFloorCeiling(
  ticker: string,
  currentPrice: number,
  quoteTime: string,
  candles: OhlcvRow[],
  gammaInput?: GammaLevelInput,
  kellyInput?: KellyZoneInput,
  lookbackCandles: number = 120
): FloorCeilingResult {
  const recent = candles.slice(-lookbackCandles)
  const hasData = recent.length >= 20

  // ── Algorithm 1: VWSR ──────────────────────────────────────────────────
  const { floors: vwsrFloors, ceilings: vwsrCeilings } = hasData
    ? detectVwsrLevels(recent)
    : { floors: [], ceilings: [] }

  // ── Algorithm 2: Order Blocks ──────────────────────────────────────────
  const orderBlocks = hasData ? detectOrderBlocks(recent) : []

  // ── Algorithm 3: VWAP Bands ────────────────────────────────────────────
  const vwapBands = hasData ? calcVwapBands(recent) : { upper: currentPrice, mid: currentPrice, lower: currentPrice, upper2std: currentPrice, lower2std: currentPrice }

  // ── Algorithm 4: Gamma Walls ──────────────────────────────────────────
  const { ceiling: gammaCeiling, floor: gammaFloor } = gammaInput
    ? gammaLevels(gammaInput, currentPrice)
    : { ceiling: null, floor: null }

  // ── Algorithm 5: Kelly ATR Zones ────────────────────────────────────────
  const { floor: kellyFloor, ceiling: kellyCeiling } = kellyInput
    ? calcKellyAtrZones(kellyInput)
    : { floor: null, ceiling: null }

  // ── Algorithm 6: Fibonacci ─────────────────────────────────────────────
  const fibLevels = hasData ? calcFibonacciLevels(recent) : []

  // ── Algorithm 7: Classic Pivots ────────────────────────────────────────
  const pivotLevels = hasData ? calcClassicPivots(recent) : { floor: null, ceiling: null }

  // ── Merge and rank all levels ──────────────────────────────────────────
  const allLevels: PriceLevel[] = []

  // VWSR floors/ceilings
  for (const f of vwsrFloors.slice(0, 3)) {
    const touches = countTouches(f.price, recent)
    const strength = compositeStrength(touches.touches, f.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length), touches.bounces / Math.max(1, touches.touches), 1)
    allLevels.push({
      price: f.price,
      type: 'floor',
      strength,
      sources: ['vwsr'],
      evidence: { touchCount: touches.touches, avgBouncePct: touches.bounces / Math.max(1, touches.touches) * 2, totalVolume: f.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length), lastTouch: touches.lastTouch },
      distanceFromSpot: pct(f.price, currentPrice),
    })
  }
  for (const c of vwsrCeilings.slice(0, 3)) {
    const touches = countTouches(c.price, recent)
    const strength = compositeStrength(touches.touches, c.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length), touches.rejections / Math.max(1, touches.touches), 1)
    allLevels.push({
      price: c.price,
      type: 'ceiling',
      strength,
      sources: ['vwsr'],
      evidence: { touchCount: touches.touches, avgBouncePct: touches.rejections / Math.max(1, touches.touches) * 2, totalVolume: c.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length), lastTouch: touches.lastTouch },
      distanceFromSpot: pct(c.price, currentPrice),
    })
  }

  // Order blocks
  for (const ob of orderBlocks.slice(0, 3)) {
    const touches = countTouches(ob.price, recent)
    const strength = compositeStrength(
      touches.touches,
      ob.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length),
      ob.type === 'bullish' ? touches.bounces / Math.max(1, touches.touches) : touches.rejections / Math.max(1, touches.touches),
      1
    )
    allLevels.push({
      price: ob.price,
      type: 'order_block',
      strength,
      sources: ['order_block'],
      evidence: { touchCount: touches.touches, avgBouncePct: ob.type === 'bullish' ? 2 : -2, totalVolume: ob.volume / (recent.reduce((s, c) => s + c.volume, 0) / recent.length), lastTouch: touches.lastTouch },
      distanceFromSpot: pct(ob.price, currentPrice),
    })
  }

  // VWAP bands as levels
  if (hasData) {
    allLevels.push({
      price: vwapBands.upper,
      type: 'vwap_zone',
      strength: 60,
      sources: ['vwap_bands'],
      evidence: { touchCount: 0, avgBouncePct: 0, totalVolume: 0, lastTouch: null },
      distanceFromSpot: pct(vwapBands.upper, currentPrice),
      label: 'VWAP +1σ',
    })
    allLevels.push({
      price: vwapBands.lower,
      type: 'vwap_zone',
      strength: 60,
      sources: ['vwap_bands'],
      evidence: { touchCount: 0, avgBouncePct: 0, totalVolume: 0, lastTouch: null },
      distanceFromSpot: pct(vwapBands.lower, currentPrice),
      label: 'VWAP -1σ',
    })
  }

  // Gamma levels
  if (gammaFloor) allLevels.push(gammaFloor)
  if (gammaCeiling) allLevels.push(gammaCeiling)

  // Kelly ATR zones
  if (kellyFloor) allLevels.push(kellyFloor)
  if (kellyCeiling) allLevels.push(kellyCeiling)

  // Fibonacci
  for (const fib of fibLevels) {
    if (fib.price == null) continue
    const touches = countTouches(fib.price, recent)
    allLevels.push({
      price: fib.price,
      type: 'fibonacci',
      strength: compositeStrength(touches.touches, 1, 0, 1),
      sources: ['fibonacci'],
      evidence: { touchCount: touches.touches, avgBouncePct: 0, totalVolume: 1, lastTouch: touches.lastTouch },
      distanceFromSpot: pct(fib.price, currentPrice),
      label: fib.label,
    })
  }

  // Pivots
  if (pivotLevels.floor) allLevels.push(pivotLevels.floor)
  if (pivotLevels.ceiling) allLevels.push(pivotLevels.ceiling)

  // ── Find strongest floor (below spot) and ceiling (above spot) ─────────
  const belowSpot = allLevels
    .filter(l => l.price < currentPrice)
    .sort((a, b) => {
      // Prefer levels closer to spot with higher strength
      const aScore = a.strength * (1 / (1 + Math.abs(a.distanceFromSpot)))
      const bScore = b.strength * (1 / (1 + Math.abs(b.distanceFromSpot)))
      return bScore - aScore
    })

  const aboveSpot = allLevels
    .filter(l => l.price > currentPrice)
    .sort((a, b) => {
      const aScore = a.strength * (1 / (1 + Math.abs(a.distanceFromSpot)))
      const bScore = b.strength * (1 / (1 + Math.abs(b.distanceFromSpot)))
      return bScore - aScore
    })

  const bestFloor = belowSpot[0] ?? null
  const bestCeiling = aboveSpot[0] ?? null

  // ── Algorithm scores ───────────────────────────────────────────────────
  const algorithmScores = {
    vwsrFloorScore: bestFloor?.sources.includes('vwsr') ? bestFloor.strength : 0,
    vwsrCeilingScore: bestCeiling?.sources.includes('vwap_zone') ? bestCeiling.strength : 0,
    orderBlockFloorScore: bestFloor?.sources.includes('order_block') ? bestFloor.strength : 0,
    orderBlockCeilingScore: bestCeiling?.sources.includes('order_block') ? bestCeiling.strength : 0,
    gammaFloorScore: bestFloor?.sources.includes('gamma_wall') ? bestFloor.strength : 0,
    gammaCeilingScore: bestCeiling?.sources.includes('gamma_wall') ? bestCeiling.strength : 0,
    fibFloorScore: bestFloor?.sources.includes('fibonacci') ? bestFloor.strength : 0,
    fibCeilingScore: bestCeiling?.sources.includes('fibonacci') ? bestCeiling.strength : 0,
  }

  // ── Bias ────────────────────────────────────────────────────────────────
  let bias: FloorCeilingResult['bias'] = 'neutral'
  let biasConfidence = 50

  if (bestFloor && bestCeiling) {
    const floorConf = bestFloor.strength
    const ceilingConf = bestCeiling.strength
    const distanceScore = 1 / (1 + Math.abs(bestFloor.distanceFromSpot) + Math.abs(bestCeiling.distanceFromSpot))

    if (floorConf > ceilingConf + 15 && bestFloor.distanceFromSpot < 5) {
      bias = 'bullish'
      biasConfidence = Math.min(90, floorConf + Math.round(distanceScore * 20))
    } else if (ceilingConf > floorConf + 15 && bestCeiling.distanceFromSpot < 5) {
      bias = 'bearish'
      biasConfidence = Math.min(90, ceilingConf + Math.round(distanceScore * 20))
    }
  }

  // ── Nearby levels (within 5%) ───────────────────────────────────────────
  const nearbyLevels = allLevels
    .filter(l => Math.abs(l.distanceFromSpot) <= 5)
    .sort((a, b) => b.strength - a.strength)

  // ── Verification ───────────────────────────────────────────────────────
  const dataVerification = createVerification(
    hasData ? 'yahoo' : 'illustrative',
    hasData
      ? `Floor/ceiling analysis from ${recent.length} candles (${lookbackCandles}-bar lookback). Algorithms: VWSR, Order Block, VWAP Bands, Gamma Wall, Kelly ATR, Fibonacci, Classic Pivot.`
      : 'Insufficient price history for floor/ceiling detection. Requires at least 20 candles.',
    {
      confidence: hasData ? 0.78 : 0.3,
      rawFields: ['high', 'low', 'close', 'open', 'volume'],
    }
  )

  return {
    ticker,
    currentPrice,
    quoteTime,
    floor: bestFloor,
    ceiling: bestCeiling,
    vwapZone: vwapBands,
    nearbyLevels,
    bias,
    biasConfidence,
    algorithmScores,
    dataVerification,
  }
}
