# QUANTAN — Agent Onboarding Guide

> **For any AI agent (Claude, Cursor, Windsurf, Copilot, etc.) picking up this project.**
> Read this file first. It tells you what exists, what the current state is, and what constraints to respect.

---

## Project Overview

QUANTAN is a world-class quantitative trading platform built with Next.js 14 (App Router),
TypeScript, and Python. It provides institutional-grade market intelligence across all 11 GICS
sectors — real-time prices, K-line charts, options flow, dark pool data, backtesting, portfolio
risk management, and AI-driven signal generation.

**Repository:** `E:\wang haoheng\Documents\QUANTAN-sector-investment`
**Branch convention:** Feature work on `claude/<name>`, merge to `main` via PR.

---

## Phase Status (7-Phase Plan)

| Phase | Name | Status | Key Files |
|-------|------|--------|-----------|
| 1 | Core Platform & Charts | ✅ Complete | `app/`, `components/KLineChart.tsx` |
| 2 | Quant Engine & Backtester | ✅ Complete | `lib/backtest/engine.ts`, `lib/quant/` |
| 3 | Options & Flow Data | ✅ Complete | `lib/options/`, `components/options/` |
| 4 | Advanced Analytics | ✅ Complete | `lib/quant/intermarket.ts`, `lib/quant/sectorRotation.ts`, `ml/` |
| 5 | Data Infrastructure | ✅ Complete | `lib/data/providers/`, `lib/data/warehouse.ts` |
| 6 | Portfolio & Risk Management | ✅ Complete | `lib/portfolio/`, `app/portfolio/` |
| 7 | Continuous Optimization | ✅ Complete | `lib/optimize/`, `scripts/nightly-backtest.ts`, `.github/workflows/` |

**ALL 7 PHASES COMPLETE.** Next focus: production hardening, additional ML models, real-time data subscriptions.

---

## What Was Built (Complete Inventory)

### Phase 3 — Options & Flow Data
- `lib/options/greeks.ts` — Black-Scholes, Greeks, Newton-Raphson IV solver
- `lib/options/chain.ts` — Yahoo options() wrapper with Greeks enrichment
- `lib/options/sentiment.ts` — P/C ratios, max pain calculation
- `lib/options/gex.ts` — Gamma exposure per strike, flip point detection
- `lib/options/flow.ts` — Unusual flow detection, near-ask/bid sentiment
- `app/api/options/[ticker]/route.ts` — 5-min cached options API
- `components/options/` — OptionsChainTable, GexChart, MaxPainGauge, FlowScanner

### Phase 4 — Advanced Analytics
- `lib/quant/intermarket.ts` — 63d/252d rolling correlation vs SPY/VIX/UUP/TLT, regime classification
- `lib/quant/sectorRotation.ts` — Momentum score + RSI mean-reversion, sector ranking
- `app/api/sector-rotation/route.ts` — 1h cached sector rotation endpoint
- `components/SectorRotationPanel.tsx` — Sector heatmap grid
- `ml/` — Python FastAPI sidecar (RandomForest + XGBoost + LogisticRegression ensemble)
- `lib/ml/client.ts` — TypeScript ML client with 5s timeout + graceful fallback
- `app/api/ml/[ticker]/route.ts` — ML proxy endpoint

### Phase 5 — Data Infrastructure
- `lib/data/providers/types.ts` — DataProvider / MacroDataProvider interfaces
- `lib/data/providers/yahoo.ts` — YahooProvider (primary)
- `lib/data/providers/polygon.ts` — PolygonProvider (secondary, rate-limited)
- `lib/data/providers/alphavantage.ts` — AlphaVantageProvider (tertiary)
- `lib/data/providers/fred.ts` — FredProvider (macro series, CSV fallback)
- `lib/data/providers/index.ts` — `fetchDailyWithFallback()`, `fetchQuoteWithFallback()`
- `lib/data/warehouse.ts` — SQLite candle store (better-sqlite3, graceful Vercel fallback)
- `scripts/migrate-json-to-sqlite.ts` — One-time JSON → SQLite migration
- `lib/backtest/dataLoader.ts` — SQLite-first, JSON fallback, unified `availableTickers()`
- `app/api/stream/[ticker]/route.ts` — SSE real-time price streaming

### Phase 6 — Portfolio & Risk Management
- `lib/portfolio/tracker.ts` — Immutable portfolio engine (open/close/average, FIFO P&L, localStorage)
- `lib/portfolio/riskParity.ts` — Inverse-volatility weighting, rebalance deltas, HHI
- `lib/portfolio/diversification.ts` — Correlation matrix, diversification ratio, effective N, A–D grade
- `lib/portfolio/stressTest.ts` — 5 historical scenarios (GFC/COVID/RateShock/Dot-Com/FlashCrash)
- `lib/portfolio/sizing.ts` — Kelly criterion position sizing with portfolio constraints + vol scaling
- `app/api/portfolio/route.ts` — POST — summary + diversification analytics
- `app/api/portfolio/risk-parity/route.ts` — POST — inverse-vol weights
- `app/api/portfolio/stress-test/route.ts` — POST/GET — stress engine + scenario catalog
- `app/api/portfolio/sizing/route.ts` — POST — Kelly-based position sizing
- `app/portfolio/page.tsx` — Full portfolio dashboard (positions, stress, risk parity, trade history)

### Phase 7 — Continuous Optimization
- `lib/optimize/gridSearch.ts` — Walk-forward grid search engine + SMA crossover evaluator
- `app/api/optimize/route.ts` — POST — inline grid search for monitor dashboard
- `app/api/backtest/walk-forward/route.ts` — GET — walk-forward IS/OOS analysis per ticker
- `scripts/nightly-backtest.ts` — Multi-ticker nightly runner (JSON report + JSONL log)
- `.github/workflows/nightly-backtest.yml` — Scheduled CI (02:00 UTC daily)
- `.github/workflows/ci.yml` — PR CI: lint → typecheck → unit tests
- `app/api/monitor/route.ts` — System health endpoint
- `app/monitor/page.tsx` — Live system monitor (30s auto-refresh + inline optimizer)

---

## Architecture Facts

### Next.js (TypeScript)
- **Router:** App Router (`app/` directory), Node.js runtime for all data routes
- **API routes:** `app/api/*/route.ts` — use `NextResponse.json()` with `Cache-Control` headers
- **Path alias:** `@/` maps to project root (configured in `tsconfig.json`)
- **Client components:** require `'use client'` directive; server components are the default
- **Streaming:** SSE via `ReadableStream` in `app/api/stream/[ticker]/route.ts`

### Data Flow (Priority Chain)
```
SQLite Warehouse → JSON backtestData → Yahoo Finance → Polygon → AlphaVantage
```
- `isWarehouseAvailable()` from `lib/data/warehouse.ts` — check before DB calls
- `fetchDailyWithFallback()` from `lib/data/providers/index.ts` — auto-chains providers
- `loadStockHistory(ticker)` from `lib/backtest/dataLoader.ts` — SQLite-first + JSON fallback

### Options Pricing
- Greeks: `lib/options/greeks.ts` — Abramowitz & Stegun 26.2.17 polynomial `normalCdf`
- `RISK_FREE_RATE = 0.0525` (used in chain.ts)
- IV solver: Newton-Raphson, max 100 iterations, ε = 1e-6

### Portfolio Engine
- **Immutable updates:** all mutations return new `Portfolio` objects
- **localStorage:** `savePortfolio()` / `loadPortfolio()` — browser only, no-op on server
- **FIFO P&L:** `realizedPnl()` matches BUY→SELL lots in order
- **Kelly sizing:** `lib/portfolio/sizing.ts` — always half-Kelly or less for real capital

### Backtest Engine
- **Look-ahead fix:** Signal at close[i], execute at open[i+1] — no same-day bias
- **Transaction cost:** 11 bps per side (22 bps round-trip) — `TX_COST_BPS_PER_SIDE`
- **Sortino:** denominator = N (total observations), not negative-only count — fixed
- **Walk-forward:** `walkForwardAnalysis()` in `lib/backtest/engine.ts` — IS/OOS windows

### ML Sidecar
- Python FastAPI on port 8001: `GET /predict/{ticker}`, `GET /health`
- Start: `cd ml && uvicorn server:app --port 8001`
- Features: 14 engineered (RSI14, MACD, BB%B, ATR%, OBV slope, momentum, vol regime, EMA slopes)
- Ensemble: RandomForest + XGBoost + LogisticRegression, soft-vote; BUY > 0.6, SELL < 0.4

---

## Navigation (app/layout.tsx)
```
Markets / Desk / Commodities / Crypto / Heatmap / 200MA / Briefs / Portfolio (NEW) / Monitor
```

---

## Test Commands (Windows)
```bash
# Run all tests
node_modules/.bin/vitest.cmd run

# Run specific directory
node_modules/.bin/vitest.cmd run __tests__/portfolio

# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Full verification
npm run verify:data && npm run typecheck && npm run test
```

**Test coverage:** 363 tests across 25 test files (all pass as of last commit).

---

## Key Shared Utilities (never reimplement)

| Utility | Location |
|---------|----------|
| `normalCdf`, `blackScholesPrice`, `greeks`, `impliedVolatility` | `lib/options/greeks.ts` |
| `smaArray`, `ema`, `rsi`, `macd`, `atr`, `bollinger` | `lib/quant/indicators.ts` |
| `logReturns`, `correlation`, `alignCloses` | `lib/quant/relativeStrength.ts` |
| `annualizedVolFromCloses` | `lib/quant/volatility.ts` |
| `kellyFraction`, `halfKelly` | `lib/quant/kelly.ts` |
| `detectRegime` | `lib/quant/regimeDetection.ts` |
| `loadStockHistory`, `availableTickers` | `lib/backtest/dataLoader.ts` |
| `backtestInstrument`, `walkForwardAnalysis` | `lib/backtest/engine.ts` |
| `computePositionSize`, `fixedFractionSize` | `lib/portfolio/sizing.ts` |
| `riskParityWeights` | `lib/portfolio/riskParity.ts` |
| `diversificationReport` | `lib/portfolio/diversification.ts` |
| `runStressTests`, `classifyTicker` | `lib/portfolio/stressTest.ts` |
| `gridSearch`, `smaCrossoverEvaluator` | `lib/optimize/gridSearch.ts` |

---

## Critical Constraints

1. **No look-ahead bias:** Signal on close[i], execute on open[i+1]. Never use tomorrow's data in today's signal.
2. **Vercel compatible:** No native modules in Edge runtime. SQLite uses dynamic require with graceful fallback.
3. **Never reimplement** indicators or math already in `lib/quant/` — reuse existing code.
4. **Test coverage:** Every new `lib/` module needs a `__tests__/` counterpart.
5. **TypeScript strict:** `tsc --noEmit` must pass before any commit.
6. **Lint:** `npm run lint` must pass before any commit (`.eslintrc.json` + `next/core-web-vitals`).
7. **Kelly sizing:** Always default to half-Kelly or less. Never expose full-Kelly as a default.
8. **Immutable portfolio:** `lib/portfolio/tracker.ts` functions return new objects — do not mutate.

---

## Environment Variables

| Variable | Provider | Required for |
|----------|----------|-------------|
| `POLYGON_API_KEY` | Polygon.io | Secondary price data |
| `ALPHAVANTAGE_API_KEY` | Alpha Vantage | Tertiary price data |
| `FRED_API_KEY` | St. Louis Fed | Macro series with higher rate limits |
| `NEXTAUTH_SECRET` | — | Auth (next-auth) |
| `NEXTAUTH_URL` | — | Auth callback URL |

Yahoo Finance (primary) and FRED CSV fallback require no keys.

---

## Memory Files
Full project memory lives in `.quantan/memory/`:
- `MEMORY.md` — index
- `project_quantan_vision.md` — 7-phase vision
- `user_profile.md` — user profile
- `project_phase_progress.md` — phase-by-phase progress
- `feedback_development.md` — code style rules

Update `project_phase_progress.md` after completing any milestone.
