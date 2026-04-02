/**
 * Normalize Yahoo quote fields — regularMarketChangePercent is sometimes decimal (0.016) vs percent (1.6).
 */

export function normalizedChangePercent(
  regularMarketChangePercent: number | undefined | null,
  regularMarketChange: number | undefined | null,
  regularMarketPrice: number | undefined | null
): number {
  const raw = regularMarketChangePercent
  if (regularMarketPrice != null && regularMarketPrice > 0 && regularMarketChange != null) {
    const implied = (100 * regularMarketChange) / regularMarketPrice
    if (raw == null || !Number.isFinite(Number(raw))) return implied
    const r = Number(raw)
    if (Math.abs(r) < 0.5 && Math.abs(implied) > 1.5) return implied
    if (Math.abs(r) >= 0.5 || Math.abs(implied) < 0.01) return r
    return Math.abs(r) < 1 && Math.abs(implied) > 5 ? implied : r
  }
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw)
  return 0
}
