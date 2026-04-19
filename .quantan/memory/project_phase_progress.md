---
name: QUANTAN Phase Progress
description: Tracks completion status of the 7-phase upgrade plan - which phases are done, in progress, or pending
type: project
last_updated: 2026-04-19
---

## 7-Phase Upgrade Plan Progress

**Phase 1: Testing & Validation Foundation** - ✅ COMPLETE (commit eec5b30)
- Vitest setup with 80% coverage thresholds
- Consolidated indicators in `lib/quant/indicators.ts` (canonical source)
- 10 test files in `__tests__/`
- Benchmark script: `scripts/benchmark-signals.mjs` (baseline: 56.35% win rate)
- QA: `lib/qa/dataValidator.ts`, `lib/qa/signalTracker.ts`

**Phase 2: Signal Engine Hardening** - ✅ COMPLETE (merged via PR #3)
- `lib/quant/multiTimeframe.ts` - daily->weekly/monthly aggregation, alignment score (-3 to +3)
- `lib/quant/regimeDetection.ts` - vol20/vol60 ratio, ADX trend, strategy hint
- `lib/quant/volumeProfile.ts` - POC, Value Area High/Low
- `lib/backtest/signals.ts` - `enhancedCombinedSignal()` with 7-factor weighted scoring
  - Regime-adaptive weights (trend_following / mean_reversion / neutral profiles)
  - BUY > 0.25, SELL < -0.30 thresholds
- `lib/backtest/engine.ts` - Updated to call enhanced signal
- 187 tests passing, TypeScript clean

**Phase 3: Options & Flow Data** - ✅ COMPLETE (branch: claude/pedantic-morse)
- `lib/options/greeks.ts` - Black-Scholes pricing, IV (Newton-Raphson), Greeks
- `lib/options/chain.ts` - Yahoo options() wrapper + greeks enrichment
- `lib/options/sentiment.ts` - P/C ratios, max pain
- `lib/options/gex.ts` - Gamma exposure per strike, flip point
- `lib/options/flow.ts` - Unusual flow detection, flow sentiment
- `app/api/options/[ticker]/route.ts` - 5-min cached endpoint
- `components/options/` - OptionsChainTable, GexChart, MaxPainGauge, FlowScanner
- `app/stock/[ticker]/page.tsx` - Added "Options" tab (lazy loaded)
- 4 test files in `__tests__/options/`

**Phase 4: Advanced Analytics** - ✅ COMPLETE (branch: claude/pedantic-morse)
- `lib/quant/intermarket.ts` - Correlation vs SPY/VIX/UUP/TLT, regime classification
- `lib/quant/sectorRotation.ts` - Momentum + RSI mean-reversion sector ranking
- `app/api/sector-rotation/route.ts` - 1hr cached sector rotation endpoint
- `components/SectorRotationPanel.tsx` - Sector heatmap grid
- `ml/` - Python FastAPI sidecar (features.py, ensemble.py, server.py, requirements.txt)
- `lib/ml/client.ts` + `app/api/ml/[ticker]/route.ts` - graceful ML proxy
- 2 new test files (`intermarket.test.ts`, `sectorRotation.test.ts`)
- 266 tests passing, TypeScript clean

**Phase 5: Data Infrastructure** - ✅ COMPLETE (2026-04-19)
- `lib/data/providers/` — types, Yahoo, Polygon, Alpha Vantage, FRED (`fetchFredObservations`), `getEquityDataProvider()` chain (Polygon → AV → Yahoo)
- `lib/data/warehouse.ts` — candle/quote/meta schema helpers (DB-agnostic)
- `scripts/migrate-json-to-sqlite.mjs` + `npm run migrate:warehouse` — JSON → SQLite via Node `node:sqlite` (Node 22.5+); prefer local disk for DB path on synced cloud folders
- `lib/backtest/dataLoader.ts` — `QUANTAN_SQLITE_PATH` → SQLite, else JSON
- `app/api/stream/[ticker]/route.ts` — SSE Yahoo quotes every 15s
- `app/api/analytics/[ticker]/route.ts` — refactored to equity provider chain

**Phase 6: Portfolio & Risk** - ✅ MVP (2026-04-19)
- `lib/portfolio/tracker.ts` — localStorage paper portfolio, reconciliation vs quotes
- `lib/portfolio/riskParity.ts`, `diversification.ts`, `stressTest.ts` — minimal APIs
- `app/portfolio/page.tsx` — dashboard + stress cards

**Phase 7: Continuous Optimization** - ✅ MVP (2026-04-19)
- `scripts/nightly-backtest.ts` + `npm run nightly` — local 56-ticker sweep, win-rate gate
- `.github/workflows/nightly-backtest.yml` — schedule + `continue-on-error` so CI stays runnable
- `lib/optimize/gridSearch.ts` + `POST /api/optimize` — bounded grid + Pareto filter
- `app/monitor/page.tsx` — live snapshot from `GET /api/backtest`
- `package.json` — `test`, `benchmark`, `nightly` scripts restored/added

---

## Institutional backtest autopilot (20-phase roadmap) — 2026-04-19

Charter, audit envelopes, risk-budget clamps, options feature snapshots, signal fusion, paper income preview, entry/exit **condition** bands, Command Center one-shot (backtest + dual optimize), walk-forward grid scoring, optimizer job id cache, chart daily bars via `getEquityDataProvider()`, rate limits on heavy POST routes, Vitest + `benchmark:optimizer`, and `docs/EXTERNAL_STRATEGY_VETTING.md` are in place. Outputs remain **historical / illustrative** — no performance guarantees.

---

**How to apply:** At the start of any development session, check this file to know where to pick up. Then read `AGENTS.md` in the project root for full implementation details of the next phase.
