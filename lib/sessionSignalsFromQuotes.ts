import { SECTORS, type PriceSignal, type SignalDirection } from '@/lib/sectors'

export type QuoteLike = {
  price: number
  change: number
  changePct: number
  quoteTime?: string | null
}

function sessionDirection(changePct: number): SignalDirection {
  if (changePct > 0.01) return 'BUY'
  if (changePct < -0.01) return 'SELL'
  return 'HOLD'
}

/**
 * One row per sector ETF from Yahoo (or merged) quotes — not a trading model.
 * `direction` reuses BUY/SELL/HOLD only as UI tokens for up/down/flat session vs prior close.
 */
export function buildSessionSignalsFromQuotes(
  quotes: Record<string, QuoteLike>
): PriceSignal[] {
  const ts = new Date().toISOString()
  return SECTORS.map((sector) => {
    const q = quotes[sector.etf]
    const changePct = q?.changePct ?? 0
    const price = q?.price ?? 0
    const direction = sessionDirection(changePct)
    const absM = Math.abs(changePct)
    const confidence = Math.min(98, Math.round(42 + Math.min(40, absM * 14)))
    return {
      sector: sector.name,
      etf: sector.etf,
      direction,
      confidence,
      entry: price,
      stopLoss: price,
      target: price,
      timeframe: '1D',
      rationale: `Yahoo session vs prior close: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%. Last ${
        price > 0 ? `$${price.toFixed(2)}` : '—'
      }. Not investment advice; levels mirror last price only (no modelled entry/stop/target).`,
      timestamp: ts,
      source: 'yahoo-session',
      quoteTime: q?.quoteTime ?? null,
      sessionChangePct: changePct,
    }
  })
}

export function buildSingleSessionSignal(sectorEtf: string, q: QuoteLike | undefined): PriceSignal | null {
  const sector = SECTORS.find((s) => s.etf === sectorEtf)
  if (!sector || !q) return null
  const changePct = q.changePct ?? 0
  const price = q.price ?? 0
  const direction = sessionDirection(changePct)
  const absM = Math.abs(changePct)
  const confidence = Math.min(98, Math.round(42 + Math.min(40, absM * 14)))
  return {
    sector: sector.name,
    etf: sector.etf,
    direction,
    confidence,
    entry: price,
    stopLoss: price,
    target: price,
    timeframe: '1D',
    rationale: `Yahoo session vs prior close: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%. Last ${
      price > 0 ? `$${price.toFixed(2)}` : '—'
    }. Not investment advice; levels mirror last price only.`,
    timestamp: new Date().toISOString(),
    source: 'yahoo-session',
    quoteTime: q.quoteTime ?? null,
    sessionChangePct: changePct,
  }
}
