/**
 * Pure-logic checks (no Next.js) — mirrors lib/yahooQuoteFields.ts and session direction rules.
 * Run: node scripts/verify-core-logic.mjs
 */

function normalizedChangePercent(regularMarketChangePercent, regularMarketChange, regularMarketPrice) {
  const raw = regularMarketChangePercent
  if (regularMarketPrice != null && regularMarketPrice > 0 && regularMarketChange != null) {
    const implied = (100 * regularMarketChange) / regularMarketPrice
    if (raw == null || !Number.isFinite(Number(raw))) return implied
    const r = Number(raw)
    if (Math.abs(r) < 0.5 && Math.abs(implied) > 1.5) return implied
    if (Math.abs(r) >= 0.5 || Math.abs(implied) < 0.01) return r
    return Math.abs(r) < 1 && Math.abs(implied) > 5 ? implied : r
  }
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw)
  return 0
}

function sessionDirection(changePct) {
  if (changePct > 0.01) return 'BUY'
  if (changePct < -0.01) return 'SELL'
  return 'HOLD'
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
}

function approx(a, b, eps = 1e-6, msg) {
  assert(Math.abs(a - b) < eps, msg || `${a} ≈ ${b}`)
}

console.log('normalizedChangePercent')
// Yahoo-style percent already
approx(normalizedChangePercent(-1.5, -2.5, 100), -1.5, 1e-9, 'keep percent when |raw|≥0.5')
// Decimal form 0.016 → implied ~1.6% when price/change disagree with tiny raw
const implied16 = (100 * 1.6) / 100
approx(normalizedChangePercent(0.016, 1.6, 100), implied16, 1e-9, 'decimal raw → implied when implied large')
// Missing change: fall back to raw
approx(normalizedChangePercent(2.3, null, 100), 2.3, 1e-9, 'null change uses raw percent')
// Full implied when raw null
approx(normalizedChangePercent(null, 3, 150), 2, 1e-9, 'null raw uses 100*chg/px')
assert(normalizedChangePercent(null, null, null) === 0, 'all null → 0')

console.log('\nsessionDirection')
assert(sessionDirection(0.5) === 'BUY', '>0.01 → BUY (UP token)')
assert(sessionDirection(-0.5) === 'SELL', '<-0.01 → SELL (DOWN token)')
assert(sessionDirection(0) === 'HOLD', '0 → HOLD')
assert(sessionDirection(0.005) === 'HOLD', 'tiny move → HOLD')

console.log('\nAll verify-core-logic checks passed.')
