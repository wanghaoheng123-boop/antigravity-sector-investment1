/**
 * When to call DeepSeek via MCP (`user-deepseek` → `chat_completion`).
 * Curated from a single `deepseek-v4-pro` JSON review (2026-04-25); adjust as the product evolves.
 *
 * MCP API note: do not combine `reasoning_effort` with `thinking: { type: "disabled" }` (400).
 * For cheap structured JSON, use `deepseek-v4-pro` + `thinking: disabled` + `response_format: json_object`.
 */
export const DEEPSEEK_MCP_PLAYBOOK = {
  useV4ProWhen: [
    'Complex multi-step backtest logic with custom indicators',
    'Generating or refactoring TypeScript types from financial data shapes',
    'Debugging intricate async data pipelines for real-time signals',
    'Designing architecture for large React Quant Lab state / data flow',
    'Optimizing Monte Carlo or wide parameter sweeps with correctness constraints',
  ],
  useV4FlashWhen: [
    'Rapid prototyping of simple indicator or crossover logic',
    'Quick UI fixes (Tailwind, layout) in Quant Lab panels',
    'Boilerplate for API routes or small pure helpers',
    'Simple fetch/cache patterns with known libraries',
    'Straight-line translation of small Python quant snippets to TS',
  ],
  /** Imperative, typed-context prompts burn fewer tokens and get cleaner patches. */
  tokenEfficientPromptPattern:
    'Prefix with file + symbol scope. Demand output shape up front (e.g. “JSON only”, “TS signature only”). ' +
    'Paste only the smallest excerpt that contains the bug or API boundary—use truncateForModelReview for large files.',
  antiPatterns: [
    'Mixing MCP transport concerns with React UI state',
    'Using `any` for OHLCV, signals, or backtest configs',
    'Ignoring provider rate limits on live quote / chain endpoints',
    'Pasting entire 1k+ line components when 80 lines suffice',
    'Running heavy backtests on the serverless hot path without bounds',
  ],
  repoSpecificCodeTips: [
    'Validate numeric series with explicit NaN guards before Sharpe / Kelly math',
    'Keep `lib/backtest/*` deterministic: no network inside engine loops',
    'Prefer `response_format: json_object` for structured MCP reviews',
    'After touching `lib/backtest` or `lib/quant`, run `npm run benchmark` locally',
    'Type async signal paths as `AsyncGenerator<Signal>` or explicit result unions',
    'For UI panels, isolate data fetch in hooks and memoize derived quant metrics',
  ],
} as const

/**
 * Shrinks large source for LLM/MCP prompts: head + tail with a clear gap marker.
 * Saves tokens and reduces off-topic edits vs dumping whole files.
 */
export function truncateForModelReview(source: string, maxChars: number): string {
  const s = source.trim()
  if (s.length <= maxChars) return s
  const budget = maxChars - 80
  const head = Math.floor(budget * 0.62)
  const tail = budget - head
  return (
    s.slice(0, head) +
    `\n\n/* … truncated ${s.length - head - tail} chars; jump to tail … */\n\n` +
    s.slice(s.length - tail)
  )
}
