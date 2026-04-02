/** Yahoo Finance symbol normalization for API routes. */
export function yahooSymbolFromParam(raw: string): string {
  const u = raw.trim().toUpperCase()
  if (u === 'VIX' || u === '^VIX') return '^VIX'
  return u
}
