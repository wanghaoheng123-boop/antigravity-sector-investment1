/**
 * Phase 11 D — sector-specific gate helpers.
 *
 * Each gate returns `true` when the signal is allowed to proceed and `false`
 * when the macro context says "stand down." All gates fail CLOSED (return
 * false) when input data is insufficient or stale, so passing partial data
 * never accidentally enables a BUY.
 *
 * Academic basis (DeepSeek v4 Pro research, Phase 11 D):
 *   - TLT rising:    Bekaert, Hoerova & Lo Duca (2013) — rate-sensitive
 *                    sectors lose excess returns when rates rise.
 *   - Parkinson:     Parkinson (1980) — range-based volatility ~5x more
 *                    efficient than close-to-close at same sampling rate.
 *   - DXY:           Pukthuangthong & Roll (2011) — gold ↔ USD persistent
 *                    -0.3 to -0.5 correlation.
 *   - Yield curve:   Estrella & Mishkin (1998) — 10y-3m inversion compresses
 *                    bank NIM and predicts recessions.
 *
 * Design notes:
 *   - Pure functions, no I/O. Data is passed in by the caller (signals.ts,
 *     benchmarks). This keeps the indicator library testable without network.
 *   - Parameters mirror DeepSeek's recommended defaults; tuning happens at
 *     the SectorProfile / SectorGateConfig layer, not here.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

function smaTail(values: number[], window: number): number {
  if (!Number.isFinite(window) || window <= 0) return NaN
  if (values.length < window) return NaN
  let sum = 0
  for (let i = values.length - window; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) return NaN
    sum += v
  }
  return sum / window
}

function smaAt(values: number[], idx: number, window: number): number {
  if (idx < window - 1) return NaN
  let sum = 0
  for (let i = idx - window + 1; i <= idx; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) return NaN
    sum += v
  }
  return sum / window
}

// ── 1. TLT-rising gate (REITs / Utilities) ───────────────────────────────────

export interface TltRisingOptions {
  /** SMA period used for the fast leg. Default 20 trading days. */
  fastWindow?: number
  /** SMA period used for the slow leg. Default 50 trading days. */
  slowWindow?: number
  /** Number of bars the fast leg must be rising over. Default 5. */
  confirmationBars?: number
}

/**
 * True when 20-day TLT SMA > 50-day SMA AND fast SMA is rising over the
 * last `confirmationBars` bars. Use as a BUY gate for rate-sensitive sectors
 * (Real Estate, Utilities). Fails CLOSED when TLT data is too short, missing,
 * or contains non-finite values.
 */
export function isTltRising(tltCloses: number[], opts: TltRisingOptions = {}): boolean {
  const fast = opts.fastWindow ?? 20
  const slow = opts.slowWindow ?? 50
  const confirm = opts.confirmationBars ?? 5
  if (!Array.isArray(tltCloses) || tltCloses.length < slow + confirm) return false

  const fastNow = smaTail(tltCloses, fast)
  const slowNow = smaTail(tltCloses, slow)
  if (!Number.isFinite(fastNow) || !Number.isFinite(slowNow)) return false
  if (!(fastNow > slowNow)) return false

  const past = smaAt(tltCloses, tltCloses.length - 1 - confirm, fast)
  if (!Number.isFinite(past)) return false
  return fastNow > past
}

// ── 2. Parkinson volatility-spike filter (Materials / commodities) ───────────

export interface ParkinsonOptions {
  /** Window size for current vol estimate. Default 20. */
  spikeWindow?: number
  /** Window size for baseline vol estimate. Default 60. */
  baselineWindow?: number
  /** Spike threshold: reject BUY when current > multiplier * baseline. Default 1.5. */
  multiplier?: number
}

/**
 * Parkinson range-based volatility estimator: σ² = (1 / 4 ln 2) · mean(ln(H/L)²)
 * over the last `window` bars. Returns the daily-scale vol; multiply by
 * sqrt(252) for annualized.
 */
export function parkinsonVol(highs: number[], lows: number[], window: number): number {
  if (!Array.isArray(highs) || !Array.isArray(lows)) return NaN
  if (highs.length !== lows.length) return NaN
  if (highs.length < window || window <= 0) return NaN
  const c = 1 / (4 * Math.log(2))
  let sumSq = 0
  let counted = 0
  for (let i = highs.length - window; i < highs.length; i++) {
    const h = highs[i]
    const l = lows[i]
    if (!Number.isFinite(h) || !Number.isFinite(l) || h <= 0 || l <= 0 || h < l) return NaN
    if (h === l) {
      // halted bar — zero range. Skip rather than crash log(1)=0; keep counter.
      counted++
      continue
    }
    const r = Math.log(h / l)
    sumSq += r * r
    counted++
  }
  if (counted < window) return NaN
  return Math.sqrt(c * (sumSq / window))
}

/**
 * True when current Parkinson vol does NOT exceed the baseline by `multiplier`.
 * Use as a BUY gate for commodity-linked sectors. Fails CLOSED when data is
 * insufficient or contains bad ticks (h<l, NaN, h<=0).
 */
export function isParkinsonOk(highs: number[], lows: number[], opts: ParkinsonOptions = {}): boolean {
  const spike = opts.spikeWindow ?? 20
  const baseline = opts.baselineWindow ?? 60
  const mult = opts.multiplier ?? 1.5
  if (!Array.isArray(highs) || highs.length < baseline) return false
  const cur = parkinsonVol(highs, lows, spike)
  const base = parkinsonVol(highs, lows, baseline)
  if (!Number.isFinite(cur) || !Number.isFinite(base) || base <= 0) return false
  return cur < base * mult
}

// ── 3. DXY-rising suppressor (gold names) ────────────────────────────────────

export interface DxyOptions {
  /** SMA window. Default 20. */
  smaWindow?: number
  /** Bars over which the SMA must be rising. Default 5. */
  slopeBars?: number
}

/**
 * True when the dollar index is NOT in a rising regime — i.e. when 20-day SMA
 * is flat or falling. Use as a BUY gate for gold miners / silver miners where
 * the asset is structurally inverse to USD. Fails CLOSED when DXY data is
 * stale or insufficient. Pass UUP closes as a Yahoo-friendly DXY proxy.
 */
export function isDxyOk(dxyCloses: number[], opts: DxyOptions = {}): boolean {
  const w = opts.smaWindow ?? 20
  const slope = opts.slopeBars ?? 5
  if (!Array.isArray(dxyCloses) || dxyCloses.length < w + slope) return false
  const now = smaTail(dxyCloses, w)
  const past = smaAt(dxyCloses, dxyCloses.length - 1 - slope, w)
  if (!Number.isFinite(now) || !Number.isFinite(past)) return false
  return now <= past
}

// ── 4. Yield-curve gate (Financials / banks) ─────────────────────────────────

export interface YieldCurveOptions {
  /** Spread (10y - 3m) above this is treated as healthy. Default 0. */
  spreadBuffer?: number
}

/**
 * True when the 10y-3m spread is above the buffer — banks tend to expand NIM
 * in a steepening curve. Pass `tnxYield` and `irxYield` as percentage points
 * (e.g. 4.50, 4.10). Fails CLOSED on missing or non-finite inputs.
 */
export function isYieldCurveOk(
  tnxYield: number | null | undefined,
  irxYield: number | null | undefined,
  opts: YieldCurveOptions = {},
): boolean {
  const buf = opts.spreadBuffer ?? 0
  if (tnxYield == null || irxYield == null) return false
  if (!Number.isFinite(tnxYield) || !Number.isFinite(irxYield)) return false
  return tnxYield - irxYield > buf
}
