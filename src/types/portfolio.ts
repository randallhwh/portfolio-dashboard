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
  atr: number | null;
  volumeRatio: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  bbSqueeze: boolean;
  oversold: boolean;
  overbought: boolean;
  suggestedStop: number | null;
  tier1Target: number | null;
  tier2Target: number | null;
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
