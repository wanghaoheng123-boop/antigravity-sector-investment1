/**
 * Investment *framework* themes aligned with the QUANTAN Codex pillars.
 * These are educational checklists — not personalized advice and not attributed quotations.
 */

export interface FrameworkPillar {
  id: string
  title: string
  themes: string[]
  checklist: string[]
}

export const CODEX_FRAMEWORKS: FrameworkPillar[] = [
  {
    id: 'probabilistic',
    title: 'Probabilistic & EV (Thorp / Mauboussin-style)',
    themes: [
      'Treat each idea as expected value, not a story.',
      'Prefer the outside view / base rates over inside-view optimism.',
    ],
    checklist: [
      'Can you state win probability, payoff, and loss in the same units?',
      'What reference class of past outcomes most resembles this setup?',
      'Is position size consistent with edge and risk of ruin (Kelly thinking)?',
    ],
  },
  {
    id: 'quality',
    title: 'Quality & capital allocation (Buffett / Munger-style)',
    themes: [
      'Cash flows and ROIC persistence matter more than narrative.',
      'Margin of safety: buy below a conservative intrinsic band.',
    ],
    checklist: [
      'Is ROIC plausibly above cost of capital through a cycle?',
      'Is the moat structural (scale, regulation, network) vs. temporary?',
      'What would make this a permanent value trap (Klarman-style caution)?',
    ],
  },
  {
    id: 'macro',
    title: 'Liquidity & balance-sheet recessions (Druckenmiller / Koo-style)',
    themes: [
      'Broad risk assets often track liquidity; earnings drive relative winners.',
      'When the private sector deleverages, rate cuts may not revive demand.',
    ],
    checklist: [
      'Does the macro regime support credit expansion for this sector?',
      'Is this name a “liquid piggy bank” casualty in a margin-call spiral?',
    ],
  },
  {
    id: 'convexity',
    title: 'Tail risk & barbell (Taleb / Spitznagel-style)',
    themes: [
      'Gaussian risk models understate joint crashes; plan for fat tails.',
      'Convex hedges can protect geometric compounding.',
    ],
    checklist: [
      'What happens to this thesis in a correlation → 1.0 panic?',
      'Is downside convex or are you short volatility in disguise?',
    ],
  },
  {
    id: 'technology',
    title: 'Power laws & deployment cycles (Thiel / Perez-style)',
    themes: [
      'Technology waves have installation vs. deployment phases.',
      'Returns concentrate in a few winners; avoid false diversification.',
    ],
    checklist: [
      'Is the company in frenzy or deployment — and does valuation match?',
      'Is growth priced as if certainty when outcomes are power-law?',
    ],
  },
  {
    id: 'narrative',
    title: 'Narrative & reflexivity (Shiller / Soros-style)',
    themes: [
      'Stories drive flows; map when contagion may peak or break.',
      'Strong views, weakly held: update when the market disproves timing.',
    ],
    checklist: [
      'What narrative is priced in vs. underappreciated?',
      'What observable would make you invalidate the thesis quickly?',
    ],
  },
  {
    id: 'physical',
    title: 'Physical constraints (Smil / complexity-style)',
    themes: [
      'Software scales fast; atoms (energy, copper, logistics) move slowly.',
      'Increasing-returns businesses can lock in — or face regulatory backlash.',
    ],
    checklist: [
      'Where are physical bottlenecks in the value chain?',
      'Does the business rely on cheap energy / inputs that could reprice?',
    ],
  },
]
