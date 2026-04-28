# Phase 11 — Portfolio Backtest Report (Loop 3)

Run timestamp: `2026-04-28T08:50:14.762Z`
Instruments: **56**  ·  Elapsed: **23.0s**

## Portfolio summary

| Metric | Value |
| --- | --- |
| Initial capital | $100,000 |
| Final capital | $111,282.443 |
| Total return | **11.28%** |
| Annualized return | 0.88% |
| Sharpe ratio | -0.44 |
| Sortino ratio | -0.22 |
| Max drawdown | 10.66% |
| Win rate | 60.36% |
| Profit factor | 2.56 |
| Total trades | 111 |
| Max concurrent positions | 9 |
| Avg concurrent positions | 0.50 |
| VaR 95% (1d) | 0.53% |
| VaR 99% (1d) | 1.51% |

## Sector attribution

| Sector | Trades | Win rate | Avg return |
| --- | --- | --- | --- |
| Technology | 25 | 60.0% | 2.48% |
| Consumer Disc. | 16 | 68.8% | 3.71% |
| Communication | 16 | 50.0% | 1.79% |
| Industrials | 11 | 72.7% | 5.62% |
| Healthcare | 10 | 40.0% | -0.87% |
| Energy | 9 | 100.0% | 10.61% |
| Financials | 9 | 66.7% | 3.22% |
| Real Estate | 6 | 16.7% | -2.82% |
| Utilities | 4 | 75.0% | 2.48% |
| Materials | 4 | 25.0% | -1.04% |
| Consumer Staples | 1 | 100.0% | 0.82% |

## Exit reason histogram

| Reason | Count |
| --- | --- |
| signal | 4 |
| stop_loss | 25 |
| time_exit | 56 |
| profit_target | 20 |
| end_of_data | 6 |

## Top 15 trades by P&L

| Ticker | Sector | Entry | Exit | Shares | P&L $ | P&L % | Exit reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TSLA | Consumer Disc. | 2025-09-02 | 2025-09-15 | 25 | $2017 | 24.5% | time_exit |
| AVGO | Technology | 2025-04-03 | 2025-04-09 | 64 | $1993 | 20.2% | profit_target |
| AVGO | Technology | 2025-04-03 | 2025-04-15 | 65 | $1621 | 16.2% | time_exit |
| SLB | Energy | 2022-09-26 | 2022-10-07 | 147 | $1283 | 25.8% | time_exit |
| GOOGL | Communication | 2024-09-06 | 2024-09-18 | 139 | $1236 | 5.9% | time_exit |
| CAT | Industrials | 2023-05-31 | 2023-06-12 | 38 | $1222 | 15.6% | time_exit |
| AVGO | Technology | 2026-03-30 | 2026-04-02 | 56 | $1124 | 6.8% | end_of_data |
| META | Communication | 2026-01-14 | 2026-01-27 | 18 | $1034 | 9.3% | time_exit |
| TSLA | Consumer Disc. | 2025-09-02 | 2025-09-11 | 25 | $986 | 12.0% | profit_target |
| MSFT | Technology | 2024-08-05 | 2024-08-16 | 42 | $979 | 5.9% | time_exit |
| META | Communication | 2026-01-14 | 2026-01-26 | 17 | $966 | 9.2% | profit_target |
| CVX | Energy | 2022-09-23 | 2022-10-05 | 67 | $922 | 9.5% | time_exit |
| EOG | Energy | 2022-09-23 | 2022-10-05 | 53 | $899 | 15.5% | time_exit |
| XOM | Energy | 2024-09-11 | 2024-09-23 | 115 | $879 | 7.0% | time_exit |
| GE | Industrials | 2026-03-30 | 2026-04-02 | 45 | $874 | 7.1% | end_of_data |

## Notes

- Default `maxPositions=10`, `maxSinglePositionPct=20%`, half-Kelly sizing, ATR-adaptive stops, profit-taking exits.
- Signal: `enhancedCombinedSignal` with `DEFAULT_CONFIG` (no per-sector profile in this run — see benchmark-enhanced for that).
- VaR uses the historical-simulation method on daily portfolio returns; Basel-conformant.
- Equity curve in JSON is sampled every 21 trading days to keep the file readable.
