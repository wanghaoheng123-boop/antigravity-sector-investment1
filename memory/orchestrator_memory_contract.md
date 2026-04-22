# Orchestrator Memory Contract

This contract defines how the autonomous orchestrator writes state while preserving the canonical memory system already used by QUANTAN.

## Canonical Memory Inputs (Read-First)

Each orchestrator run must read these files in order before generating work:

1. `AGENTS.md`
2. `memory/MEMORY.md`
3. `memory/project_status.md`
4. `memory/agent_handoff_protocol.md`
5. `memory/execution_scorecard_protocol.md`

## Write Targets During Each Cycle

The orchestrator must write to both human-readable memory and machine ledger.

- Human-readable continuity:
  - `task_plan.md` (active objective and current phase)
  - `findings.md` (new evidence and validation notes)
  - `progress.md` (run completion and next checkpoint)
- Machine continuity:
  - SQLite ledger tables (`runs`, `experiments`, `backtest_results`, `options_intel_snapshots`, `behavioral_features`, `data_quality_audit`, `decisions`, `artifacts`)
  - JSON export per run in `memory/ledger_exports/<run_id>.json`
  - Snapshot pointer in `memory/snapshots/latest.json`

## Scorecard Field Requirements

Each completed run must include these fields in structured output:

- `run_id`
- `active_target_set`
- `metric_ids_touched`
- `status_changes`
- `artifacts_generated`
- `blockers`
- `next_action_for_continue`

## Resume Guarantees

- Runs are append-only and immutable after completion.
- A run can be resumed only when status is `running` or `paused`.
- On resume, orchestrator loads:
  - latest incomplete `runs` row
  - latest snapshot payload
  - previous experiment parameter history for anti-looping checks

## Governance Rules

- Do not create alternate memory trees.
- If evidence changes gate status, write both:
  - ledger `decisions`
  - human summary in `progress.md`
- Every cycle must produce exactly one `next_action_for_continue`.
