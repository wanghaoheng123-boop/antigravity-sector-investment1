# Architecture Review Log

## 2026-04-22 — Continuation Cycle

- Closed Phase A matrix diagnostics gap by adding coverage and per-ticker alignment diagnostics in `scripts/backtest-matrix.ts`.
- Added profile-based gate governance (`strict` / `staging`) in `config/institutional-gates.json` and scorecard evaluator.
- Added ranking stability gate script `scripts/ranking-rolling-stability.ts` with top-5 overlap and top-10 rank-correlation metrics.
- Extended institutional ranking with regime, persistence, and accumulation sub-scores.
- Began orchestrator production alignment by adding API-backed ingestion fallbacks and stronger executor quality gating.

## Open Architectural Risks

- Python orchestrator still partially relies on fallback/stub sources when local APIs are unavailable.
- Long-history warehouse quality can remain environment-dependent on local SQLite availability.
- Ranking strict qualification thresholds require calibration after fresh artifacts are regenerated.
