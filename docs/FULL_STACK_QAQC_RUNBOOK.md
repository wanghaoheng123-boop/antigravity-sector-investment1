# Full-Stack QAQC Runbook

## Goal
Run repeatable, multi-pass verification with artifact-backed evidence and explicit fail/skip rules.

## Pass 0: Environment
- `npm.cmd ci`
- `npm.cmd run typecheck`

## Pass 1: Core logic
- `npm.cmd run verify:logic`
- `npm.cmd run verify:indicators`
- `npm.cmd run verify:btc`

## Pass 2: Strategy evidence artifacts
- `npm.cmd run backtest:matrix`
- `npm.cmd run backtest:ranking:strict`
- `npm.cmd run ranking:rolling:stability`
- `npm.cmd run scorecard:evaluate`
- `npm.cmd run loop:mission`

## Required Artifacts
- `artifacts/backtest-matrix.json`
- `artifacts/institutional-ranking-strict.json`
- `artifacts/ranking-rolling-stability.json`
- `artifacts/institutional-scorecard.json`
- `artifacts/loop-mission/<run_id>.json`

## Fail Rules
- Missing required artifact => fail.
- Any malformed metric in scorecard inputs => fail.
- Any step fail in loop mission => fail.

## Notes
- Use `QUANTAN_GATE_PROFILE=staging` for staging checks.
- Use `QUANTAN_GATE_PROFILE=strict` for promotion candidate verification.
