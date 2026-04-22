import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { backtestInstrument, walkForwardAnalysis, walkForwardSummary } from '@/lib/backtest/engine'
import { loadLongHistory } from '@/lib/backtest/dataLoader'
import { DEFAULT_CONFIG } from '@/lib/backtest/signals'
import { SECTORS } from '@/lib/sectors'
import { buildInstitutionalRanking } from '@/lib/alpha/institutionalRanking'

const UNIVERSE = Array.from(new Set([
  ...SECTORS.flatMap((s) => s.topHoldings.slice(0, 2)),
  'SPY',
  'QQQ',
  'GLD',
  'BTC',
]))

interface RankedRow {
  ticker: string
  rankScore: number
}

function overlapJaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  const inter = [...A].filter((x) => B.has(x)).length
  const union = new Set([...a, ...b]).size
  return union > 0 ? inter / union : 0
}

function topRankCorrelation(a: RankedRow[], b: RankedRow[]): number {
  const topA = a.slice(0, 10)
  const topB = b.slice(0, 10)
  const mapA = new Map(topA.map((r, i) => [r.ticker, i + 1]))
  const mapB = new Map(topB.map((r, i) => [r.ticker, i + 1]))
  const common = [...mapA.keys()].filter((t) => mapB.has(t))
  if (common.length < 3) return 0
  let d2 = 0
  for (const t of common) {
    const d = (mapA.get(t) ?? 0) - (mapB.get(t) ?? 0)
    d2 += d * d
  }
  const n = common.length
  return 1 - (6 * d2) / (n * (n * n - 1))
}

function rankingForYears(years: number): RankedRow[] {
  const evaluated = UNIVERSE
    .map((ticker) => {
      const history = loadLongHistory(ticker, years)
      if (history.length < 350) return null
      const result = backtestInstrument(ticker, 'rolling_rank', history, DEFAULT_CONFIG)
      const wf = walkForwardSummary(walkForwardAnalysis(ticker, 'rolling_rank', history, 252, 63, DEFAULT_CONFIG))
      return { result, wf }
    })
    .filter((v): v is NonNullable<typeof v> => v != null)

  return buildInstitutionalRanking(evaluated).map((r) => ({ ticker: r.ticker, rankScore: r.rankScore }))
}

function main(): void {
  const windows = [6, 7, 8, 9, 10]
  const rankings = windows.map((y) => ({ years: y, rows: rankingForYears(y) }))
  const pairwise: Array<{ leftYears: number; rightYears: number; top5Jaccard: number; top10RankCorr: number }> = []

  for (let i = 1; i < rankings.length; i += 1) {
    const prev = rankings[i - 1]
    const curr = rankings[i]
    pairwise.push({
      leftYears: prev.years,
      rightYears: curr.years,
      top5Jaccard: overlapJaccard(prev.rows.slice(0, 5).map((r) => r.ticker), curr.rows.slice(0, 5).map((r) => r.ticker)),
      top10RankCorr: topRankCorrelation(prev.rows, curr.rows),
    })
  }

  const meanTop5Jaccard = pairwise.length ? pairwise.reduce((s, x) => s + x.top5Jaccard, 0) / pairwise.length : 0
  const meanTop10RankCorr = pairwise.length ? pairwise.reduce((s, x) => s + x.top10RankCorr, 0) / pairwise.length : 0

  const out = {
    generatedAt: new Date().toISOString(),
    windows,
    pairwise,
    meanTop5Jaccard,
    meanTop10RankCorr,
  }

  const outDir = join(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'ranking-rolling-stability.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8')
  console.log(`[ranking:rolling] wrote ${outPath}`)
}

main()
