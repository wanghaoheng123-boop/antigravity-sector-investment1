/**
 * Paper portfolio tracker — localStorage MVP.
 * Positions + cash; unrealized PnL uses mark-to-market from live quotes.
 */

export const PORTFOLIO_STORAGE_KEY = 'quantan-portfolio-v1'

export interface PortfolioPosition {
  ticker: string
  shares: number
  avgCost: number
  openedAt: string
}

export interface PortfolioSnapshot {
  cash: number
  positions: PortfolioPosition[]
  updatedAt: string
}

export function defaultSnapshot(): PortfolioSnapshot {
  return { cash: 100_000, positions: [], updatedAt: new Date().toISOString() }
}

export function loadSnapshot(): PortfolioSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortfolioSnapshot
    if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.positions)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSnapshot(s: PortfolioSnapshot): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }))
}

export interface QuoteMap {
  [ticker: string]: { price: number }
}

export function marketValue(positions: PortfolioPosition[], quotes: QuoteMap): number {
  let mv = 0
  for (const p of positions) {
    const px = quotes[p.ticker]?.price
    if (px != null && Number.isFinite(px) && px > 0) mv += p.shares * px
  }
  return mv
}

export function costBasis(positions: PortfolioPosition[]): number {
  return positions.reduce((s, p) => s + p.shares * p.avgCost, 0)
}

export function unrealizedPnl(positions: PortfolioPosition[], quotes: QuoteMap): number {
  let pnl = 0
  for (const p of positions) {
    const px = quotes[p.ticker]?.price
    if (px == null || !Number.isFinite(px)) continue
    pnl += p.shares * (px - p.avgCost)
  }
  return pnl
}

/** Equity = cash + MV(positions). */
export function totalEquity(snapshot: PortfolioSnapshot, quotes: QuoteMap): number {
  return snapshot.cash + marketValue(snapshot.positions, quotes)
}

/**
 * Reconciliation: book equity should match cash + Σ(shares×price).
 * Returns { ok, bookEquity, components, drift }.
 */
export function reconcile(snapshot: PortfolioSnapshot, quotes: QuoteMap, eps = 0.02): {
  ok: boolean
  bookEquity: number
  cash: number
  positionsMv: number
  drift: number
} {
  const positionsMv = marketValue(snapshot.positions, quotes)
  const bookEquity = snapshot.cash + positionsMv
  const implied = snapshot.cash + positionsMv
  const drift = Math.abs(bookEquity - implied)
  return { ok: drift <= eps, bookEquity, cash: snapshot.cash, positionsMv, drift }
}

export function buy(
  snapshot: PortfolioSnapshot,
  ticker: string,
  shares: number,
  price: number,
): { next: PortfolioSnapshot; error?: string } {
  if (shares <= 0 || price <= 0) return { next: snapshot, error: 'Invalid shares or price' }
  const cost = shares * price
  if (cost > snapshot.cash + 1e-6) return { next: snapshot, error: 'Insufficient cash' }
  const upper = ticker.trim().toUpperCase()
  const existing = snapshot.positions.find(p => p.ticker === upper)
  let positions: PortfolioPosition[]
  if (existing) {
    const totalShares = existing.shares + shares
    const newAvg = (existing.shares * existing.avgCost + shares * price) / totalShares
    positions = snapshot.positions.map(p =>
      p.ticker === upper ? { ...p, shares: totalShares, avgCost: newAvg } : p,
    )
  } else {
    positions = [...snapshot.positions, { ticker: upper, shares, avgCost: price, openedAt: new Date().toISOString() }]
  }
  return {
    next: {
      cash: snapshot.cash - cost,
      positions,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function sell(
  snapshot: PortfolioSnapshot,
  ticker: string,
  shares: number,
  price: number,
): { next: PortfolioSnapshot; error?: string } {
  if (shares <= 0 || price <= 0) return { next: snapshot, error: 'Invalid shares or price' }
  const upper = ticker.trim().toUpperCase()
  const existing = snapshot.positions.find(p => p.ticker === upper)
  if (!existing || existing.shares < shares - 1e-9) return { next: snapshot, error: 'Not enough shares' }
  const proceeds = shares * price
  const remaining = existing.shares - shares
  const positions =
    remaining < 1e-9
      ? snapshot.positions.filter(p => p.ticker !== upper)
      : snapshot.positions.map(p => (p.ticker === upper ? { ...p, shares: remaining } : p))
  return {
    next: {
      cash: snapshot.cash + proceeds,
      positions,
      updatedAt: new Date().toISOString(),
    },
  }
}
