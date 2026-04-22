# Next-session execution plan (resume 2026-04-22+)

This plan supersedes ad-hoc todos for the next work block. Goal: close **failed gates**, strengthen **testing / review / backtest / optimization**, and align with institutional, user-centric, profit-first requirements without promising returns.

**Phase 2 ranking + gates (detailed):** see [`docs/PLAN_RANKING_PHASE2_GATES.md`](PLAN_RANKING_PHASE2_GATES.md) — regime/sector features, accumulation proxies, scorecard R-gates, rolling stability, Opus review loop, and implementation order.

---

## North star (requirements bundle)

| Theme | Requirement | How we prove it |
|--------|-------------|-----------------|
| User-centric | Ranking board + clear actions | UI + API expose scored candidates with explainable sub-scores |
| Profit-first | Return-weighted ranking | Composite score prioritizes ann/excess return; not vibes |
| Institutional timing | Early entry before crowding | Timing pillar + options/macro context (incremental, not magic) |
| Lowest risk / best potential | Risk + OOS robustness gates | Walk-forward, drawdown caps, scorecard + strict ranking filters |
| Strict QA | Reproducible artifacts | `artifacts/*`, `npm run` scripts, optional `QUANTAN_REQUIRE_WAREHOUSE=1` in CI |

---

## Current gaps (what has not passed)

1. **Institutional scorecard** (`config/institutional-gates.json`): `overallPass=false` typically on **A1** (portfolio ann return) and **B3** (Sharpe/Sortino vs floors), even when some single-name stats look better. Root causes to treat as hypotheses until disproved:
   - Portfolio-level metrics vs median-name divergence (documented in matrix artifact).
   - Strategy economics vs 6% ann / 0.4 Sharpe — may require **strategy or data depth** change, not only math fixes.
   - History depth caps can make multiple window lengths **collapse** to the same aligned sample (see `alignedTradingDays` in `artifacts/backtest-matrix.json`).

2. **Strict ranking backtest** (`npm run backtest:ranking:strict`): may show **`strictQualified: 0`** — intentional: filters are harsh (accumulate + high robustness + risk). Passing is a **positive signal**, not a default.

3. **Loop mission** (`scripts/loop-mission.ts`): fails if **scorecard** fails or optional **long data verify** fails when a real warehouse is required (use `QUANTAN_REQUIRE_WAREHOUSE=1` only in CI with a populated DB).

4. **Benchmark guard** (`AGENTS.md`): any change to `lib/backtest/` or `lib/quant/` must keep **`npm run benchmark` ≥ 55%** win-rate floor (revert or fix if broken).

---

## Phased work (ordered)

### Phase A — Truth layer (1–2 sessions)

- [ ] **A1** Confirm warehouse/JSON **effective history length** per ticker; document min bars per asset class in `memory/` or scorecard metadata (no code churn in unrelated files).
- [ ] **A2** Extend SQLite warehouse coverage **or** document that matrix windows are capped at available depth (already partially in matrix JSON).
- [ ] **A3** Re-run after data work:  
  `npm run backtest:matrix` → `npm run scorecard:evaluate` → `npm run loop:mission`  
  Record `artifacts/institutional-scorecard.json` each run.

### Phase B — Scorecard policy (decision, not cheating)

- [ ] **B1** If gates stay red with honest economics: add **`config/institutional-gates-profiles.json`** (or `profiles` inside existing gates) with **`strict`** (current) vs **`staging`** thresholds, **documented** in one place (why staging exists: CI smoke vs release).
- [ ] **B2** Optional: scorecard checks **median instrument** metrics **in addition to** portfolio row (already in matrix JSON) — only if product agrees dual view is acceptable.

### Phase C — Ranking & alpha pipeline (your institutional timing goal)

- [ ] **C1** Harden `lib/alpha/institutionalRanking.ts`: calibrate weights using **walk-forward OOS** stability, not just in-sample backtest returns.
- [ ] **C2** Enrich **timing** inputs: ensure `/api/simulator/run` populates RSI/MACD/ATR on live quotes where feasible (currently may be null — improves timing pillar).
- [ ] **C3** Wire **sector / regime** from `lib/quant/sectorRotation.ts` + `lib/quant/regimeDetection.ts` as *features*, not overrides.
- [ ] **C4** Add **Vitest** for ranking: deterministic fixtures (synthetic equity curves with known OOS behavior).

### Phase D — Testing & review matrix (assign more)

| Layer | Command / artifact | When |
|--------|----------------------|------|
| Types | `npm run typecheck` | every commit |
| Unit | `npm run test` | every meaningful change |
| Signals baseline | `npm run benchmark` | after `lib/backtest/*` or `lib/quant/*` |
| Optimizer smoke | `npm run benchmark:optimizer` | after optimize/walk-forward changes |
| Matrix | `npm run backtest:matrix` | after engine/signals/data loader changes |
| Scorecard | `npm run scorecard:evaluate` | after matrix |
| Ranking strict | `npm run backtest:ranking:strict` | after ranking weights change |
| Full loop | `npm run loop:mission` | before “release candidate” |
| Warehouse strict | `QUANTAN_REQUIRE_WAREHOUSE=1 npm run verify:data:long` | CI only when DB provisioned |

### Phase E — Optimization & inspection

- [ ] **E1** Bounded grid / walk-forward already exist — add **report** in simulator or artifact summarizing top 3 configs + OOS score (reuse `lib/optimize/walkForwardGrid.ts`).
- [ ] **E2** External review: follow `docs/PHASE_INSPECTION_CHARTER.md`, `docs/GITHUB_PR_INSPECTION_CHECKLIST.md`, `docs/VERCEL_PROMOTION_CHECKLIST.md` before prod promotion.

---

## Definition of done (next milestone)

- Scorecard: either **strict gates green** with documented evidence **or** explicit **staging** profile + reason in config/docs (no silent threshold edits).
- Ranking: at least **one** strict-qualified name in `artifacts/institutional-ranking-strict.json` on **full warehouse** OR documented proof that dataset cannot support it yet.
- CI: typecheck + vitest + benchmark green; loop mission green on chosen profile.
- Product: user can see **ranking board** in simulator with explainable scores.

---

## Commands cheat sheet

```bash
npm run typecheck
npm run test
npm run benchmark
npm run backtest:matrix
npm run scorecard:evaluate
npm run backtest:ranking:strict
npm run loop:mission
```

---

## Continue rule

On “continue”, start with **Phase A** checklist, then **open first failing artifact** (`artifacts/institutional-scorecard.json`, `artifacts/institutional-ranking-strict.json`, latest `artifacts/loop-mission/*.json`).

---

*File created for overnight handoff. Update `memory/project_status.md` when a phase completes.*
