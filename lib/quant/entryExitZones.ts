/**
 * Entry / exit *condition bands* — not trading advice or promised prices.
 */

export interface EntryExitZoneBand {
  id: string
  label: string
  lower: number
  upper: number
  note: string
}

export interface EntryExitZonesPayload {
  disclaimer: string
  bands: EntryExitZoneBand[]
}

export function deriveEntryExitZones(input: {
  spot: number
  regimeSma: number | null
  atrPct: number | null
  putWallStrike: number | null
  callWallStrike: number | null
}): EntryExitZonesPayload {
  const disclaimer =
    'Illustrative conditional bands from volatility (ATR), moving-average context, and options structure. ' +
    'They describe historical conditions only — not optimal entry/exit prices or future outcomes.'

  const bands: EntryExitZoneBand[] = []
  const spot = input.spot
  if (!Number.isFinite(spot) || spot <= 0) {
    return { disclaimer, bands: [] }
  }

  const atrf =
    input.atrPct != null && Number.isFinite(input.atrPct) ? Math.min(0.15, Math.max(0.005, input.atrPct / 100)) : 0.02

  bands.push({
    id: 'atr-pullback',
    label: 'ATR-conditioned pullback band',
    lower: spot * (1 - 2.2 * atrf),
    upper: spot * (1 - 0.2 * atrf),
    note: 'Widens with ATR%; descriptive only.',
  })

  if (input.regimeSma != null && Number.isFinite(input.regimeSma)) {
    const dev = (spot - input.regimeSma) / input.regimeSma
    bands.push({
      id: 'sma-deviation',
      label: 'Regime MA neighborhood',
      lower: input.regimeSma * (1 + Math.min(dev, 0) - 0.02),
      upper: input.regimeSma * (1 + Math.max(dev, 0) + 0.02),
      note: 'Centered on regime SMA with small buffer.',
    })
  }

  if (
    input.putWallStrike != null &&
    input.callWallStrike != null &&
    Number.isFinite(input.putWallStrike) &&
    Number.isFinite(input.callWallStrike)
  ) {
    const lo = Math.min(input.putWallStrike, input.callWallStrike)
    const hi = Math.max(input.putWallStrike, input.callWallStrike)
    bands.push({
      id: 'gamma-corridor',
      label: 'Put wall – Call wall corridor (daily snapshot)',
      lower: lo,
      upper: hi,
      note: 'From end-of-day chain metrics; not continuous intraday path.',
    })
  }

  return { disclaimer, bands }
}
