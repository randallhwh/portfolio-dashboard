export type AssetClass = 'stock' | 'bond' | 'cash' | 'etf' | 'crypto' | 'real_estate' | 'commodity' | 'other';

export type Currency = 'USD' | 'CAD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'SGD' | 'HKD' | 'CNY';

// Rate to convert 1 unit of each currency INTO the base currency
export type ExchangeRates = Partial<Record<Currency, number>>;

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgCostPerShare: number;
  currentPrice: number;
  currency: Currency;
  purchaseDate: string; // ISO date string
  account: string;
  sector?: string;
  country?: string;
  notes?: string;
  targetAllocation?: number;
  // Yield: dividend yield % for equities/REITs, interest rate % for cash/bonds
  annualYieldPct?: number;
}

export interface Transaction {
  id: string;
  holdingId: string;
  ticker: string;
  name: string;
  type: 'buy' | 'sell' | 'dividend';
  quantity: number;
  pricePerShare: number;
  commission: number;
  currency: Currency;
  account: string;
  date: string;
  notes?: string;
}

// Input shape for recordTrade — store derives the rest
export interface TradeInput {
  type: 'buy' | 'sell';
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  pricePerShare: number;
  commission: number;
  currency: Currency;
  account: string;
  date: string;
  sector?: string;
  country?: string;
  notes?: string;
  annualYieldPct?: number;
  cashHoldingId?: string;
}

export interface BenchmarkData {
  date: string;
  portfolioValue: number;
  sp500Value: number;
  bondIndexValue: number;
}

export interface BiasAlert {
  id: string;
  type: 'sunk_cost' | 'disposition' | 'loss_aversion' | 'concentration' | 'recency' | 'mental_accounting' | 'overconfidence';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  holdingId?: string;
  actionPrompt: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalRating = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface TechnicalSignals {
  ticker: string;
  computedAt: string;
  barsAvailable: number;
  score: number;
  rating: SignalRating;
  trendScore: number;
  momentumScore: number;
  volatilityScore: number;
  volumeScore: number;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbBandwidth: number | null;
  bbPctB: number | null;       // BB %B: 0 = at lower band, 1 = at upper band
  atr: number | null;
  volumeRatio: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  bbSqueeze: boolean;
  oversold: boolean;
  overbought: boolean;
  suggestedStop: number | null;  // price − 2×ATR (entry-based, for new positions)
  chandelierStop: number | null; // max(close since entry) − 3×ATR(22) — ratcheting trailing stop
  tier1Target: number | null;    // price + 1.5×ATR (replaces fixed +3%)
  tier2Target: number | null;    // price + 3.0×ATR (replaces fixed +6%)
  // Corwin-Schultz spread estimate from daily OHLC (Corwin & Schultz, 2012)
  csSpreadPct: number | null;  // bid-ask spread as %, e.g. 0.08 = 8 bps
  // Alpha decay (Di Mascio, Lines & Naik 2021; Kaminski & Lo 2014)
  signalType: 'momentum' | 'mean_reversion' | 'neutral';
  signalAgeBars: number;       // consecutive bars the current signal has been active
  decayPct: number;            // estimated % of original edge remaining (100 = fresh)
  // Entry guidance
  entryLimit: number | null;   // ideal limit-order entry price (SMA20 pullback / current for oversold)
  entryBreakout: number | null; // breakout entry above this price (BB upper for squeeze plays)
  entryQuality: 'ideal' | 'ok' | 'stretched' | 'avoid'; // how extended price is from ideal entry
  entryNote: string;           // plain-English rationale for the entry recommendation
  // Tier 1: George & Hwang (2004) 52-week high ratio
  pth52wk: number | null;      // price / 6M high (52wk high proxy); 1.0 = at high
  isNew52wkHigh: boolean;      // price within 0.5% of 6M high
  // Tier 2: Chaikin Money Flow (accumulation/distribution)
  cmf20: number | null;        // CMF(20): >0.1 accumulation, <−0.1 distribution
  // Tier 2: Time-Series Momentum gate (Moskowitz, Ooi & Pedersen 2012)
  tsmomBullish: boolean;       // 6M total return > 0; gates momentum sub-scores
  // Tier 2: Intrastock volatility regime
  rv21d: number | null;        // 21-day realized vol, annualized
  intraVolRegime: 'low' | 'normal' | 'high'; // modulates sub-score weights
  // Tier 3: Market sensitivity
  betaVsSpy: number | null;    // 60-day rolling beta vs SPY
  // Tier 3: Earnings proximity
  daysToEarnings: number | null; // calendar days to next earnings (negative = past)
  nearEarnings: boolean;         // within 7 calendar days of earnings event
  // Tier 3: ML feature vector (normalized indicators for offline model training)
  featureVector: number[];
  // Flame indicator (composite: price momentum + volume demand/supply)
  flameWeekly: number | null;   // 10-bar rolling mean of Flame_raw — fast signal
  flameMonthly: number | null;  // 60-bar rolling mean of Flame_raw — slow trend
  flameHistory: { date: string; flameWeekly: number | null; flameMonthly: number | null }[];
}

export interface WatchlistEntry {
  ticker: string;
  name: string;
  currency: Currency;
  currentPrice: number;
  addedAt: string;
}

export interface PortfolioSettings {
  baseCurrency: Currency;
  showCostBasis: boolean; // "cost blindfold" toggle
  neutralColorMode: boolean; // replace red/green with blue/amber
  benchmarkTicker: string;
  targetAllocations: Record<AssetClass, number>;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  marketRegime?: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'RECESSION' | 'RISK_OFF_SPIKE';
}
