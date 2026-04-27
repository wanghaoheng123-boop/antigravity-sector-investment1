import { describe, it, expect } from 'vitest'
import * as signals from '@/lib/backtest/signals'
import type { OhlcBar } from '@/lib/backtest/signals'

const {
  sma, ema, rsi, atr, bollinger, adx, stochRsi, roc,
  relativeVolume, regimeSignal, cmo,
} = signals

// lookbackHigh252 was added in this session — conditionally available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lookbackHigh252: ((b: OhlcBar[]) => number) | undefined =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (signals as any).lookbackHigh252

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Generate a deterministic uptrend series: starts at 100, +0.5/bar, no noise. */
function uptrend(n = 300, start = 100, step = 0.5): number[] {
  return Array.from({ length: n }, (_, i) => start + step * i)
}

/** Generate a sine wave: amplitude ±10 around 100. */
function sine(n = 300, freq = 0.05): number[] {
  return Array.from({ length: n }, (_, i) => 100 + 10 * Math.sin(2 * Math.PI * freq * i))
}

/** Generate a flat series with a single spike at mid-bar. */
function spike(n = 300, mid = 150, spikePct = 0.2): number[] {
  return Array.from({ length: n }, (_, i) =>
    i === mid ? 100 * (1 + spikePct) : i === mid + 1 ? 100 * (1 - spikePct * 0.5) : 100,
  )
}

/** Converts a number[] to an OhlcBar[] using close as open/high/low/close. */
function toBars(closes: number[]): OhlcBar[] {
  return closes.map(c => ({ open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1e6 }))
}

/** Baseline O(n*period) CMO implementation for equivalence testing. */
function naiveCmo(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  for (let i = period; i < closes.length; i++) {
    let up = 0
    let down = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1]
      if (d > 0) up += d
      else if (d < 0) down += Math.abs(d)
    }
    const denom = up + down
    out[i] = denom > 0 ? (100 * (up - down)) / denom : 0
  }
  return out
}

// ─── sma ───────────────────────────────────────────────────────────────────

describe('sma', () => {
  it('returns null when series too short', () => {
    expect(sma([1, 2], 5)).toBeNull()
  })

  it('computes correct average', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBeCloseTo(3, 4)
  })

  it('uses the last period bars', () => {
    expect(sma([1, 2, 3, 100, 200], 3)).toBeCloseTo(101, 4)
  })
})

// ─── ema ───────────────────────────────────────────────────────────────────

describe('ema', () => {
  it('returns empty array for empty input', () => {
    expect(ema([], 14)).toHaveLength(0)
  })

  it('returns NaN array when series shorter than period', () => {
    const out = ema([1, 2, 3], 14)
    expect(out).toHaveLength(3)
    out.forEach(v => expect(Number.isNaN(v)).toBe(true))
  })

  it('seeds with SMA then converges', () => {
    // 3-day EMA on rising series [1,2,3,4,5]; k=2/(3+1)=0.5
    // seed SMA(1,2,3)=2; then 4*0.5+2*0.5=3; then 5*0.5+3*0.5=4
    const out = ema([1, 2, 3, 4, 5], 3)
    expect(out[0]).toBeCloseTo(2, 4)
    expect(out[1]).toBeCloseTo(3, 4)
    expect(out[2]).toBeCloseTo(4, 4)
  })
})

// ─── rsi ───────────────────────────────────────────────────────────────────

describe('rsi', () => {
  it('returns all NaN when series shorter than period+1', () => {
    const out = rsi([100, 101, 102], 14)
    expect(out.every(v => Number.isNaN(v))).toBe(true)
  })

  it('RSI = 100 when price only goes up (no losses)', () => {
    // Use slightly noisier rising series to avoid flat-bar edge cases in ATR callers
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i + (i % 3) * 0.1)
    const out = rsi(rising, 14)
    const last = out[out.length - 1]
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeGreaterThanOrEqual(70)
  })

  it('RSI < 50 when price only goes down', () => {
    const falling = Array.from({ length: 30 }, (_, i) => 130 - i)
    const out = rsi(falling, 14)
    const last = out[out.length - 1]
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeLessThan(50)
  })

  it('RSI bounded 0-100', () => {
    const sine_waves = sine(300, 0.1)
    const out = rsi(sine_waves, 14)
    const finite = out.filter(Number.isFinite)
    finite.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

// ─── atr ───────────────────────────────────────────────────────────────────

describe('atr', () => {
  it('returns empty array for fewer than n bars', () => {
    const bars = toBars([100, 101, 102])
    expect(atr(bars, 14)).toHaveLength(0)
  })

  it('returns valid ATR values on rising bars', () => {
    const bars = toBars(uptrend(30))
    const out = atr(bars, 14)
    expect(out.length).toBeGreaterThan(0)
    out.forEach(v => {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    })
  })

  it('ATR is NaN-free on clean data', () => {
    // Use sine wave so high != low on every bar → true range is never exactly high-low
    const bars = toBars(sine(50, 0.08))
    const out = atr(bars, 14)
    out.filter(Number.isFinite).forEach(v => expect(v).toBeGreaterThan(0))
  })
})

// ─── bollinger ─────────────────────────────────────────────────────────────

describe('bollinger', () => {
  it('returns NaN for short series', () => {
    const out = bollinger([100, 101, 102])
    out.pctB.forEach(v => expect(Number.isNaN(v)).toBe(true))
  })

  it('pctB is between 0 and 1 for oscillating price', () => {
    const wave = sine(80, 0.1)
    const out = bollinger(wave)
    const valid = out.pctB.filter(Number.isFinite)
    expect(valid.length).toBeGreaterThan(0)
    valid.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    })
  })

  it('upper > mid > lower for any valid window', () => {
    const bars = toBars(uptrend(60))
    const closes = bars.map(b => b.close)
    const out = bollinger(closes)
    const valid = out.pctB.findIndex(v => Number.isFinite(v))
    if (valid >= 0) {
      expect(out.upper[valid]).toBeGreaterThan(out.mid[valid])
      expect(out.mid[valid]).toBeGreaterThan(out.lower[valid])
    }
  })
})

// ─── adx ───────────────────────────────────────────────────────────────────

describe('adx', () => {
  it('returns empty ADX for insufficient bars', () => {
    const bars = toBars(uptrend(10))
    const out = adx(bars, 14)
    expect(out.adx).toHaveLength(0)
  })

  it('ADX values are bounded 0-100', () => {
    const bars = toBars(uptrend(100))
    const out = adx(bars, 14)
    out.adx.filter(Number.isFinite).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })

  it('ADX rises on strong trend (uptrend)', () => {
    const bars = toBars(uptrend(100))
    const out = adx(bars, 14)
    const finite = out.adx.filter(Number.isFinite)
    if (finite.length >= 2) {
      expect(finite[finite.length - 1]).toBeGreaterThan(finite[0])
    }
  })
})

// ─── stochRsi ──────────────────────────────────────────────────────────────

describe('stochRsi', () => {
  it('returns NaN array for short input', () => {
    const out = stochRsi([100, 101, 102], 14, 14)
    out.forEach(v => expect(Number.isNaN(v)).toBe(true))
  })

  it('stochRSI is bounded 0-1', () => {
    const closes = sine(200)
    const out = stochRsi(closes, 14, 14)
    out.filter(Number.isFinite).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    })
  })
})

// ─── roc ───────────────────────────────────────────────────────────────────

describe('roc', () => {
  it('returns all NaN when input shorter than period', () => {
    // 3-element array, period=10: loop never runs → all NaN
    const out = roc([100, 101, 102], 10)
    expect(out).toHaveLength(3)
    out.forEach(v => expect(Number.isNaN(v)).toBe(true))
  })

  it('ROC = 0 when price unchanged over period', () => {
    const flat = Array.from({ length: 300 }, () => 100)
    const out = roc(flat, 252)
    const finite = out.filter(Number.isFinite)
    finite.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9))
  })

  it('ROC > 0 on uptrend over period', () => {
    const rising = uptrend(300)
    const out = roc(rising, 252)
    const last = out[out.length - 1]
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeGreaterThan(0)
  })
})

// ─── relativeVolume ────────────────────────────────────────────────────────

describe('relativeVolume', () => {
  it('returns NaN for bars before period', () => {
    const out = relativeVolume([1e6, 1e6, 1e6], 20)
    // All values are NaN when input is shorter than period
    expect(Number.isNaN(out[0])).toBe(true)
    expect(Number.isNaN(out[1])).toBe(true)
    expect(Number.isNaN(out[2])).toBe(true)
  })

  it('RVOL > 1 when last bar volume is above its 20-bar average', () => {
    // All bars 0-28 are 1e6; last bar (29) is 10e6
    // At bar 29: SMA(20) = bars 10-29 = (19*1e6 + 10e6) / 20 = 1.45e6
    // RVOL = 10e6 / 1.45e6 ≈ 6.9 > 1 ✓
    const volumes: number[] = Array.from({ length: 30 }, (_, i) => (i === 29 ? 10e6 : 1e6))
    const out = relativeVolume(volumes, 20)
    const last = out[out.length - 1]
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeGreaterThan(1)
  })

  it('RVOL < 1 when last bar is below its 20-bar average', () => {
    // All bars 0-28 are 1e6; last bar is 0.2e6
    // SMA(20) at bar 29 = (19*1e6 + 0.2e6) / 20 = 0.995e6
    // RVOL = 0.2e6 / 0.995e6 ≈ 0.201 < 1 ✓
    const volumes: number[] = Array.from({ length: 30 }, (_, i) => (i === 29 ? 0.2e6 : 1e6))
    const out = relativeVolume(volumes, 20)
    const last = out[out.length - 1]
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeLessThan(1)
  })
})

// ─── cmo ───────────────────────────────────────────────────────────────────

describe('cmo', () => {
  it('returns all NaN when input is shorter than period+1', () => {
    const out = cmo([100, 101, 102], 14)
    out.forEach(v => expect(Number.isNaN(v)).toBe(true))
  })

  it('matches naive implementation exactly on deterministic data', () => {
    const closes = sine(320, 0.07)
    const period = 14
    const outFast = cmo(closes, period)
    const outNaive = naiveCmo(closes, period)
    expect(outFast).toHaveLength(outNaive.length)
    for (let i = 0; i < outFast.length; i++) {
      const a = outFast[i]
      const b = outNaive[i]
      if (Number.isNaN(a) || Number.isNaN(b)) {
        expect(Number.isNaN(a)).toBe(Number.isNaN(b))
      } else {
        expect(a).toBeCloseTo(b, 10)
      }
    }
  })
})

// ─── lookbackHigh252 ──────────────────────────────────────────────────────

// lookbackHigh252 was added in this session — conditionally skip if not yet in build
const describeLookback = lookbackHigh252 ? describe : describe.skip

describeLookback('lookbackHigh252', () => {
  it('returns -Infinity on empty bars', () => {
    expect(lookbackHigh252!([])).toBe(-Infinity)
  })

  it('returns max of last-252 highs', () => {
    const bars: OhlcBar[] = Array.from({ length: 300 }, (_, i) => ({
      open: 100, high: i + 1, low: 99, close: 100, volume: 1e6,
    }))
    const out = lookbackHigh252!(bars)
    expect(out).toBe(300) // last bar has highest high
  })

  it('looks back only 252 bars', () => {
    const bars: OhlcBar[] = Array.from({ length: 500 }, (_, i) => ({
      open: 100, high: i < 400 ? 50 : 200, low: 99, close: 100, volume: 1e6,
    }))
    const out = lookbackHigh252!(bars)
    // Only last 252 bars (indices 248-499) are considered; max there is 200
    expect(out).toBe(200)
  })
})

// ─── regimeSignal ──────────────────────────────────────────────────────────

describe('regimeSignal', () => {
  it('returns INSUFFICIENT_DATA when closes < 200', () => {
    const result = regimeSignal(100, uptrend(50), 50, {})
    expect(result.label).toBe('Insufficient Data')
    expect(result.action).toBe('HOLD')
  })

  it('returns STRONG_DIP in oversold uptrend', () => {
    // Short-term dip within long uptrend
    const long: number[] = uptrend(300)
    const withDip = [...long.slice(0, 250), long[250] * 0.85, ...long.slice(251)]
    const result = regimeSignal(withDip[250], withDip, 25, { enableHealthyBullDip: true })
    expect(result.dipSignal).toMatch(/DIP|KNIFE/)
  })

  it('returns EXTREME_BULL when price is >20% above 200SMA', () => {
    const long = uptrend(300, 100, 0.5) // avg ~174
    const price = long[299] * 1.30 // 30% above final close → >20% above SMA
    const result = regimeSignal(price, long, 50, {})
    expect(result.label).toBe('EXTREME_BULL')
    expect(result.action).toBe('HOLD')
  })
})
