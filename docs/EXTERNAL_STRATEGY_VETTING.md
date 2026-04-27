# External strategy repository vetting (research-only)

Use this checklist **before** any third-party GitHub “strategy” influences product code. Patterns and mathematics may inspire design; **do not** wholesale-import unvetted execution logic.

## Checklist

1. **License** — OSI-approved or explicit commercial terms compatible with your distribution model.
2. **Reproducible backtest** — `README` with exact data sources, date ranges, costs, and a one-command repro (Docker or locked `npm`/`pip`).
3. **Data snooping** — Search for lookahead: same-bar signal and execution, future columns joined to past rows, global normalization on full series.
4. **Track record claims** — Require public, time-stamped artifacts (notebooks, CI logs). Treat screenshots and marketing curves as non-evidence.
5. **Parameter count vs sample size** — High DoF / short history → reject for production patterns without OOS protocol.
6. **Dependencies** — No obfuscated binaries, wallet drainers, or network exfiltration in install scripts.

## Human gate

A maintainer signs this document path and date when a repo passes **all** items. Nothing auto-merges from external repos into `main` without that sign-off.
