/**
 * Research Team Definition
 * Shared across API routes and UI components
 */

export type AgentSpecialty = 'quant' | 'options' | 'market_microstructure' | 'backtest' | 'data_science'

export interface ResearchAgent {
  id: string
  name: string
  title: string
  specialty: AgentSpecialty
  focus: string[]
  methods: string[]
  color: string
  emoji: string
  bio: string
}

export const RESEARCH_TEAM: ResearchAgent[] = [
  {
    id: 'q1',
    name: 'Dr. Sarah Chen',
    title: 'Quantitative Strategist',
    specialty: 'quant',
    focus: [
      'Price floor/ceiling detection algorithms',
      'Kelly Criterion dynamic position sizing',
      '200EMA regime classification and regime-specific backtesting',
      'VWAP deviation band analysis',
    ],
    methods: [
      'Volume-Weighted Support/Resistance (VWSR)',
      'Institutional Order Block detection',
      'Kelly Criterion with Half-Kelly capping',
      'Regime-based signal weighting',
    ],
    color: '#3b82f6',
    emoji: '📊',
    bio: 'PhD in Financial Mathematics from MIT. 12 years at Bridgewater Associates working on multi-asset macro strategies. Specializes in regime detection and risk-managed position sizing.',
  },
  {
    id: 'q2',
    name: 'Marcus Webb',
    title: 'Options & Volatility Strategist',
    specialty: 'options',
    focus: [
      'Gamma Exposure (GEX) and dealer hedging dynamics',
      'Vanna and Charm decomposition',
      'Call/Put wall identification and max pain',
      'Implied volatility surface analysis',
    ],
    methods: [
      'Gamma Exposure per strike from OI-weighted options chain',
      'Vanna = dDelta/dVol decomposition',
      'Charm = dDelta/dTime decomposition',
      'Cumulative OI wall analysis',
    ],
    color: '#a855f7',
    emoji: '📉',
    bio: 'Former volatility arbitrage trader at Citadel Securities. Built gamma scalping desks and worked on institutional options flow analysis. Expert in volatility surface dynamics and dealer hedging models.',
  },
  {
    id: 'q3',
    name: 'Elena Rodriguez',
    title: 'Market Microstructure Analyst',
    specialty: 'market_microstructure',
    focus: [
      'Market maker hedging behavior and reverse-engineering',
      'Cumulative delta and money flow analysis',
      'Order flow imbalance and bid-ask dynamics',
      'Dark pool and block trade detection',
    ],
    methods: [
      'Tick-rule delta approximation from OHLCV',
      'Market maker hedging pressure from options gamma',
      'Order imbalance from bid/ask size ratios',
      'Volume at price clustering for support/resistance',
    ],
    color: '#22d3ee',
    emoji: '🔍',
    bio: 'Ex-Goldman Sachs electronic trading desk. Specialist in HFT market microstructure and order flow analysis. Published research on dark pool internalization patterns.',
  },
  {
    id: 'q4',
    name: 'Dr. James Park',
    title: 'Quantitative Developer & Backtest Engineer',
    specialty: 'backtest',
    focus: [
      'Walk-forward analysis with proper IS/OOS separation',
      'Overfitting detection and Sharpe stability analysis',
      'Transaction cost modeling and slippage estimation',
      'Regime-specific strategy performance attribution',
    ],
    methods: [
      'Rolling window walk-forward with 75/25 IS/OOS split',
      'Coefficient of variation of rolling Sharpe ratio',
      'Per-instrument transaction cost tiering',
      'Bootstrap confidence intervals for performance metrics',
    ],
    color: '#f59e0b',
    emoji: '🔧',
    bio: 'PhD in Computational Finance. Previously built quant infrastructure at Two Sigma. Expert in backtesting methodology and avoiding common statistical pitfalls in strategy evaluation.',
  },
  {
    id: 'q5',
    name: 'Aisha Patel',
    title: 'Data Scientist',
    specialty: 'data_science',
    focus: [
      'Data quality verification and anomaly detection',
      'Signal correlation and redundancy analysis',
      'Cross-source data validation',
      'Confidence scoring for derived metrics',
    ],
    methods: [
      'Z-score anomaly detection on price/volume data',
      'Pearson/Spearman correlation matrices',
      'Source attribution and data provenance tracking',
      'Cross-validation against multiple data providers',
    ],
    color: '#10b981',
    emoji: '🧪',
    bio: 'Former data science lead at a hedge fund. Builds data quality frameworks and signal validation pipelines. Expert in detecting data artifacts and ensuring measurement integrity.',
  },
]
