/** Canonical symbols for watchlist / API consistency (Yahoo-style). */
export function normalizeTicker(ticker: string): string {
  const s = ticker.trim().toUpperCase()
  if (s === 'VIX' || s === '^VIX') return '^VIX'
  return s
}
