# Findings: QUANTAN Comprehensive Review (4-Hour Sprint)

## Priority: P0 Issues Found

### P0-1: ATR Array Indexing Off-by-One (Look-Ahead Bias) — lib/backtest/signals.ts:79
- The `atr()` function shifts all ATR values by +1 index position
- `out[period] = avg` stores ATR for bars[period+1] instead of bars[period]
- In backtest engine: `atrVals[i]` reads tomorrow's ATR instead of today's
- Fix: change `out[period] = avg` → `out[period - 1] = avg` and fix loop index
- Source: Quant Finance Review

### P0-2: Raw Close Prices — No Split/Dividend Adjustment — scripts/fetchBacktestData.mjs:86-99
- Uses unadjusted close prices from Yahoo. AAPL (Aug 2020 4:1), NVDA (3 splits since 2021)
- Total return vs price return divergence corrupts backtest returns
- Fix: Use `includeAdjustedClose=true` with split/dividend events
- Source: Data Science Review

### P0-3: Daily Returns Array Never Populated — lib/backtest/engine.ts:349
- `dailyReturns` is never pushed to during backtest loop — empty array
- Sharpe/Sortino ratios silently return null due to insufficient data
- Fix: Push `currentEquity(state)` to `equityHistory` unconditionally every iteration
- Source: Data Science Review

### P0-4: BTC Absent from Live Signals — app/api/backtest/live/route.ts:134-208
- `btcSignal()` is never called in GET handler — BTC excluded from live signals
- Fix: Call `btcSignal()` and push result to instruments
- Source: Data Science Review

### P0-5: Live Signals Empty Catch — app/backtest/page.tsx:605-607
- Silent failure gives no indication server error vs no data
- Users may act on stale data thinking it's live
- Fix: Set error state and display meaningful message
- Source: Software Engineering Review

### P0-6: RSI confLabels toFixed on NaN — lib/backtest/signals.ts:359-360
- `rsiBullish` false → `rsi14` is NaN → `NaN.toFixed(1)` = "NaN" string in output
- Fix: Guard with Number.isFinite check
- Source: Software Engineering Review

### P0-7: Trailing Stop Uses Current ATR Not Entry ATR — lib/backtest/engine.ts:177-179
- Comment says "FIX T12: use entry ATR" but code uses current ATR
- Profit thresholds dynamically shift with volatility — not a real trailing stop
- Fix: Use stored `atrAtrPctAtEntry`
- Source: Quant Finance Review

### P0-8: Asymmetric Slippage Entry vs Exit — lib/backtest/engine.ts:271 vs 297
- BUY entries: next-day open + 2bps slippage
- SELL exits: same-day close, NO slippage
- ~2bps systematic bias in favor of strategy unrealistically
- Fix: Apply slippage to exits too
- Source: Quant Finance Review

---

## Priority: P1 Issues Found

### P1-1: EMA Initialization Seeds with values[0] Not SMA(period) — lib/backtest/signals.ts:15
- Seed with `values[0]` instead of `SMA(first period bars)` — non-standard
- Different from `KLineChart.tsx calcEMA` which uses correct SMA seed
- Affects all downstream indicators using this EMA
- Source: Mathematics Review

### P1-2: Live Route Hardcoded Confidence Threshold — app/api/backtest/live/route.ts:97
- Hardcoded `55` instead of `DEFAULT_CONFIG.confidenceThreshold`
- Silent divergence from backtest config if threshold changes
- Fix: Import and use `DEFAULT_CONFIG.confidenceThreshold`
- Source: Quant Finance Review

### P1-3: Sharpe Ratio Mislabeled as Calmar — app/backtest/page.tsx:244
- Shows `avgAnnReturn / maxDrawdown` labeled as "Sharpe Ratio"
- Actual Sharpe uses volatility, not drawdown
- Fix: Calculate true Sharpe or rename to "Return/DD Ratio"
- Source: Mathematics + UI/UX Review

### P1-4: Portfolio Alpha Compares Incompatible Quantities — lib/backtest/engine.ts:544
- `alpha = truePortfolioReturn - bnhAvg` where bnhAvg is equal-weighted avg
- vs portfolio return from carry-forward combined equity
- Not measuring same thing
- Fix: Use actual B&H portfolio equity curve as benchmark
- Source: Quant Finance Review

### P1-5: RSI Legend IIFE Recalculates O(n) Per Render — KLineChart.tsx:962-967
- IIFE inside JSX computes RSI from scratch on every render/crosshair move
- RSI already computed via calcRSI in data effect
- Fix: Memoize last RSI value
- Source: Software Engineering Review

### P1-6: Canvas Doesn't Respond to Resize — EquityCurveChart.tsx:22-25
- Only measures bounding rect once on mount
- Fix: Add ResizeObserver
- Source: Software Engineering Review

### P1-7: NEXTAUTH Secret Fallback to Placeholder — lib/auth.ts:28
- Falls back to 'NOT-CONFIGURED-BUILD-TIME-PLACEHOLDER' if unset
- Allows session forgery in production
- Fix: Throw if secret is placeholder, matching auth 2.ts behavior
- Source: Software Engineering Review

---

## Priority: P2 Issues Found

### P2-1: Backtest Files ~1 Year Stale — scripts/backtestData/
- Data fetched April 2, 2026, no refresh mechanism
- Fix: Add scheduled refresh mechanism
- Source: Data Science Review

### P2-2: EMA Legend Colors Don't Match CHART_EMA_COLORS — KLineChart.tsx vs lib/chartEma.ts
- EMA 40: legend uses bg-yellow-600 but chart uses #d97706 (amber-600)
- Fix: Generate legend from CHART_EMA_COLORS
- Source: UI/UX Review

### P2-3: Slope Display ×100 Bug — app/backtest/page.tsx:840
- If slopePct already a percentage, ×100 inflates to meaningless values
- deviationPct not ×100 suggests inconsistency
- Fix: Verify data contract; likely remove ×100
- Source: UI/UX Review

### P2-4: Walk-Forward Annualization Wrong Denominator — app/backtest/page.tsx:511
- `((1+ret)^(252/rets.length) - 1)` uses 63-bar quarter length
- Should use same denominator as IS period or explicitly annualize quarters
- Source: Mathematics Review

### P2-5: Kelly Formula Dead Code — lib/quant/kelly.ts
- `kellyFraction()` is never called — signals use hardcoded Kelly heuristics
- Fix: Wire up kellyFraction() or remove dead code
- Source: Quant Finance Review

### P2-2: 15-Second Refresh Creates Visual Noise — app/page.tsx:108
- Per-second countdown tick is anxiety-inducing for traders
- Fix: Remove countdown, show silent refresh with pulse dot
- Source: UI/UX Review

---

## Disputes / Cross-Team

1. **Sortino denominator**: Quant team says "wrong formula" (squaring instead of absolute), Math team says "mathematically equivalent." Resolved: non-standard but not wrong — downgrade to P2.
2. **Signal exit timing**: BUY entries use next-day open, SELL exits same-day close — Quant team flagged as inconsistency. Quant team acknowledges this is slightly conservative for exits. Remains as P0 due to systematic slippage asymmetry.
3. **Kelly dead code**: Quant team says remove it, Math team says wire it up. Left as P2 for now.

---

## Decisions Made
1. Prioritize: Fix all P0 issues first, then P1, then P2 in available time
2. Not all P1 issues can be fixed in 4-hour sprint — prioritize data correctness first
3. Sharpe Ratio rename takes precedence over recalculation (simpler fix)
4. ATR indexing bug: fix signals.ts atr() function to match calcATR in KLineChart

---

## Open Questions from Teams

1. **slopePct data contract**: Is it already a % or a decimal? Team has conflicting views. Fixed: added guard to prevent NaN display.
2. **walkForward testDays=63, trainDays=252**: Non-overlapping windows would be more conservative. Question deferred.
3. **DCF sensitivity analysis**: Not implemented. Where is it supposed to be called from?
4. **Data refresh**: How often should backtest JSON be refreshed? No automated mechanism exists.
