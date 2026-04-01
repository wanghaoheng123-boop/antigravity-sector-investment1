/**
 * End-to-end checks for crypto data sources (no Next required).
 * Run: node scripts/diagnose-crypto.mjs
 * Optional: VERIFY_APP_BASE_URL=http://127.0.0.1:3000
 */
const BYBIT_TICKERS = 'https://api.bybit.com/v5/market/tickers'
const COINBASE_CANDLES = 'https://api.exchange.coinbase.com/products/BTC-USD/candles'
const KRAKEN = 'https://api.kraken.com/0/public/OHLC'
const COINGECKO_OHLC = 'https://api.coingecko.com/api/v3/coins/bitcoin/ohlc'
const COINGECKO_SIMPLE = 'https://api.coingecko.com/api/v3/simple/price'

async function head(name, fn) {
  process.stdout.write(`  ${name} … `)
  try {
    const r = await fn()
    console.log(r.ok ? `OK — ${r.detail}` : `FAIL — ${r.detail}`)
    return r.ok
  } catch (e) {
    console.log('FAIL —', e?.message ?? e)
    return false
  }
}

async function main() {
  console.log('Crypto connectivity simulation\n')

  const b = await head('Bybit linear tickers (BTCUSDT)', async () => {
    const res = await fetch(`${BYBIT_TICKERS}?category=linear&symbol=BTCUSDT`, {
      headers: { Accept: 'application/json', 'User-Agent': 'QUANTAN-diagnose/1.0' },
      signal: AbortSignal.timeout(20_000),
    })
    const j = await res.json().catch(() => ({}))
    const ok = res.ok && j.retCode === 0 && j.result?.list?.length > 0
    return {
      ok,
      detail: ok ? `HTTP ${res.status}, funding=${j.result.list[0].fundingRate}` : `HTTP ${res.status}`,
    }
  })

  await head('Coinbase candles (BTC-USD 1h x3)', async () => {
    const end = Math.floor(Date.now() / 1000)
    const start = end - 3600 * 5
    const res = await fetch(`${COINBASE_CANDLES}?granularity=3600&start=${start}&end=${end}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    const raw = await res.text()
    let arr
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = null
    }
    const ok = res.ok && Array.isArray(arr) && arr.length >= 1
    return { ok, detail: ok ? `HTTP ${res.status}, ${arr.length} bars` : `HTTP ${res.status} ${raw.slice(0, 80)}` }
  })

  const k = await head('Kraken OHLC (XBTUSD 1440)', async () => {
    const res = await fetch(`${KRAKEN}?pair=XBTUSD&interval=1440`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    const j = await res.json().catch(() => ({}))
    const err = j.error?.length ? j.error.join(', ') : null
    const keys = j.result ? Object.keys(j.result).filter((x) => x !== 'last') : []
    const rows = keys.length ? j.result[keys[0]] : null
    const ok = res.ok && !err && Array.isArray(rows) && rows.length > 0
    return {
      ok,
      detail: ok ? `HTTP ${res.status}, ${rows.length} bars` : `HTTP ${res.status} ${err ?? 'bad payload'}`,
    }
  })

  const cg = await head('CoinGecko OHLC (usd, 1d)', async () => {
    const res = await fetch(`${COINGECKO_OHLC}?vs_currency=usd&days=1`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(25_000),
    })
    const raw = await res.text()
    let arr
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = null
    }
    const ok = res.ok && Array.isArray(arr) && arr.length >= 2
    return { ok, detail: ok ? `HTTP ${res.status}, ${arr.length} points` : `HTTP ${res.status} ${raw.slice(0, 80)}` }
  })

  await head('CoinGecko simple price', async () => {
    const res = await fetch(`${COINGECKO_SIMPLE}?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    const j = await res.json().catch(() => ({}))
    const p = j.bitcoin?.usd
    const ok = res.ok && typeof p === 'number'
    return { ok, detail: ok ? `HTTP ${res.status}, BTC $${p}` : `HTTP ${res.status}` }
  })

  const base = process.env.VERIFY_APP_BASE_URL?.replace(/\/$/, '')
  if (base) {
    await head(`Next /api/crypto/btc`, async () => {
      const res = await fetch(`${base}/api/crypto/btc?interval=1d&limit=5`, { signal: AbortSignal.timeout(30_000) })
      const j = await res.json().catch(() => ({}))
      const n = j.candles?.length
      const ok = res.ok && n >= 1
      return { ok, detail: ok ? `HTTP ${res.status}, ${n} candles, source=${j.source ?? '?'}` : `HTTP ${res.status}` }
    })
    await head(`Next /api/crypto/btc/quote`, async () => {
      const res = await fetch(`${base}/api/crypto/btc/quote`, { signal: AbortSignal.timeout(30_000) })
      const j = await res.json().catch(() => ({}))
      const ok = res.ok && typeof j.price === 'number'
      return { ok, detail: ok ? `HTTP ${res.status}, $${j.price}` : `HTTP ${res.status}` }
    })
  } else {
    console.log('\n  (Set VERIFY_APP_BASE_URL to test Next routes locally / deployed)\n')
  }

  console.log('\n── Summary ──')
  if (!b) console.log('  ⚠ Bybit tickers failed — /api/crypto/btc/metrics may be empty.')
  if (!k) console.log('  ⚠ Kraken OHLC failed — app relies on CoinGecko/Coinbase for candles.')
  if (!cg) console.log('  ⚠ CoinGecko OHLC failed — if Kraken/Coinbase also fail, chart may be empty.')
  if (b && k && cg) console.log('  ✓ Core REST sources reachable from this machine.')
  console.log('\n  Live candle WebSocket (wss://ws.kraken.com/v2) — use the browser Network tab.')
  console.log('  Production PWA: /api/* must be NetworkOnly (see next.config.js) so APIs are not cached.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
