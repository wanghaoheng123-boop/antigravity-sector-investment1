/**
 * Data verification: Kraken public OHLC invariants + optional parity with app route (no Binance).
 * Run: node scripts/verify-btc-ohlc-sample.mjs
 * Optional: VERIFY_APP_BASE_URL=http://127.0.0.1:3000  (Next must be running)
 */
const KRAKEN_OHLC = 'https://api.kraken.com/0/public/OHLC'

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
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
  console.log('Kraken OHLC (XBTUSD 1d interval=1440, last 10)\n')
  const url = `${KRAKEN_OHLC}?pair=XBTUSD&interval=1440`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'QUANTAN-verify/1.0' },
    signal: AbortSignal.timeout(20_000),
  })
  assert(res.ok, `Kraken HTTP ${res.status}`)
  const data = await res.json()
  assert(!data.error?.length, 'Kraken error array empty')
  const pairKey = Object.keys(data.result ?? {}).find((k) => k !== 'last')
  assert(pairKey, 'Kraken result pair key')
  const rows = data.result[pairKey]
  assert(Array.isArray(rows) && rows.length >= 2, 'Kraken OHLC rows')
  const slice = rows.slice(-10)
  const candles = slice
    .map((row) => {
      if (!Array.isArray(row) || row.length < 7) return null
      return {
        time: Number(row[0]),
        open: parseFloat(String(row[1])),
        high: parseFloat(String(row[2])),
        low: parseFloat(String(row[3])),
        close: parseFloat(String(row[4])),
        volume: parseFloat(String(row[6])),
      }
    })
    .filter(Boolean)
  validateCandles(candles, 'kraken')

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
    const krakenTimes = new Set(candles.map((c) => c.time))
    const common = appCandles.filter((c) => krakenTimes.has(c.time))
    assert(common.length >= 1, 'at least one candle time overlaps Kraken sample')
    const t = Math.max(...common.map((c) => c.time))
    const k = candles.find((c) => c.time === t)
    const a = appCandles.find((c) => c.time === t)
    const closeDrift = Math.abs(k.close - a.close)
    assert(closeDrift < 50, `close roughly matches at time ${t} (drift ${closeDrift})`)
  } else {
    console.log('\n  (Set VERIFY_APP_BASE_URL to compare with local Next /api/crypto/btc)\n')
  }

  console.log('All verify-btc-ohlc-sample checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
