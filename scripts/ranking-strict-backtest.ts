import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { backtestInstrument, walkForwardAnalysis, walkForwardSummary } from '@/lib/backtest/engine'
import { loadLongHistory } from '@/lib/backtest/dataLoader'
import { DEFAULT_CONFIG } from '@/lib/backtest/signals'
import { SECTORS } from '@/lib/sectors'
import { buildInstitutionalRanking } from '@/lib/alpha/institutionalRanking'

const UNIVERSE = Array.from(new Set([
  ...SECTORS.flatMap((s) => s.topHoldings.slice(0, 3)),
  'SPY',
  'QQQ',
  'GLD',
  'BTC',
]))

function main(): void {
  const years = 10
  const rows = UNIVERSE
    .map((ticker) => {
      const history = loadLongHistory(ticker, years)
      if (history.length < 350) return null
      const result = backtestInstrument(ticker, 'strict_rank', history, DEFAULT_CONFIG)
      const wf = walkForwardSummary(walkForwardAnalysis(ticker, 'strict_rank', history, 252, 63, DEFAULT_CONFIG))
      return { result, wf, bars: history.length }
    })
    .filter((v): v is NonNullable<typeof v> => v != null)

  const ranking = buildInstitutionalRanking(rows.map((r) => ({ result: r.result, walkForward: r.wf })))
  const strict = ranking.filter(
    (r) => r.actionBias === 'accumulate' && r.robustnessScore >= 0.55 && r.riskControlScore >= 0.6,
  )

  const payload = {
    generatedAt: new Date().toISOString(),
    years,
    universeSize: UNIVERSE.length,
    tested: rows.length,
    strictQualified: strict.length,
    rankingTop20: ranking.slice(0, 20),
    strictQualifiedTop20: strict.slice(0, 20),
  }

  const outDir = join(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'institutional-ranking-strict.json')
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`[ranking:strict] wrote ${outPath}; qualified=${strict.length}`)
}

main()
