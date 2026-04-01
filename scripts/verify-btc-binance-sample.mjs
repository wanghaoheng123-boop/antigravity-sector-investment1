/**
 * Data verification: Binance public klines invariants + optional parity with app route.
 * Run: node scripts/verify-btc-binance-sample.mjs
 * Optional: VERIFY_APP_BASE_URL=http://127.0.0.1:3000  (Next must be running)
 */
const BINANCE = 'https://api.binance.com'

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
}

function mapKline(k) {
  return {
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }
}

function validateCandles(candles, label) {
  assert(candles.length >= 2, `${label}: at least 2 candles`)
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    assert(
      [c.open, c.high, c.low, c.close, c.volume].every((v) => Number.isFinite(v) && v >= 0),
      `${label}[${i}] OHLCV finite & non-negative`
    )
    assert(c.high >= c.low, `${label}[${i}] high >= low`)
    assert(c.high >= Math.max(c.open, c.close), `${label}[${i}] high bounds`)
    assert(c.low <= Math.min(c.open, c.close), `${label}[${i}] low bounds`)
    if (i > 0) assert(c.time > candles[i - 1].time, `${label}: strictly increasing time`)
  }
}

async function main() {
  console.log('Binance direct klines (BTCUSDT 1d, limit=10)\n')
  const url = `${BINANCE}/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=10`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'QUANTAN-verify/1.0' },
    signal: AbortSignal.timeout(20_000),
  })
  assert(res.ok, `Binance HTTP ${res.status}`)
  const raw = await res.json()
  assert(Array.isArray(raw) && raw.length >= 2, 'JSON array of klines')
  const candles = raw.filter((k) => k && k.length >= 6).map(mapKline)
  validateCandles(candles, 'direct')

  const base = process.env.VERIFY_APP_BASE_URL?.replace(/\/$/, '')
  if (base) {
    console.log(`\nApp route parity → ${base}/api/crypto/btc?interval=1d&limit=10\n`)
    const appRes = await fetch(`${base}/api/crypto/btc?interval=1d&limit=10`, {
      signal: AbortSignal.timeout(25_000),
    })
    assert(appRes.ok, `app route HTTP ${appRes.status}`)
    const body = await appRes.json()
    const appCandles = body.candles
    assert(Array.isArray(appCandles) && appCandles.length >= 2, 'app.candles array')
    validateCandles(appCandles, 'app')
    const directTimes = new Set(candles.map((c) => c.time))
    const common = appCandles.filter((c) => directTimes.has(c.time))
    assert(common.length >= 1, 'at least one candle time overlaps Binance sample')
    const t = Math.max(...common.map((c) => c.time))
    const d = candles.find((c) => c.time === t)
    const a = appCandles.find((c) => c.time === t)
    const closeDrift = Math.abs(d.close - a.close)
    assert(closeDrift < 1e-2, `close matches at time ${t} (drift ${closeDrift})`)
  } else {
    console.log('\n  (Set VERIFY_APP_BASE_URL to compare with local Next /api/crypto/btc)\n')
  }

  console.log('All verify-btc-binance-sample checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
