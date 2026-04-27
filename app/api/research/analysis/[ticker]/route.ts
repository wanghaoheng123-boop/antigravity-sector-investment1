import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { RESEARCH_TEAM } from '@/lib/research/team'
import { detectFloorCeiling, type KellyZoneInput } from '@/lib/quant/priceFloorCeiling'
import { buildMarketMakerState, buildDeltaAnalysis, buildMmNarrative } from '@/lib/quant/marketMakerAnalysis'
import { sma200DeviationPct, sma200Slope, sma } from '@/lib/backtest/signals'
import type { OhlcvRow } from '@/lib/backtest/dataLoader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface YahooQuoteResult {
  symbol: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number
  bid: number
  ask: number
  bidSize: number
  askSize: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamps: number[]
      indicators: {
        quote: Array<{
          open: number[]
          high: number[]
          low: number[]
          close: number[]
          volume: number[]
        }>
      }
    }>
  }
}

interface SignalScore {
  type: string
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number    // 0-100
  evidence: string
  source: string
}

interface ResearchVerdict {
  overall: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  signals: SignalScore[]
  teamNarratives: { agent: string; narrative: string }[]
  keyLevels: { floor: number | null; ceiling: number | null }
  riskFactors: string[]
  opportunities: string[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.toUpperCase() ?? ''
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  const signals: SignalScore[] = []

  try {
    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [quoteResult, chartResult]: [YahooQuoteResult, YahooChartResult] = await Promise.all([
      YahooFinance.quote(ticker) as Promise<YahooQuoteResult>,
      YahooFinance.chart(ticker, {
        period1: Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000),
        interval: '1d',
      }) as Promise<YahooChartResult>,
    ])

    const spotPrice = quoteResult.regularMarketPrice
    const quoteTime = new Date(quoteResult.regularMarketTime * 1000).toISOString()

    if (!spotPrice || spotPrice <= 0) {
      return NextResponse.json({ error: 'Invalid spot price' }, { status: 422 })
    }

    const result = chartResult.chart.result?.[0]
    if (!result) {
      return NextResponse.json({ error: 'No chart data' }, { status: 422 })
    }

    const q = result.indicators?.quote?.[0]
    if (!q) {
      return NextResponse.json({ error: 'No quote data' }, { status: 422 })
    }

    const timestamps = result.timestamps ?? []
    const candles: OhlcvRow[] = timestamps
      .map((ts: number, i: number) => ({
        time: ts,
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter(c => c.close > 0)

    if (candles.length < 60) {
      return NextResponse.json({ error: 'Insufficient data for full analysis' }, { status: 422 })
    }

    // ── 1. Dr. Sarah Chen: Price Floor/Ceiling + Regime ────────────────────
    const closes = candles.map(c => c.close)
    const lastPrice = closes[closes.length - 1]
    const sma200 = sma(closes, 200)
    const devPct = sma200 != null ? sma200DeviationPct(lastPrice, sma200) ?? 0 : 0
    const slope = sma200Slope(closes) ?? 0
    const atr = computeAtr(candles, 14)

    let regime: KellyZoneInput['regime'] = 'FLAT'
    if (devPct > 20) regime = 'EXTREME_BULL'
    else if (devPct > 10) regime = 'EXTENDED_BULL'
    else if (devPct > 0) regime = 'HEALTHY_BULL'
    else if (devPct > -10) regime = 'FIRST_DIP'
    else if (devPct > -20) regime = 'DEEP_DIP'
    else if (devPct > -30) regime = 'BEAR_ALERT'
    else regime = 'CRASH_ZONE'

    const regimeKellyInput: KellyZoneInput = { regime, atr, entry: spotPrice, priceVs200EmaPct: devPct }
    const floorCeilingResult = detectFloorCeiling(ticker, spotPrice, quoteTime, candles, undefined, regimeKellyInput, 120)

    signals.push({
      type: 'Regime',
      direction: regime.includes('BULL') ? 'bullish' : regime.includes('BEAR') || regime.includes('CRASH') ? 'bearish' : 'neutral',
      confidence: Math.min(90, Math.round(Math.abs(devPct) * 3)),
      evidence: `Price ${devPct > 0 ? 'above' : 'below'} 200SMA by ${Math.abs(devPct).toFixed(1)}%. Slope: ${slope > 0 ? 'positive' : 'negative'}.`,
      source: 'Dr. Sarah Chen (Quantitative Strategist)',
    })

    if (floorCeilingResult.floor) {
      signals.push({
        type: 'Floor',
        direction: 'bullish',
        confidence: floorCeilingResult.floor.strength,
        evidence: `Floor detected at ${floorCeilingResult.floor.price.toFixed(2)} (${floorCeilingResult.floor.distanceFromSpot.toFixed(1)}% below). Sources: ${floorCeilingResult.floor.sources.join(', ')}. Strength: ${floorCeilingResult.floor.strength}/100.`,
        source: 'Dr. Sarah Chen (Quantitative Strategist)',
      })
    }
    if (floorCeilingResult.ceiling) {
      signals.push({
        type: 'Ceiling',
        direction: 'bearish',
        confidence: floorCeilingResult.ceiling.strength,
        evidence: `Ceiling detected at ${floorCeilingResult.ceiling.price.toFixed(2)} (${floorCeilingResult.ceiling.distanceFromSpot.toFixed(1)}% above). Sources: ${floorCeilingResult.ceiling.sources.join(', ')}. Strength: ${floorCeilingResult.ceiling.strength}/100.`,
        source: 'Dr. Sarah Chen (Quantitative Strategist)',
      })
    }

    // ── 2. Elena Rodriguez: Market Maker / Delta Flow ──────────────────────
    const bid = quoteResult.bid ?? spotPrice * 0.9999
    const ask = quoteResult.ask ?? spotPrice * 1.0001
    const bidSize = quoteResult.bidSize ?? 0
    const askSize = quoteResult.askSize ?? 0
    const changePct = quoteResult.regularMarketChangePercent ?? 0

    // Compute signed net gamma from options chain ladder
    let netGamma = 0
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      const optRes = await fetch(`${baseUrl}/api/options/chain/${ticker}`, { cache: 'no-store' })
      if (optRes.ok) {
        const optData = await optRes.json()
        if (optData.gammaLadder) {
          netGamma = optData.gammaLadder.reduce((s: number, l: { netGamma: number }) => s + l.netGamma, 0)
        }
      }
    } catch { /* netGamma remains 0 */ }

    const mmState = buildMarketMakerState(ticker, quoteTime, candles, bid, ask, bidSize, askSize, netGamma, changePct)
    const deltaAnalysis = buildDeltaAnalysis(ticker, candles)

    signals.push({
      type: 'Market Maker Bias',
      direction: mmState.hedgingBias === 'buy' ? 'bullish' : mmState.hedgingBias === 'sell' ? 'bearish' : 'neutral',
      confidence: Math.min(85, Math.abs(mmState.hedgingPressure)),
      evidence: mmState.hedgingBias !== 'neutral'
        ? `MM hedging: dealers must ${mmState.hedgingBias.toUpperCase()} stock. Pressure: ${Math.abs(mmState.hedgingPressure)}%. ${buildMmNarrative(mmState)}`
        : 'No significant MM hedging signal detected.',
      source: 'Elena Rodriguez (Market Microstructure Analyst)',
    })

    if (mmState.smartMoneySignal !== 'neutral') {
      signals.push({
        type: 'Smart Money',
        direction: mmState.smartMoneySignal === 'accumulating' ? 'bullish' : 'bearish',
        confidence: 70,
        evidence: `Smart money signal: ${mmState.smartMoneySignal.toUpperCase()}. Delta ratio: ${deltaAnalysis.summary.deltaRatio.toFixed(2)}.`,
        source: 'Elena Rodriguez (Market Microstructure Analyst)',
      })
    }

    if (deltaAnalysis.summary.divergenceFound) {
      signals.push({
        type: 'Delta Divergence',
        direction: deltaAnalysis.summary.divergenceType === 'bullish' ? 'bullish' : 'bearish',
        confidence: deltaAnalysis.summary.divergenceStrength,
        evidence: `${deltaAnalysis.summary.divergenceType.toUpperCase()} divergence detected. Strength: ${deltaAnalysis.summary.divergenceStrength}/100.`,
        source: 'Elena Rodriguez (Market Microstructure Analyst)',
      })
    }

    // ── 3. Aisha Patel: Data Quality Check ───────────────────────────────
    // Check for anomalous data points
    const priceReturns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
    const avgReturn = priceReturns.reduce((s, r) => s + r, 0) / priceReturns.length
    const stdReturn = Math.sqrt(priceReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / priceReturns.length)
    const anomalyCount = priceReturns.filter(r => Math.abs(r - avgReturn) > 3 * stdReturn).length

    signals.push({
      type: 'Data Quality',
      direction: anomalyCount > 5 ? 'bearish' : anomalyCount > 2 ? 'neutral' : 'bullish',
      confidence: 90,
      evidence: `Data quality: ${anomalyCount} anomalous candles detected in 1Y of data. ${anomalyCount <= 2 ? 'Clean dataset.' : anomalyCount > 5 ? 'High noise level.' : 'Normal noise level.'}`,
      source: 'Aisha Patel (Data Scientist)',
    })

    // ── Build Verdict ────────────────────────────────────────────────────
    const bullishSignals = signals.filter(s => s.direction === 'bullish')
    const bearishSignals = signals.filter(s => s.direction === 'bearish')
    const neutralSignals = signals.filter(s => s.direction === 'neutral')

    const bullishConf = bullishSignals.reduce((s, sg) => s + sg.confidence, 0) / Math.max(1, bullishSignals.length)
    const bearishConf = bearishSignals.reduce((s, sg) => s + sg.confidence, 0) / Math.max(1, bearishSignals.length)

    let overall: ResearchVerdict['overall'] = 'neutral'
    let confidence = 50

    if (bullishConf > bearishConf * 1.3 && bullishSignals.length >= 2) {
      overall = 'bullish'
      confidence = Math.round(bullishConf)
    } else if (bearishConf > bullishConf * 1.3 && bearishSignals.length >= 2) {
      overall = 'bearish'
      confidence = Math.round(bearishConf)
    }

    const teamNarratives = [
      {
        agent: 'Dr. Sarah Chen',
        narrative: `Regime: ${regime}. 200SMA deviation: ${devPct > 0 ? '+' : ''}${devPct.toFixed(1)}%. ${floorCeilingResult.bias === 'bullish' ? `Bullish bias — floor at ${floorCeilingResult.floor?.price.toFixed(2)}, strength ${floorCeilingResult.floor?.strength ?? 0}/100.` : floorCeilingResult.bias === 'bearish' ? `Bearish bias — ceiling at ${floorCeilingResult.ceiling?.price.toFixed(2)}, strength ${floorCeilingResult.ceiling?.strength ?? 0}/100.` : 'Neutral bias — no strong floor or ceiling detected.'}`,
      },
      {
        agent: 'Elena Rodriguez',
        narrative: `MM Pressure: ${mmState.hedgingBias.toUpperCase()}. Smart Money: ${mmState.smartMoneySignal.toUpperCase()}. ${buildMmNarrative(mmState)}`,
      },
      {
        agent: 'Marcus Webb',
        narrative: 'Options data requires dedicated options API call to /api/options/chain/[ticker] for gamma/Vanna/Charm analysis.',
      },
      {
        agent: 'Aisha Patel',
        narrative: `Data integrity: ${anomalyCount <= 2 ? 'PASS' : anomalyCount > 5 ? 'WARN' : 'MONITOR'}. ${anomalyCount} outlier candles detected in 1Y.`,
      },
    ]

    const riskFactors: string[] = []
    const opportunities: string[] = []

    if (regime === 'CRASH_ZONE' || regime === 'BEAR_ALERT') {
      riskFactors.push(`${regime} regime detected. High drawdown risk. Reduce exposure.`)
    }
    if (anomalyCount > 5) {
      riskFactors.push('Elevated data noise — verify data source integrity before trading.')
    }
    if (mmState.hedgingBias === 'sell' && regime.includes('BULL')) {
      riskFactors.push('Market destabilizing (dealers short gamma) despite bullish regime — watch for squeeze.')
    }

    if (floorCeilingResult.bias === 'bullish' && floorCeilingResult.floor) {
      opportunities.push(`Strong floor at ${floorCeilingResult.floor.price.toFixed(2)} — watch for bounce from this level.`)
    }
    if (mmState.smartMoneySignal === 'accumulating') {
      opportunities.push('Smart money accumulation detected — institutional buying present.')
    }
    if (devPct > 0 && slope > 0 && changePct > 0.5) {
      opportunities.push('Price above 200SMA, positive slope, intraday momentum up — confirmed uptrend.')
    }

    const verdict: ResearchVerdict = {
      overall,
      confidence,
      signals,
      teamNarratives,
      keyLevels: {
        floor: floorCeilingResult.floor?.price ?? null,
        ceiling: floorCeilingResult.ceiling?.price ?? null,
      },
      riskFactors,
      opportunities,
    }

    return NextResponse.json(
      {
        ticker,
        spotPrice,
        quoteTime,
        change: quoteResult.regularMarketChange,
        changePct: quoteResult.regularMarketChangePercent,
        regime,
        sma200DevPct: devPct,
        sma200Slope: slope,
        atr14: atr,
        floorCeiling: {
          floor: floorCeilingResult.floor,
          ceiling: floorCeilingResult.ceiling,
          vwapZone: floorCeilingResult.vwapZone,
          bias: floorCeilingResult.bias,
          nearbyLevels: floorCeilingResult.nearbyLevels.slice(0, 5),
        },
        marketMaker: {
          hedgingBias: mmState.hedgingBias,
          hedgingPressure: mmState.hedgingPressure,
          smartMoneySignal: mmState.smartMoneySignal,
          orderImbalance: mmState.orderImbalance,
          imbalanceDirection: mmState.imbalanceDirection,
        },
        delta: {
          totalDelta: deltaAnalysis.summary.totalDelta,
          deltaRatio: deltaAnalysis.summary.deltaRatio,
          divergenceFound: deltaAnalysis.summary.divergenceFound,
          divergenceType: deltaAnalysis.summary.divergenceType,
        },
        dataQuality: { anomalyCount, avgReturn, stdReturn },
        verdict,
        team: RESEARCH_TEAM.map(a => ({ id: a.id, name: a.name, specialty: a.specialty })),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error(`[Research Analysis API] ${ticker}:`, error)
    return NextResponse.json(
      { error: 'Research analysis failed', details: String(error) },
      { status: 500 }
    )
  }
}

function computeAtr(candles: { high: number; low: number; close: number }[], period: number = 14): number {
  if (candles.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev.close),
      Math.abs(candles[i].low - prev.close)
    )
    trs.push(tr)
  }
  const firstAtr = trs.slice(0, period).reduce((s, tr) => s + tr, 0) / period
  let prevAtr = firstAtr
  for (let i = period; i < trs.length; i++) {
    prevAtr = (prevAtr * (period - 1) + trs[i]) / period
  }
  return Number.isFinite(prevAtr) && prevAtr > 0 ? prevAtr : 0
}
