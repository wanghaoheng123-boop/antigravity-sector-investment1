import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function runStep(name: string, command: string, requiredArtifact?: string): {
  name: string
  command: string
  pass: boolean
  output: string
  durationMs: number
  requiredArtifact?: string
  artifactExists?: boolean
} {
  const startedAt = Date.now()
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf-8' })
    const artifactExists = requiredArtifact ? existsSync(requiredArtifact) : undefined
    const pass = requiredArtifact ? Boolean(artifactExists) : true
    return { name, command, pass, output, durationMs: Date.now() - startedAt, requiredArtifact, artifactExists }
  } catch (e) {
    const output =
      e instanceof Error && 'stdout' in e
        ? String((e as { stdout?: string; stderr?: string }).stdout ?? '') + String((e as { stdout?: string; stderr?: string }).stderr ?? '')
        : String(e)
    const artifactExists = requiredArtifact ? existsSync(requiredArtifact) : undefined
    return { name, command, pass: false, output, durationMs: Date.now() - startedAt, requiredArtifact, artifactExists }
  }
}

function main() {
  const runId = `loop_${Date.now()}`
  const gateProfile = process.env.QUANTAN_GATE_PROFILE?.trim() || 'staging'
  const artifactsDir = join(process.cwd(), 'artifacts')
  const steps = [
    runStep('typecheck', 'npm run typecheck'),
    runStep('long_data_verify', 'npm run verify:data:long', join(artifactsDir, 'long-data-diagnostics.json')),
    runStep('backtest_matrix', 'npm run backtest:matrix', join(artifactsDir, 'backtest-matrix.json')),
    runStep('ranking_strict_backtest', 'npm run backtest:ranking:strict', join(artifactsDir, 'institutional-ranking-strict.json')),
    runStep('ranking_rolling_stability', 'npm run ranking:rolling:stability', join(artifactsDir, 'ranking-rolling-stability.json')),
    runStep('scorecard_evaluate', 'npm run scorecard:evaluate', join(artifactsDir, 'institutional-scorecard.json')),
  ]

  const scorecardPath = join(process.cwd(), 'artifacts', 'institutional-scorecard.json')
  let scorecardOverall = false
  try {
    const scorecard = JSON.parse(readFileSync(scorecardPath, 'utf-8')) as { overallPass: boolean }
    scorecardOverall = scorecard.overallPass
  } catch {
    scorecardOverall = false
  }

  const payload = {
    runId,
    generatedAt: new Date().toISOString(),
    gateProfile,
    steps,
    overallPass: steps.every((s) => s.pass) && scorecardOverall,
    nextActionForContinue: steps.every((s) => s.pass) && scorecardOverall
      ? 'Promote candidate and rerun loop after data refresh.'
      : 'Fix failed checks and rerun loop mission.',
  }

  const outDir = join(process.cwd(), 'artifacts', 'loop-mission')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${runId}.json`)
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`[loop] wrote ${outPath} overallPass=${payload.overallPass}`)
  if (!payload.overallPass) process.exitCode = 1
}

main()
