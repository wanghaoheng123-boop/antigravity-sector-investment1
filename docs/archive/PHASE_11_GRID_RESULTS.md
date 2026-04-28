# Phase 11 — Grid Search Results (Loop 1)

Run timestamp: `2026-04-28T08:42:54.363Z`
Total combinations per ticker: **768**  ·  Elapsed: **80.5s**  ·  Instruments: **56**

Aggregate avg OOS win rate (per-ticker best params): **34.04%**
Loop 1 target (≥ 60%): **NOT MET**

## Most-frequent best params across instruments

| Parameter | Value |
| --- | --- |
| `slopeThreshold` | 0.003 |
| `buyWScoreThreshold` | 0.2 |
| `sellWScoreThreshold` | -0.25 |
| `confidenceThreshold` | 50 |
| `atrStopMultiplier` | 1.2 |

## Per-sector breakdown

### Technology

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| AAPL | 832 | 17.1% | 18.2% | -1.0pp | -1.03 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=2.5` |
| AMD | 0 | — | — | — | — | _no valid combos_ |
| AVGO | 1024 | 50.0% | 54.5% | -4.5pp | 0.32 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=2.5` |
| MSFT | 0 | — | — | — | — | _no valid combos_ |
| NVDA | 256 | 14.3% | 0.0% | 14.3pp | -2.14 | `slope=0.008, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Healthcare

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| ABBV | 1024 | 48.3% | 95.7% | -47.4pp | 1.16 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.5` |
| JNJ | 768 | 30.0% | 75.0% | -45.0pp | 0.53 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| LLY | 0 | — | — | — | — | _no valid combos_ |
| MRK | 0 | — | — | — | — | _no valid combos_ |
| UNH | 896 | 84.6% | 100.0% | -15.4pp | 4.04 | `slope=0.008, buy=0.2, sell=-0.25, conf=50, atr=2` |

### Utilities

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| AEP | 1024 | 61.1% | 100.0% | -38.9pp | 2.60 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| DUK | 1024 | 0.0% | 100.0% | -100.0pp | 1.46 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| NEE | 1024 | 16.7% | 20.0% | -3.3pp | -0.87 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| PCG | 0 | — | — | — | — | _no valid combos_ |
| SO | 512 | 46.2% | 50.0% | -3.8pp | -0.20 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Real Estate

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| AMT | 512 | 0.0% | 53.8% | -53.8pp | -0.27 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| EQIX | 0 | — | — | — | — | _no valid combos_ |
| PLD | 0 | — | — | — | — | _no valid combos_ |
| SPG | 768 | 29.2% | 33.3% | -4.2pp | -0.11 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| WELL | 0 | — | — | — | — | _no valid combos_ |

### Consumer Disc.

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| AMZN | 0 | — | — | — | — | _no valid combos_ |
| HD | 896 | 28.6% | 36.4% | -7.8pp | -0.74 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=2.5` |
| MCD | 768 | 47.1% | 86.7% | -39.6pp | 0.80 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| NKE | 0 | — | — | — | — | _no valid combos_ |
| TSLA | 1024 | 39.4% | 66.7% | -27.3pp | 0.06 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.5` |

### Materials

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| APD | 0 | — | — | — | — | _no valid combos_ |
| DOW | 0 | — | — | — | — | _no valid combos_ |
| FCX | 0 | — | — | — | — | _no valid combos_ |
| LIN | 704 | 14.3% | 19.4% | -5.1pp | -0.97 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| NEM | 1024 | 0.0% | 24.1% | -24.1pp | -0.30 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Financials

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| BAC | 256 | 22.2% | 18.8% | 3.5pp | -0.32 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| BRK.B | 512 | 45.5% | 73.9% | -28.5pp | 0.57 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| JPM | 256 | 0.0% | 57.1% | -57.1pp | 0.58 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=2.5` |
| MA | 0 | — | — | — | — | _no valid combos_ |
| V | 512 | 60.0% | 85.7% | -25.7pp | 0.76 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Crypto

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| BTC | 0 | — | — | — | — | _no valid combos_ |

### Industrials

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| CAT | 0 | — | — | — | — | _no valid combos_ |
| GE | 1024 | 0.0% | 100.0% | -100.0pp | 2.86 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| HON | 768 | 42.9% | 66.7% | -23.8pp | 0.50 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| RTX | 0 | — | — | — | — | _no valid combos_ |
| UNP | 256 | 0.0% | 40.0% | -40.0pp | -0.18 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Energy

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| COP | 0 | — | — | — | — | _no valid combos_ |
| CVX | 0 | — | — | — | — | _no valid combos_ |
| EOG | 1024 | 50.0% | 94.1% | -44.1pp | 1.84 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| SLB | 0 | — | — | — | — | _no valid combos_ |
| XOM | 512 | 75.0% | 61.1% | 13.9pp | -0.03 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

### Consumer Staples

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| COST | 1024 | 50.0% | 100.0% | -50.0pp | 3.26 | `slope=0.01, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| KO | 1024 | 38.9% | 51.7% | -12.8pp | 0.10 | `slope=0.005, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| PEP | 0 | — | — | — | — | _no valid combos_ |
| PG | 512 | 76.2% | 91.7% | -15.5pp | 1.18 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |
| WMT | 0 | — | — | — | — | _no valid combos_ |

### Communication

| Ticker | Valid | IS WR | OOS WR | Gap | OOS Sharpe | Best params |
| --- | --- | --- | --- | --- | --- | --- |
| DIS | 0 | — | — | — | — | _no valid combos_ |
| GOOGL | 0 | — | — | — | — | _no valid combos_ |
| META | 1024 | 0.0% | 87.5% | -87.5pp | 0.77 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=2.5` |
| NFLX | 0 | — | — | — | — | _no valid combos_ |
| T | 1024 | 0.0% | 44.0% | -44.0pp | -0.34 | `slope=0.003, buy=0.2, sell=-0.25, conf=50, atr=1.2` |

## How to interpret

- **Valid** = number of grid combinations that produced ≥ 5 OOS trades AND IS-OOS gap < 15pp.
- **OOS WR** = win rate on the held-out 30% of bars (not seen during parameter selection).
- **Gap** = IS WR − OOS WR. Gaps > 8pp suggest overfitting risk.
- **OOS Sharpe** is the primary objective; ties broken by OOS WR.
- Tickers with `_no valid combos_` need broader parameter ranges or richer signals (Phase D gates).

## Next steps

1. Compare per-sector best params with the static profile in `lib/optimize/sectorProfiles.ts` and update where the data disagrees.
2. Promote Loop 2 (`scripts/benchmark-enhanced.ts`) which already wires `getProfileForTicker`.
3. Run Loop 3 (`scripts/portfolio-backtest.ts`) with these tuned per-ticker params.
