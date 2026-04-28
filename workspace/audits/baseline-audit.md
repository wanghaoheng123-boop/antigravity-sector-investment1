# Baseline Audit and Gates

## Pass / Fail Criteria

- **UI reliability:** key pages show explicit loading/empty/error states and freshness on time-sensitive data.
- **Algo robustness:** OOS trade floor >= 10, overfit gap cap <= 8pp, benchmark floor >= 55%.
- **API reliability:** timeout + retry applied and errors return standardized schema.
- **Audit quality:** two-pass DeepSeek review artifacts stored in `workspace/audits/`.
- **Verification:** typecheck/tests/benchmark commands must run to completion or document environment blocker.

## Current Status

- UI reliability: **PASS** (implemented across requested pages/components).
- Algo robustness: **PASS** (guardrails tightened in `gridSearch` and benchmark script).
- API reliability: **PASS** (shared helper integrated in 4 routes).
- Audit quality: **PASS** (`deepseek-pass1.json`, `deepseek-pass2.json`).
- Verification: **PARTIAL PASS** (tests and benchmark ran; typecheck blocked by invalid `node_modules/typescript/package.json` in environment).
