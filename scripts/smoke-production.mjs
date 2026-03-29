/**
 * HTTP smoke tests against a deployed site (default: Vercel production).
 * Run: npm run check:smoke
 * Local dev: npm run check:smoke:local  (expects Next at http://127.0.0.1:3000)
 * Or: SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-production.mjs
 * Extended (+ fundamentals): SMOKE_EXTENDED=1 npm run check:smoke:local:extended
 */
const base = (process.env.SMOKE_BASE_URL || 'https://antigravity-sectors.vercel.app').replace(/\/$/, '')

async function getJson(path) {
  const url = `${base}${path}`
  const res = await fetch(url, { redirect: 'follow' })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not json */
  }
  return { url, ok: res.ok, status: res.status, json, textLen: text.length }
}

function ok(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`)
  else console.error(`  ✗ ${msg}`)
  return Boolean(cond)
}

async function main() {
  console.log(`Smoke tests → ${base}\n`)

  let passed = true

  const home = await fetch(`${base}/`)
  passed &= ok(home.ok && home.status === 200, `GET / → ${home.status}`)
  const html = await home.text()
  passed &= ok(html.includes('Sector Intelligence'), 'HTML contains hero title')

  const prices = await getJson('/api/prices?tickers=AAPL,SPY')
  passed &= ok(prices.ok && prices.status === 200, `GET /api/prices → ${prices.status}`)
  const pq = prices.json?.quotes
  passed &= ok(Array.isArray(pq) && pq.length >= 2, 'prices.quotes has AAPL+SPY rows')
  const aapl = pq?.find((q) => q.ticker === 'AAPL')
  passed &= ok(
    aapl && typeof aapl.price === 'number' && aapl.price > 0,
    `AAPL price is positive number (${aapl?.price})`
  )
  passed &= ok(
    aapl && typeof aapl.changePct === 'number' && Number.isFinite(aapl.changePct),
    `AAPL changePct is finite (${aapl?.changePct})`
  )
  if (aapl && typeof aapl.change === 'number' && aapl.price > 0) {
    const impliedPct = (100 * aapl.change) / aapl.price
    const drift = Math.abs(aapl.changePct - impliedPct)
    passed &= ok(
      drift < 0.25,
      `AAPL changePct aligns with change/price (drift ${drift.toFixed(4)} < 0.25)`
    )
  }
  if (aapl && !Object.prototype.hasOwnProperty.call(aapl, 'quoteTime')) {
    console.log('  ⚠ AAPL row has no quoteTime (optional; latest app adds Yahoo regularMarketTime)')
  }

  if (process.env.SMOKE_SKIP_SEARCH === '1') {
    console.log('  ⚠ Search checks skipped (SMOKE_SKIP_SEARCH=1)')
  } else {
    let search = await getJson('/api/search?q=apple&limit=3')
    if (
      !search.ok ||
      search.status !== 200 ||
      !Array.isArray(search.json?.quotes) ||
      search.json.quotes.length < 1
    ) {
      console.log('  ⚠ /api/search?q=apple weak — retrying ticker AAPL')
      search = await getJson('/api/search?q=AAPL&limit=3')
    }
    passed &= ok(search.ok && search.status === 200, `GET /api/search → ${search.status}`)
    passed &= ok(
      Array.isArray(search.json?.quotes) && search.json.quotes.length >= 1,
      'search returns quotes (apple or AAPL fallback)'
    )
  }

  const chart = await getJson('/api/chart/AAPL?range=1mo')
  passed &= ok(chart.ok && chart.status === 200, `GET /api/chart → ${chart.status}`)
  const candles = chart.json?.candles
  passed &= ok(Array.isArray(candles) && candles.length >= 5, `chart has candles (${candles?.length})`)
  const c0 = candles?.[0]
  passed &= ok(
    c0 && typeof c0.close === 'number' && c0.close > 0,
    'first candle has positive close'
  )

  const health = await getJson('/api/bloomberg-bridge/health')
  passed &= ok(health.ok && health.status === 200, `GET bloomberg-bridge/health → ${health.status}`)

  if (process.env.SMOKE_EXTENDED === '1') {
    const fundPath =
      '/api/fundamentals/AAPL?wacc=0.09&tg=0.025&gBear=0.02&gBase=0.05&gBull=0.09'
    const fund = await getJson(fundPath)
    passed &= ok(fund.ok && fund.status === 200, `GET /api/fundamentals/AAPL → ${fund.status}`)
    const rs = fund.json?.researchScore
    passed &= ok(
      rs && typeof rs.total === 'number' && rs.total >= 0 && rs.total <= 100,
      `fundamentals researchScore.total in [0,100] (${rs?.total})`
    )
    const hasRubric = Array.isArray(rs?.rubricLines) && rs.rubricLines.length >= 1
    const hasPillars = Array.isArray(rs?.pillars) && rs.pillars.length >= 1
    passed &= ok(hasRubric || hasPillars, 'fundamentals researchScore has rubricLines or pillars')
    if (!hasRubric) {
      console.log('  ⚠ researchScore.rubricLines missing (deploy latest for score rubric in Quant Lab)')
    }
    if (fund.json?.dataLineage?.sources?.length >= 1) {
      passed &= ok(true, 'fundamentals dataLineage.sources present')
    } else {
      console.log('  ⚠ dataLineage.sources missing (deploy latest for Quant Lab lineage panel)')
    }
  }

  console.log('')
  if (!passed) {
    console.error('Some checks failed.')
    process.exit(1)
  }
  console.log('All smoke checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
