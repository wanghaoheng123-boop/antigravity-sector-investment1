# Phase 11 — Portfolio Backtest Report (Loop 3)

Run timestamp: `2026-04-28T08:59:05.286Z`
Instruments: **56**  ·  Elapsed: **22.2s**

## Portfolio summary

| Metric | Value |
| --- | --- |
| Initial capital | $100,000 |
| Final capital | $116,136.298 |
| Total return | **16.14%** |
| Annualized return | 1.23% |
| Sharpe ratio | -0.30 |
| Sortino ratio | -0.16 |
| Max drawdown | 10.69% |
| Win rate | 61.74% |
| Profit factor | 3.07 |
| Total trades | 115 |
| Max concurrent positions | 9 |
| Avg concurrent positions | 0.52 |
| VaR 95% (1d) | 0.58% |
| VaR 99% (1d) | 1.59% |

## Sector attribution

| Sector | Trades | Win rate | Avg return |
| --- | --- | --- | --- |
| Technology | 27 | 63.0% | 4.14% |
| Consumer Disc. | 16 | 68.8% | 3.71% |
| Communication | 16 | 50.0% | 1.79% |
| Industrials | 13 | 69.2% | 6.23% |
| Healthcare | 10 | 40.0% | -0.86% |
| Financials | 10 | 70.0% | 4.31% |
| Energy | 9 | 100.0% | 10.61% |
| Real Estate | 5 | 20.0% | -1.96% |
| Utilities | 4 | 75.0% | 2.48% |
| Materials | 4 | 25.0% | -1.04% |
| Consumer Staples | 1 | 100.0% | 0.82% |

## Exit reason histogram

| Reason | Count |
| --- | --- |
| signal | 4 |
| stop_loss | 24 |
| time_exit | 62 |
| profit_target | 24 |
| end_of_data | 1 |

## Top 15 trades by P&L

| Ticker | Sector | Entry | Exit | Shares | P&L $ | P&L % | Exit reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AVGO | Technology | 2026-03-30 | 2026-04-13 | 29 | $2504 | 29.4% | time_exit |
| AVGO | Technology | 2025-04-03 | 2025-04-09 | 65 | $2024 | 20.2% | profit_target |
| TSLA | Consumer Disc. | 2025-09-02 | 2025-09-15 | 25 | $2017 | 24.5% | time_exit |
| AVGO | Technology | 2025-04-03 | 2025-04-15 | 65 | $1621 | 16.2% | time_exit |
| SLB | Energy | 2022-09-26 | 2022-10-07 | 148 | $1292 | 25.8% | time_exit |
| GOOGL | Communication | 2024-09-06 | 2024-09-18 | 141 | $1253 | 5.9% | time_exit |
| CAT | Industrials | 2023-05-31 | 2023-06-12 | 38 | $1222 | 15.6% | time_exit |
| AVGO | Technology | 2026-03-30 | 2026-04-07 | 28 | $1136 | 13.8% | profit_target |
| META | Communication | 2026-01-14 | 2026-01-27 | 18 | $1034 | 9.3% | time_exit |
| TSLA | Consumer Disc. | 2025-09-02 | 2025-09-11 | 25 | $986 | 12.0% | profit_target |
| MSFT | Technology | 2024-08-05 | 2024-08-16 | 42 | $979 | 5.9% | time_exit |
| META | Communication | 2026-01-14 | 2026-01-26 | 17 | $966 | 9.2% | profit_target |
| CVX | Energy | 2022-09-23 | 2022-10-05 | 68 | $936 | 9.5% | time_exit |
| EOG | Energy | 2022-09-23 | 2022-10-05 | 54 | $916 | 15.5% | time_exit |
| GE | Industrials | 2026-03-30 | 2026-04-13 | 23 | $889 | 14.1% | time_exit |

## Notes

- Default `maxPositions=10`, `maxSinglePositionPct=20%`, half-Kelly sizing, ATR-adaptive stops, profit-taking exits.
- Signal: `enhancedCombinedSignal` with `DEFAULT_CONFIG` (no per-sector profile in this run — see benchmark-enhanced for that).
- VaR uses the historical-simulation method on daily portfolio returns; Basel-conformant.
- Equity curve in JSON is sampled every 21 trading days to keep the file readable.
