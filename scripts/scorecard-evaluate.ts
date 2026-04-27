import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

interface MatrixWindow {
  years: number
  instruments: number
  alignedTradingDays?: number
  coverageRatio?: number
  totalReturn: number
  annualizedReturn: number
  winRate: number
  maxDrawdown: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  integrity?: {
    duplicateTimestamps: number
    nonMonotonicSteps: number
    futureBars: number
    invalidPriceBars: number
    pass: boolean
  }
}

function assertNumber(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field: ${name}`)
  }
  return value
}

function main() {
  const gatesPath = join(process.cwd(), 'config', 'institutional-gates.json')
  const matrixPath = join(process.cwd(), 'artifacts', 'backtest-matrix.json')
  const rankingPath = join(process.cwd(), 'artifacts', 'institutional-ranking-strict.json')
  const rollingPath = join(process.cwd(), 'artifacts', 'ranking-rolling-stability.json')
  const gates = JSON.parse(readFileSync(gatesPath, 'utf-8')) as {
    defaultProfile?: string
    profiles?: Record<string, Record<string, number>>
    thresholds?: Record<string, number>
  }
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf-8')) as {
    windows: MatrixWindow[]
  }
  if (!Array.isArray(matrix.windows) || matrix.windows.length === 0) {
    throw new Error('Invalid matrix artifact: windows missing')
  }
  const profile = process.env.QUANTAN_GATE_PROFILE?.trim() || gates.defaultProfile || 'strict'
  const t = gates.profiles?.[profile] ?? gates.thresholds ?? {}
  if (!Object.keys(t).length) {
    throw new Error(`No thresholds found for profile=${profile}`)
  }

  const checks = matrix.windows.flatMap((w) => {
    assertNumber(`window.${w.years}.annualizedReturn`, w.annualizedReturn)
    assertNumber(`window.${w.years}.winRate`, w.winRate)
    assertNumber(`window.${w.years}.maxDrawdown`, w.maxDrawdown)
    const baseChecks = [
      { metricId: `A1_${w.years}y_ann_return`, pass: w.annualizedReturn >= t.A1_minAvgAnnReturn, measured: w.annualizedReturn, threshold: t.A1_minAvgAnnReturn },
      { metricId: `A2_${w.years}y_win_rate`, pass: w.winRate >= t.A2_minWinRate, measured: w.winRate, threshold: t.A2_minWinRate },
      { metricId: `B1_${w.years}y_max_dd`, pass: w.maxDrawdown <= t.B1_maxPortfolioDrawdown, measured: w.maxDrawdown, threshold: t.B1_maxPortfolioDrawdown },
      { metricId: `B3_${w.years}y_sharpe`, pass: (w.sharpeRatio ?? -1) >= t.B3_minSharpe, measured: w.sharpeRatio, threshold: t.B3_minSharpe },
      { metricId: `B3_${w.years}y_sortino`, pass: (w.sortinoRatio ?? -1) >= t.B3_minSortino, measured: w.sortinoRatio, threshold: t.B3_minSortino },
      { metricId: `D3_${w.years}y_coverage`, pass: w.instruments >= t.D3_minInstrumentsPerWindow, measured: w.instruments, threshold: t.D3_minInstrumentsPerWindow },
    ]
    if (!w.integrity) return baseChecks
    return [
      ...baseChecks,
      { metricId: `Q1_${w.years}y_data_integrity`, pass: w.integrity.pass, measured: w.integrity.pass ? 1 : 0, threshold: 1 },
      { metricId: `Q1_${w.years}y_no_future_bars`, pass: w.integrity.futureBars === 0, measured: w.integrity.futureBars, threshold: 0 },
      { metricId: `Q1_${w.years}y_no_nonmonotonic`, pass: w.integrity.nonMonotonicSteps === 0, measured: w.integrity.nonMonotonicSteps, threshold: 0 },
    ]
  })

  let rankingChecks: Array<{ metricId: string; pass: boolean; measured: number | null; threshold: number; rationale: string }> = []
  try {
    const ranking = JSON.parse(readFileSync(rankingPath, 'utf-8')) as { strictQualified?: number }
    const strictQualified = assertNumber('ranking.strictQualified', ranking.strictQualified ?? 0)
    rankingChecks.push({
      metricId: 'R1_strict_qualified_count',
      pass: strictQualified >= t.R1_minStrictQualified,
      measured: strictQualified,
      threshold: t.R1_minStrictQualified,
      rationale: 'Minimum number of strict-qualified names in ranking.',
    })
  } catch {
    rankingChecks.push({
      metricId: 'R1_strict_qualified_count',
      pass: false,
      measured: null,
      threshold: t.R1_minStrictQualified,
      rationale: 'Ranking artifact missing.',
    })
  }

  try {
    const rolling = JSON.parse(readFileSync(rollingPath, 'utf-8')) as {
      meanTop5Jaccard?: number
      meanTop10RankCorr?: number
    }
    rankingChecks.push({
      metricId: 'R2_top5_stability',
      pass: assertNumber('rolling.meanTop5Jaccard', rolling.meanTop5Jaccard ?? 0) >= t.R2_minTop5Stability,
      measured: rolling.meanTop5Jaccard ?? 0,
      threshold: t.R2_minTop5Stability,
      rationale: 'Average top-5 overlap across rolling windows.',
    })
    rankingChecks.push({
      metricId: 'R3_top10_rank_correlation',
      pass: assertNumber('rolling.meanTop10RankCorr', rolling.meanTop10RankCorr ?? 0) >= t.R3_minTop10RankCorrelation,
      measured: rolling.meanTop10RankCorr ?? 0,
      threshold: t.R3_minTop10RankCorrelation,
      rationale: 'Average rank correlation for top-10 across rolling windows.',
    })
  } catch {
    rankingChecks.push({
      metricId: 'R2_top5_stability',
      pass: false,
      measured: null,
      threshold: t.R2_minTop5Stability,
      rationale: 'Rolling-stability artifact missing.',
    })
    rankingChecks.push({
      metricId: 'R3_top10_rank_correlation',
      pass: false,
      measured: null,
      threshold: t.R3_minTop10RankCorrelation,
      rationale: 'Rolling-stability artifact missing.',
    })
  }

  const allChecks = [...checks, ...rankingChecks]
  const summary = {
    generatedAt: new Date().toISOString(),
    profile,
    checks: allChecks,
    overallPass: allChecks.every((c) => c.pass),
  }
  const outDir = join(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'institutional-scorecard.json')
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8')
  console.log(`[scorecard] wrote ${outPath} overallPass=${summary.overallPass}`)
  if (!summary.overallPass) process.exitCode = 1
}

main()
