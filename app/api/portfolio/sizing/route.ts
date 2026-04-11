/**
 * POST /api/portfolio/sizing
 *
 * Compute Kelly-based position sizing for a proposed new trade.
 *
 * Body:
 *   {
 *     // Either provide stats directly:
 *     winRate?: number,      // 0-1
 *     avgWin?: number,       // positive decimal
 *     avgLoss?: number,      // positive decimal
 *     sampleSize?: number,
 *
 *     // Or derive from trade history:
 *     trades?: Array<{ ticker: string; action: 'BUY'|'SELL'; pnlPct?: number }>,
 *     ticker?: string,       // optional filter — derive stats only for this ticker
 *
 *     // Always required:
 *     portfolioEquity: number,
 *     entryPrice: number,
 *
 *     // Optional constraints:
 *     maxPositionPct?: number,
 *     maxPositions?: number,
 *     fixedRiskPct?: number,
 *     instrumentAnnualVol?: number,
 *     targetDailyVol?: number,
 *   }
 */

import { NextResponse } from 'next/server'
import {
  computePositionSize,
  tradeStatsFromHistory,
  fixedFractionSize,
  type TradeStats,
  type SizingConfig,
} from '@/lib/portfolio/sizing'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const portfolioEquity = Number(body['portfolioEquity'])
  const entryPrice      = Number(body['entryPrice'])

  if (!isFinite(portfolioEquity) || portfolioEquity <= 0) {
    return NextResponse.json({ error: 'portfolioEquity must be a positive number' }, { status: 422 })
  }
  if (!isFinite(entryPrice) || entryPrice <= 0) {
    return NextResponse.json({ error: 'entryPrice must be a positive number' }, { status: 422 })
  }

  // Resolve TradeStats
  let stats: TradeStats | null = null

  if (body['winRate'] != null) {
    // Directly provided stats
    stats = {
      winRate:    Number(body['winRate']),
      avgWin:     Number(body['avgWin']  ?? 0.05),
      avgLoss:    Number(body['avgLoss'] ?? 0.03),
      sampleSize: Number(body['sampleSize'] ?? 0),
    }
    if (!isFinite(stats.winRate) || stats.winRate < 0 || stats.winRate > 1) {
      return NextResponse.json({ error: 'winRate must be in [0, 1]' }, { status: 422 })
    }
  } else if (Array.isArray(body['trades'])) {
    // Derive from trade history
    stats = tradeStatsFromHistory(
      body['trades'] as Array<{ ticker: string; action: 'BUY' | 'SELL'; pnlPct?: number }>,
      body['ticker'] as string | undefined,
    )
  }

  const config: SizingConfig = {
    maxPositionPct:     body['maxPositionPct']      != null ? Number(body['maxPositionPct'])      : undefined,
    maxPositions:       body['maxPositions']         != null ? Number(body['maxPositions'])         : undefined,
    fixedRiskPct:       body['fixedRiskPct']         != null ? Number(body['fixedRiskPct'])         : undefined,
    targetDailyVol:     body['targetDailyVol']       != null ? Number(body['targetDailyVol'])       : undefined,
    instrumentAnnualVol: body['instrumentAnnualVol'] != null ? Number(body['instrumentAnnualVol']) : undefined,
  }

  // Always include fixed-fraction fallback
  const stopLossPct = body['stopLossPct'] != null ? Number(body['stopLossPct']) : 0.05
  const fixedRisk   = body['fixedRiskPct'] != null ? Number(body['fixedRiskPct']) : 0.01
  const fixed = fixedFractionSize(portfolioEquity, entryPrice, fixedRisk, stopLossPct)

  if (!stats) {
    // No stats available — return fixed-fraction only
    return NextResponse.json({
      kellySizing:  null,
      fixedSizing:  fixed,
      note: 'No trade history available. Using fixed-fraction sizing (1% risk per trade).',
    })
  }

  const sizing = computePositionSize(stats, portfolioEquity, entryPrice, config)

  return NextResponse.json({
    kellySizing: sizing,
    fixedSizing: fixed,
    stats,
  })
}
