// ─── QUANTAN Design Tokens ────────────────────────────────────────────────────
// Centralized design system: colors, spacing, typography, shadows, motion.
// Use these tokens in components instead of hardcoded Tailwind values where possible.
// Platform aim: institutional-grade quantitative trading intelligence.
// Aesthetic: dark, dense, information-rich — Bloomberg terminal meets modern fintech.

// ─── Semantic color scales ────────────────────────────────────────────────────
// Profit/loss/neutral scales map to P&L coloring across the app.
// Zone scales map to regime labels (HEALTHY_BULL, WEAK_BULL, CHOP, WEAK_BEAR, STRONG_BEAR).

export const colors = {
  // Background layers (darkest → lightest)
  bg: {
    base:     'bg-slate-950',        // page background
    surface:  'bg-slate-900',        // card surface
    raised:   'bg-slate-900/60',     // subtle elevation w/ backdrop
    overlay:  'bg-slate-800/60',     // hover states, selected rows
    tooltip:  'bg-slate-800',        // tooltips, popovers
  },

  // Border layers
  border: {
    subtle:   'border-slate-800/60',
    default:  'border-slate-700',
    strong:   'border-slate-600',
    focus:    'border-blue-500',
  },

  // Text scale
  text: {
    primary:   'text-white',
    secondary: 'text-slate-300',
    tertiary:  'text-slate-400',
    muted:     'text-slate-500',
    disabled:  'text-slate-600',
  },

  // Semantic — P&L
  pnl: {
    profitText: 'text-emerald-400',
    profitBg:   'bg-emerald-500/10',
    profitBorder: 'border-emerald-500/30',
    lossText:   'text-rose-400',
    lossBg:     'bg-rose-500/10',
    lossBorder: 'border-rose-500/30',
    neutralText: 'text-slate-400',
  },

  // Semantic — status
  status: {
    success:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    warning:  'text-amber-400 bg-amber-500/10 border-amber-500/30',
    danger:   'text-rose-400 bg-rose-500/10 border-rose-500/30',
    info:     'text-sky-400 bg-sky-500/10 border-sky-500/30',
    neutral:  'text-slate-400 bg-slate-500/10 border-slate-500/30',
  },

  // Zone / regime labels — map regime.label to token
  zone: {
    HEALTHY_BULL:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    WEAK_BULL:     'text-lime-400 bg-lime-500/10 border-lime-500/30',
    CHOP:          'text-amber-400 bg-amber-500/10 border-amber-500/30',
    WEAK_BEAR:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
    STRONG_BEAR:   'text-rose-400 bg-rose-500/10 border-rose-500/30',
  } as const,

  // Conviction grades (A/B/C/D) from institutional ranking
  conviction: {
    A: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
    B: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    D: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  } as const,

  // Brand accent
  accent: {
    primary:     'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
    primaryText: 'text-blue-400',
    muted:       'bg-blue-500/10 border-blue-500/30 text-blue-300',
  },
} as const

// ─── Spacing scale ────────────────────────────────────────────────────────────
export const spacing = {
  tight:   'gap-1',    // dense inline (badges, icons)
  snug:    'gap-2',    // related items
  normal:  'gap-3',    // default
  loose:   'gap-4',    // section separation
  wide:    'gap-6',    // major sections
} as const

// ─── Radius scale ─────────────────────────────────────────────────────────────
export const radius = {
  sm:   'rounded-sm',
  md:   'rounded-md',
  lg:   'rounded-lg',
  xl:   'rounded-xl',
  full: 'rounded-full',
} as const

// ─── Typography scale ─────────────────────────────────────────────────────────
export const text = {
  // Display
  h1:    'text-2xl font-bold tracking-tight',
  h2:    'text-xl font-semibold tracking-tight',
  h3:    'text-lg font-semibold',
  h4:    'text-base font-semibold',

  // Body
  body:  'text-sm',
  small: 'text-xs',
  micro: 'text-[11px]',
  nano:  'text-[10px]',

  // Numeric (tabular) — for prices, ratios, percentages
  numeric:      'font-mono tabular-nums',
  numericLarge: 'font-mono tabular-nums text-lg font-semibold',
  numericHero:  'font-mono tabular-nums text-3xl font-bold tracking-tight',
} as const

// ─── Shadow / elevation ───────────────────────────────────────────────────────
export const shadow = {
  none:  '',
  sm:    'shadow-sm shadow-black/20',
  md:    'shadow-md shadow-black/30',
  lg:    'shadow-lg shadow-black/40',
  glow:  'shadow-lg shadow-blue-500/10',
} as const

// ─── Motion ───────────────────────────────────────────────────────────────────
export const motion = {
  fast:   'transition-colors duration-150',
  normal: 'transition-all duration-200',
  slow:   'transition-all duration-300',
} as const

// ─── Helper: semantic P&L color by value ─────────────────────────────────────

export function pnlClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) return colors.pnl.neutralText
  if (value > 0) return colors.pnl.profitText
  if (value < 0) return colors.pnl.lossText
  return colors.pnl.neutralText
}

export function pnlBgClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) return ''
  if (value > 0) return `${colors.pnl.profitBg} ${colors.pnl.profitBorder}`
  if (value < 0) return `${colors.pnl.lossBg} ${colors.pnl.lossBorder}`
  return ''
}

// ─── Helper: zone badge class by regime label ────────────────────────────────

export function zoneClass(label: string | null | undefined): string {
  if (!label) return colors.status.neutral
  const key = label as keyof typeof colors.zone
  return colors.zone[key] ?? colors.status.neutral
}

// ─── Helper: conviction badge class ──────────────────────────────────────────

export function convictionClass(grade: string | null | undefined): string {
  if (!grade) return colors.status.neutral
  const key = grade.toUpperCase() as keyof typeof colors.conviction
  return colors.conviction[key] ?? colors.status.neutral
}
