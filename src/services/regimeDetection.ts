// Multi-asset market regime detection framework
// Framework 1: Bridgewater Growth/Inflation quadrant
// Framework 2: Business Cycle Clock (rate-of-change acceleration)
// Framework 3: Volatility Regime (VIX + bond vol)
// Framework 4: Liquidity Regime (rates, credit, USD)
// Framework 5: Credit Cycle (HY vs IG quality spread)
// Leading Indicators: 10-signal transition risk score

export const REGIME_TICKERS = [
  // Core cross-asset indicators
  '^VIX',  // CBOE Volatility
  '^TNX',  // 10-Year Treasury yield
  '^IRX',  // 3-Month T-Bill yield
  'TLT',   // 20Y+ Treasury ETF
  'TIP',   // TIPS ETF (inflation expectations)
  'GLD',   // Gold ETF
  'GSG',   // GSCI Commodity ETF
  'HYG',   // High Yield Bond ETF
  'SPY',   // S&P 500 ETF
  'UUP',   // US Dollar Bullish ETF
  // Extended indicators
  'IWM',   // Russell 2000 (small cap breadth)
  'LQD',   // IG Corporate Bond ETF (credit quality)
  'XLU',   // Utilities ETF (defensive rotation signal)
  'XLK',   // Technology ETF (risk-on rotation signal)
  'EEM',   // Emerging Markets ETF (global growth)
  'SHY',   // 1-3Y Treasury ETF (short-duration, curve shape)
  'CPER',  // Copper ETF (industrial demand / growth proxy)
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegimeName =
  | 'GOLDILOCKS'
  | 'REFLATION'
  | 'STAGFLATION'
  | 'RECESSION'
  | 'RISK_OFF_SPIKE'
  | 'UNKNOWN';

export type BusinessCycleName = 'RECOVERY' | 'EXPANSION' | 'SLOWDOWN' | 'CONTRACTION' | 'UNKNOWN';
export type VolatilityLevel   = 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRISIS';
export type LiquidityLevel    = 'AMPLE' | 'NEUTRAL' | 'TIGHTENING' | 'STRESS';
export type CreditCyclePhase  = 'EXPANSION' | 'STABLE' | 'WIDENING' | 'STRESS';
export type TransitionRiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';

export interface SignalDetail {
  name: string;
  ticker: string;
  value: string;
  direction: 'positive' | 'negative' | 'neutral';
  contribution: number;
  axis: 'growth' | 'inflation' | 'volatility';
  description: string;
}

export interface RegimeResult {
  regime: RegimeName;
  confidence: number;
  growthScore: number;
  inflationScore: number;
  vixLevel: number;
  signals: SignalDetail[];
  dataAge: 'fresh' | 'stale';
}

export interface BusinessCycleResult {
  phase: BusinessCycleName;
  growthMomentum: number;
  inflationMomentum: number;
  description: string;
  recommendation: string;
}

export interface VolatilityResult {
  level: VolatilityLevel;
  vix: number;
  vix20dAvg: number;
  vixTrend: 'rising' | 'falling' | 'stable';
  bondVolProxy: number;
  description: string;
}

export interface LiquidityResult {
  level: LiquidityLevel;
  score: number;
  signals: string[];
  description: string;
}

export interface CreditCycleResult {
  phase: CreditCyclePhase;
  qualitySpread1M: number;
  spreadTrend: 'improving' | 'stable' | 'deteriorating';
  description: string;
}

export interface LeadingSignal {
  name: string;
  tickers: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
  implication: string;
  timeHorizon: '1-4 weeks' | '1-3 months' | '3-6 months';
}

export interface TransitionRiskResult {
  level: TransitionRiskLevel;
  score: number;
  signals: LeadingSignal[];
  mostLikelyNextRegime: RegimeName | null;
  description: string;
}

export interface FullRegimeAnalysis {
  bridgewater: RegimeResult;
  businessCycle: BusinessCycleResult;
  volatility: VolatilityResult;
  liquidity: LiquidityResult;
  creditCycle: CreditCycleResult;
  transitionRisk: TransitionRiskResult;
  consensus: {
    riskBias: 'risk-on' | 'balanced' | 'risk-off';
    conviction: number;
    summary: string;
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

interface FrameworkMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  recommendation: string;
}

export const BUSINESS_CYCLE_META: Record<BusinessCycleName, FrameworkMeta> = {
  RECOVERY: {
    label: 'Recovery',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Growth beginning to re-accelerate from trough; inflation still decelerating. Leading indicators turning up. Credit conditions improving from stressed levels.',
    recommendation: 'Early-cycle leaders outperform: Financials, Industrials, Consumer Discretionary. Add risk exposure.',
  },
  EXPANSION: {
    label: 'Expansion',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Both growth and inflation accelerating. Broad equity participation across sectors. Credit conditions easy, earnings revisions positive.',
    recommendation: 'Mid-cycle: Technology, Materials, Energy in favour. Deploy remaining cash into risk assets.',
  },
  SLOWDOWN: {
    label: 'Slowdown',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Growth decelerating from peak while inflation remains elevated. Margin pressure building. Late-cycle characteristics; breadth narrowing.',
    recommendation: 'Rotate toward defensives: Healthcare, Utilities, Staples. Shorten credit duration. Reduce cyclical exposure.',
  },
  CONTRACTION: {
    label: 'Contraction',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: 'Both growth and inflation decelerating. Recessionary pressure building. Earnings revisions sharply negative. Credit conditions tightening.',
    recommendation: 'Capital preservation mode: bonds, cash, gold. Minimum equity exposure — wait for leading indicators to turn.',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800/60',
    borderColor: 'border-slate-700/50',
    description: 'Insufficient momentum data to classify the business cycle phase.',
    recommendation: 'Maintain balanced allocation pending more data.',
  },
};

export const VOLATILITY_META: Record<VolatilityLevel, { label: string; color: string; bgColor: string; borderColor: string }> = {
  LOW:      { label: 'Low',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  NORMAL:   { label: 'Normal',   color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30'    },
  ELEVATED: { label: 'Elevated', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30'   },
  HIGH:     { label: 'High',     color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  borderColor: 'border-orange-500/30'  },
  CRISIS:   { label: 'Crisis',   color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30'     },
};

export const LIQUIDITY_META: Record<LiquidityLevel, { label: string; color: string; bgColor: string; borderColor: string }> = {
  AMPLE:      { label: 'Ample',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  NEUTRAL:    { label: 'Neutral',    color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30'    },
  TIGHTENING: { label: 'Tightening', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30'   },
  STRESS:     { label: 'Stress',     color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30'     },
};

export const CREDIT_CYCLE_META: Record<CreditCyclePhase, { label: string; color: string; bgColor: string; borderColor: string }> = {
  EXPANSION: { label: 'Expansion', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  STABLE:    { label: 'Stable',    color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30'    },
  WIDENING:  { label: 'Widening',  color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30'   },
  STRESS:    { label: 'Stress',    color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30'     },
};

export const TRANSITION_RISK_META: Record<TransitionRiskLevel, { label: string; color: string; bgColor: string; borderColor: string; barColor: string }> = {
  LOW:      { label: 'Low',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', barColor: '#10b981' },
  MODERATE: { label: 'Moderate', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30',    barColor: '#3b82f6' },
  ELEVATED: { label: 'Elevated', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   barColor: '#f59e0b' },
  HIGH:     { label: 'High',     color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30',     barColor: '#ef4444' },
};

// ── Regime metadata (Framework 1) ─────────────────────────────────────────────

export interface RegimeMeta {
  label: string;
  tagline: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  targets: { stock: number; bond: number; cash: number; real_estate: number; commodity: number };
}

export const REGIME_META: Record<RegimeName, RegimeMeta> = {
  GOLDILOCKS: {
    label: 'Goldilocks',
    tagline: 'Growth ↑ · Inflation ↓',
    description: 'The sweet spot — risk assets thrive. Equities and REITs deliver their strongest real returns. Bonds offer modest but positive contribution. Stay invested and let compounding work.',
    color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30',
    targets: { stock: 60, bond: 15, cash: 5, real_estate: 15, commodity: 5 },
  },
  REFLATION: {
    label: 'Reflation',
    tagline: 'Growth ↑ · Inflation ↑',
    description: 'Late-cycle overheating. Equities still positive but gains narrow; cyclicals and commodities outperform. Reduce long-duration bonds — rising yields hurt prices. Inflation hedges earn their keep.',
    color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30',
    targets: { stock: 50, bond: 5, cash: 15, real_estate: 10, commodity: 20 },
  },
  STAGFLATION: {
    label: 'Stagflation',
    tagline: 'Growth ↓ · Inflation ↑',
    description: 'The most hostile macro environment. Equities suffer real losses; bonds also negative in real terms. Preserve capital in short-duration instruments and cash. Minimize risk, be patient.',
    color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30',
    targets: { stock: 20, bond: 15, cash: 45, real_estate: 5, commodity: 15 },
  },
  RECESSION: {
    label: 'Recession',
    tagline: 'Growth ↓ · Inflation ↓',
    description: 'Deflation / contraction. Long-duration bonds are the standout performer. Gold benefits from safe-haven demand. Equities underperform — rotate to defensives.',
    color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30',
    targets: { stock: 20, bond: 40, cash: 25, real_estate: 5, commodity: 10 },
  },
  RISK_OFF_SPIKE: {
    label: 'Risk-Off Spike',
    tagline: 'VIX > 30 · Acute Crisis',
    description: 'Acute fear event — VIX override active. Preserve capital above all else. Do not panic-sell into the drawdown; move to cash and quality bonds.',
    color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30',
    targets: { stock: 15, bond: 30, cash: 45, real_estate: 0, commodity: 10 },
  },
  UNKNOWN: {
    label: 'Unknown',
    tagline: 'Insufficient data',
    description: 'Not enough price history to classify the regime. Fetch regime data to run the detection framework.',
    color: 'text-slate-400', bgColor: 'bg-slate-800/60', borderColor: 'border-slate-700/50',
    targets: { stock: 50, bond: 20, cash: 20, real_estate: 5, commodity: 5 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function last(arr: number[]): number { return arr[arr.length - 1] ?? 0; }

function nDayReturn(prices: number[], n: number): number {
  if (prices.length < n + 1) return 0;
  const curr = prices[prices.length - 1];
  const prev = prices[prices.length - 1 - n];
  return prev ? (curr - prev) / prev : 0;
}

function sma(prices: number[], window: number): number {
  const w  = Math.min(window, prices.length);
  const sl = prices.slice(-w);
  return sl.reduce((a, b) => a + b, 0) / sl.length;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function realizedVol(prices: number[], days: number): number {
  const sl = prices.slice(-(days + 1));
  if (sl.length < 3) return 0;
  const returns = sl.slice(1).map((p, i) => Math.log(p / (sl[i] || 1)));
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252) * 100;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchHistory(ticker: string): Promise<number[]> {
  try {
    // 6mo matches the working stock-price fetcher; ~126 trading days is enough for all signals
    const url = `/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[regime] ${ticker}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      console.warn(`[regime] ${ticker}: no chart result`);
      return [];
    }
    const closes: (number | null)[] =
      result?.indicators?.adjclose?.[0]?.adjclose ??
      result?.indicators?.quote?.[0]?.close ?? [];
    let lastVal = 0;
    const filled = closes.map(c => {
      if (c != null && c > 0) lastVal = c;
      return lastVal;
    });
    const out = filled.filter(c => c > 0);
    if (out.length === 0) console.warn(`[regime] ${ticker}: empty series`);
    return out;
  } catch (e) {
    console.warn(`[regime] ${ticker}: exception`, e);
    return [];
  }
}

export async function fetchAllIndicators(): Promise<Record<string, number[]>> {
  const results = await Promise.allSettled(
    REGIME_TICKERS.map(async t => ({ ticker: t, prices: await fetchHistory(t) }))
  );
  const out: Record<string, number[]> = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') out[r.value.ticker] = r.value.prices;
  });
  return out;
}

// ── Framework 1: Bridgewater Growth / Inflation Quadrant ─────────────────────

function computeBridgewater(indicators: Record<string, number[]>): RegimeResult {
  const spy = indicators['SPY']  ?? [];
  const vix = indicators['^VIX'] ?? [];
  const tnx = indicators['^TNX'] ?? [];
  const irx = indicators['^IRX'] ?? [];
  const tlt = indicators['TLT']  ?? [];
  const tip = indicators['TIP']  ?? [];
  const gld = indicators['GLD']  ?? [];
  const gsg = indicators['GSG']  ?? [];
  const hyg = indicators['HYG']  ?? [];
  const uup = indicators['UUP']  ?? [];

  const minLen = Math.min(spy.length, tlt.length, tip.length);
  const dataAge: 'fresh' | 'stale' = minLen >= 60 ? 'fresh' : 'stale';
  const signals: SignalDetail[] = [];
  const vixNow = last(vix);

  // VIX crisis override
  if (vixNow > 30) {
    signals.push({
      name: 'Market Panic (VIX)', ticker: '^VIX',
      value: vixNow.toFixed(1), direction: 'negative', contribution: 0, axis: 'volatility',
      description: `VIX at ${vixNow.toFixed(1)} — acute fear event; risk-off override active`,
    });
    const confidence = Math.min(0.95, 0.70 + (vixNow - 30) / 100);
    return { regime: 'RISK_OFF_SPIKE', confidence, growthScore: 0, inflationScore: 0, vixLevel: vixNow, signals, dataAge };
  }

  // G1: SPY vs 126-day SMA
  const smaWindow = Math.min(126, spy.length - 1);
  const spy126    = sma(spy, smaWindow);
  const spyNow    = last(spy);
  const spyAbove  = spyNow > spy126;
  const g1        = spyAbove ? 2 : -2;
  signals.push({
    name: 'S&P 500 Trend', ticker: 'SPY',
    value: `${spyAbove ? 'Above' : 'Below'} ${smaWindow}d MA`,
    direction: spyAbove ? 'positive' : 'negative', contribution: g1, axis: 'growth',
    description: spyAbove
      ? 'Equities in uptrend — growth regime positive'
      : 'Equities below long-term trend — growth regime negative',
  });

  // G2: Yield curve (10Y − 3M)
  const tnxNow    = last(tnx);
  const irxNow    = last(irx);
  const yldSpread = tnxNow - irxNow;
  const g2        = yldSpread < -0.5 ? -2 : yldSpread > 1.0 ? 1 : 0;
  signals.push({
    name: 'Yield Curve (10Y − 3M)', ticker: '^TNX / ^IRX',
    value: `${yldSpread >= 0 ? '+' : ''}${yldSpread.toFixed(2)}%`,
    direction: yldSpread < -0.5 ? 'negative' : yldSpread > 1.0 ? 'positive' : 'neutral',
    contribution: g2, axis: 'growth',
    description: yldSpread < -0.5
      ? 'Inverted curve — historically precedes recessions by 6–18 months'
      : yldSpread > 1.0 ? 'Steep curve — growth expanding' : 'Flat curve — transitional',
  });

  // G3: TLT 1-month return
  const tlt1M = nDayReturn(tlt, 21);
  const g3    = tlt1M > 0.03 ? -1 : tlt1M < -0.02 ? 1 : 0;
  signals.push({
    name: 'Treasury Bonds', ticker: 'TLT',
    value: `${(tlt1M * 100).toFixed(1)}% (1M)`,
    direction: tlt1M > 0.03 ? 'negative' : tlt1M < -0.02 ? 'positive' : 'neutral',
    contribution: g3, axis: 'growth',
    description: tlt1M > 0.03
      ? 'Bond rally — market pricing in growth slowdown'
      : tlt1M < -0.02 ? 'Bond selloff — growth/inflation expectations rising' : 'Bonds flat',
  });

  // G4: HYG vs TLT credit spread
  const hyg1M       = nDayReturn(hyg, 21);
  const tlt1M_hyg   = nDayReturn(tlt, 21);
  const creditSpd   = hyg1M - tlt1M_hyg;
  const g4          = creditSpd > 0.02 ? 1 : creditSpd < -0.02 ? -1 : 0;
  signals.push({
    name: 'Credit Appetite', ticker: 'HYG vs TLT',
    value: `HYG ${creditSpd >= 0 ? '+' : ''}${(creditSpd * 100).toFixed(1)}% vs TLT`,
    direction: creditSpd > 0.02 ? 'positive' : creditSpd < -0.02 ? 'negative' : 'neutral',
    contribution: g4, axis: 'growth',
    description: creditSpd > 0.02
      ? 'High yield outperforming — credit market risk-on'
      : creditSpd < -0.02 ? 'Flight to quality — credit stress rising' : 'Credit appetite neutral',
  });

  const growthScore = clamp(g1 + g2 + g3 + g4, -4, 4);

  // I1: TIP vs TLT 3-month return spread
  const tip3M    = nDayReturn(tip, 63);
  const tlt3M    = nDayReturn(tlt, 63);
  const tipVsTlt = tip3M - tlt3M;
  const i1       = tipVsTlt > 0.02 ? 2 : tipVsTlt < -0.02 ? -2 : tipVsTlt > 0.005 ? 1 : tipVsTlt < -0.005 ? -1 : 0;
  signals.push({
    name: 'Inflation Expectations', ticker: 'TIP vs TLT',
    value: `TIP ${tipVsTlt >= 0 ? '+' : ''}${(tipVsTlt * 100).toFixed(1)}% vs TLT (3M)`,
    direction: tipVsTlt > 0.005 ? 'negative' : tipVsTlt < -0.005 ? 'positive' : 'neutral',
    contribution: i1, axis: 'inflation',
    description: tipVsTlt > 0.02
      ? 'TIPS outperforming — breakeven inflation rising sharply'
      : tipVsTlt < -0.02 ? 'Breakeven inflation falling — disinflationary' : 'Inflation expectations stable',
  });

  // I2: GSG commodity 3-month momentum
  const gsg3M = nDayReturn(gsg, 63);
  const i2    = gsg3M > 0.05 ? 2 : gsg3M > 0.01 ? 1 : gsg3M < -0.05 ? -1 : 0;
  signals.push({
    name: 'Commodities', ticker: 'GSG',
    value: `${(gsg3M * 100).toFixed(1)}% (3M)`,
    direction: gsg3M > 0.01 ? 'negative' : gsg3M < -0.05 ? 'positive' : 'neutral',
    contribution: i2, axis: 'inflation',
    description: gsg3M > 0.05
      ? 'Strong commodity boom — significant inflation pressure'
      : gsg3M > 0.01 ? 'Commodity strength — moderate inflation'
      : gsg3M < -0.05 ? 'Commodity bust — deflationary' : 'Commodities neutral',
  });

  // I3: Gold (rising with equities = inflation signal)
  const gld1M = nDayReturn(gld, 21);
  const spy1M = nDayReturn(spy, 21);
  const i3    = gld1M > 0.03 && spy1M > 0 ? 1 : 0;
  signals.push({
    name: 'Gold', ticker: 'GLD',
    value: `${(gld1M * 100).toFixed(1)}% (1M)`,
    direction: gld1M > 0.03 ? (spy1M > 0 ? 'negative' : 'neutral') : 'neutral',
    contribution: i3, axis: 'inflation',
    description: gld1M > 0.03 && spy1M > 0
      ? 'Gold rising alongside equities — inflation regime signal'
      : gld1M > 0.03 ? 'Gold rising with equity weakness — safe haven (not inflation)' : 'Gold neutral',
  });

  // I4: USD 3-month return
  const uup3M = nDayReturn(uup, 63);
  const i4    = uup3M > 0.03 ? -1 : uup3M < -0.03 ? 1 : 0;
  signals.push({
    name: 'US Dollar', ticker: 'UUP',
    value: `${(uup3M * 100).toFixed(1)}% (3M)`,
    direction: uup3M > 0.03 ? 'positive' : uup3M < -0.03 ? 'negative' : 'neutral',
    contribution: i4, axis: 'inflation',
    description: uup3M > 0.03
      ? 'USD strengthening — deflationary global impulse, EM headwinds'
      : uup3M < -0.03 ? 'USD weakening — inflationary, commodity supportive' : 'USD flat',
  });

  const inflationScore = clamp(i1 + i2 + i3 + i4, -3, 3);

  signals.push({
    name: 'Market Volatility', ticker: '^VIX',
    value: vixNow.toFixed(1),
    direction: vixNow < 15 ? 'positive' : vixNow > 25 ? 'negative' : 'neutral',
    contribution: 0, axis: 'volatility',
    description: vixNow < 15
      ? 'Low fear — calm, risk-on environment'
      : vixNow > 25 ? 'Elevated fear — caution' : 'Normal volatility',
  });

  const growthUp    = growthScore > 0;
  const inflationUp = inflationScore > 0;
  let regime: RegimeName;
  if      ( growthUp && !inflationUp) regime = 'GOLDILOCKS';
  else if ( growthUp &&  inflationUp) regime = 'REFLATION';
  else if (!growthUp &&  inflationUp) regime = 'STAGFLATION';
  else                                regime = 'RECESSION';

  const growthConf    = Math.abs(growthScore) / 4;
  const inflationConf = Math.abs(inflationScore) / 3;
  const confidence    = 0.40 + (growthConf * 0.6 + inflationConf * 0.4) * 0.55;

  return { regime, confidence, growthScore, inflationScore, vixLevel: vixNow, signals, dataAge };
}

// ── Framework 2: Business Cycle Clock (rate-of-change) ───────────────────────
// Classifies based on ACCELERATION of growth and inflation signals, not levels.
// Recovery = growth accel + inflation decel
// Expansion = both accel
// Slowdown = growth decel + inflation accel (late cycle)
// Contraction = both decel

function computeBusinessCycle(indicators: Record<string, number[]>): BusinessCycleResult {
  const spy = indicators['SPY'] ?? [];
  const iwm = indicators['IWM'] ?? [];
  const tip = indicators['TIP'] ?? [];
  const gsg = indicators['GSG'] ?? [];

  // Growth momentum: compare 1M vs 3M annualized SPY returns
  const spy1M     = nDayReturn(spy, 21);
  const spy3M     = nDayReturn(spy, 63);
  const spyMom    = (spy1M * 12) - (spy3M * 4);

  // Breadth momentum: IWM/SPY ratio change over past month
  let breadthMom = 0;
  if (iwm.length > 22 && spy.length > 22) {
    const ratioNow = last(iwm) / (last(spy) || 1);
    const ratio1M  = (iwm[iwm.length - 22] ?? last(iwm)) / ((spy[spy.length - 22] ?? last(spy)) || 1);
    breadthMom     = ratio1M > 0 ? ((ratioNow - ratio1M) / ratio1M) * 12 : 0;
  }

  const growthMomentum = spyMom * 0.7 + breadthMom * 0.3;

  // Inflation momentum: compare 1M vs 3M annualized TIP + GSG
  const tip1M  = nDayReturn(tip, 21);
  const tip3M  = nDayReturn(tip, 63);
  const tipMom = (tip1M * 12) - (tip3M * 4);

  const gsg1M  = nDayReturn(gsg, 21);
  const gsg3M  = nDayReturn(gsg, 63);
  const gsgMom = (gsg1M * 12) - (gsg3M * 4);

  const inflationMomentum = tipMom * 0.6 + gsgMom * 0.4;

  const THRESHOLD = 0.02;
  const gAccel = growthMomentum > THRESHOLD;
  const iAccel = inflationMomentum > THRESHOLD;

  let phase: BusinessCycleName;
  if (!spy.length || !tip.length) phase = 'UNKNOWN';
  else if  ( gAccel && !iAccel) phase = 'RECOVERY';
  else if  ( gAccel &&  iAccel) phase = 'EXPANSION';
  else if  (!gAccel &&  iAccel) phase = 'SLOWDOWN';
  else                          phase = 'CONTRACTION';

  const meta = BUSINESS_CYCLE_META[phase];
  return { phase, growthMomentum, inflationMomentum, description: meta.description, recommendation: meta.recommendation };
}

// ── Framework 3: Volatility Regime ────────────────────────────────────────────

function computeVolatility(indicators: Record<string, number[]>): VolatilityResult {
  const vix = indicators['^VIX'] ?? [];
  const tlt = indicators['TLT']  ?? [];

  const vixNow    = last(vix);
  const vix20dAvg = sma(vix, 20);

  const vixTrend: 'rising' | 'falling' | 'stable' =
    vixNow > vix20dAvg * 1.12 ? 'rising' :
    vixNow < vix20dAvg * 0.88 ? 'falling' : 'stable';

  const bondVolProxy = realizedVol(tlt, 20);

  let level: VolatilityLevel;
  if      (vixNow > 30) level = 'CRISIS';
  else if (vixNow > 25) level = 'HIGH';
  else if (vixNow > 20) level = 'ELEVATED';
  else if (vixNow > 15) level = 'NORMAL';
  else                  level = 'LOW';

  const descriptions: Record<VolatilityLevel, string> = {
    LOW:      `VIX ${vixNow.toFixed(1)} — complacency zone. Risk assets supported; watch for mean-reversion. Bond vol: ${bondVolProxy.toFixed(1)}% ann.`,
    NORMAL:   `VIX ${vixNow.toFixed(1)} — constructive. No fear excess in either direction. Standard position sizing appropriate.`,
    ELEVATED: `VIX ${vixNow.toFixed(1)} — caution warranted. Consider reducing position sizes 10–20%. Watch credit spreads.`,
    HIGH:     `VIX ${vixNow.toFixed(1)} — significant stress. Defensive positioning advised. Correlations rising across risk assets.`,
    CRISIS:   `VIX ${vixNow.toFixed(1)} — crisis mode. Capital preservation overrides return objectives.`,
  };

  return { level, vix: vixNow, vix20dAvg, vixTrend, bondVolProxy, description: descriptions[level] };
}

// ── Framework 4: Liquidity Regime ─────────────────────────────────────────────

function computeLiquidity(indicators: Record<string, number[]>): LiquidityResult {
  const irx = indicators['^IRX'] ?? [];
  const uup = indicators['UUP']  ?? [];
  const hyg = indicators['HYG']  ?? [];
  const lqd = indicators['LQD']  ?? [];

  let score = 0;
  const signals: string[] = [];

  // L1: Short-rate trend — IRX rising = policy tightening biting
  const irx3M = nDayReturn(irx, 63);
  if (irx3M > 0.05)  { score--; signals.push('Short rates rising — monetary tightening active'); }
  else if (irx3M < -0.05) { score++; signals.push('Short rates falling — policy easing underway'); }
  else { signals.push('Short rates stable — policy on hold'); }

  // L2: IG credit performance — proxy for funding market conditions
  const lqd3M = nDayReturn(lqd, 63);
  if (lqd3M > 0.02)  { score++; signals.push('IG credit rallying — funding conditions loose'); }
  else if (lqd3M < -0.03) { score--; signals.push('IG credit under pressure — funding tightening'); }
  else { signals.push('IG credit stable'); }

  // L3: Dollar — strong USD drains global USD liquidity
  const uup3M = nDayReturn(uup, 63);
  if (uup3M > 0.03)  { score--; signals.push('USD strength — global liquidity tightening, EM pressure'); }
  else if (uup3M < -0.03) { score++; signals.push('USD weakness — global liquidity expanding, EM supportive'); }
  else { signals.push('USD neutral — no major liquidity impulse'); }

  // L4: HY vs IG quality spread — flight to quality = liquidity stress
  const hyg1M = nDayReturn(hyg, 21);
  const lqd1M = nDayReturn(lqd, 21);
  const qualSpread = hyg1M - lqd1M;
  if (qualSpread > 0.015)  { score++; signals.push('HY outperforming IG — liquidity ample, risk appetite high'); }
  else if (qualSpread < -0.015) { score--; signals.push('HY underperforming IG — flight to quality, liquidity stress'); }
  else { signals.push('HY/IG spread neutral'); }

  score = clamp(score, -3, 3);

  let level: LiquidityLevel;
  if      (score >= 2)  level = 'AMPLE';
  else if (score >= 0)  level = 'NEUTRAL';
  else if (score >= -2) level = 'TIGHTENING';
  else                  level = 'STRESS';

  const descriptions: Record<LiquidityLevel, string> = {
    AMPLE:      'Conditions supportive — easy policy, tight credit spreads, dollar neutral/weak. Risk-taking environment.',
    NEUTRAL:    'Mixed signals. Neither strongly accommodative nor restrictive. Monitor for directional change.',
    TIGHTENING: 'Liquidity being withdrawn — rising rates, USD strengthening, credit spreads widening. Headwinds for risk assets.',
    STRESS:     'Acute liquidity stress — flight to quality, USD surging, funding markets strained.',
  };

  return { level, score, signals, description: descriptions[level] };
}

// ── Framework 5: Credit Cycle ─────────────────────────────────────────────────

function computeCreditCycle(indicators: Record<string, number[]>): CreditCycleResult {
  const hyg = indicators['HYG'] ?? [];
  const lqd = indicators['LQD'] ?? [];

  const hyg1M = nDayReturn(hyg, 21);
  const hyg3M = nDayReturn(hyg, 63);
  const lqd1M = nDayReturn(lqd, 21);
  const lqd3M = nDayReturn(lqd, 63);

  // Quality spread: HYG return minus LQD return (positive = HY outperforming = credit bullish)
  const qualitySpread1M = hyg1M - lqd1M;
  const qualitySpread3M = hyg3M - lqd3M;

  const spreadTrend: 'improving' | 'stable' | 'deteriorating' =
    qualitySpread1M > qualitySpread3M + 0.01 ? 'improving' :
    qualitySpread1M < qualitySpread3M - 0.01 ? 'deteriorating' : 'stable';

  const hygSMA     = sma(hyg, 63);
  const hygAboveSMA = last(hyg) > hygSMA;

  let phase: CreditCyclePhase;
  if      ( qualitySpread1M > 0.01  &&  hygAboveSMA) phase = 'EXPANSION';
  else if ( qualitySpread1M > -0.01 &&  hygAboveSMA) phase = 'STABLE';
  else if ( qualitySpread1M < -0.015 && !hygAboveSMA) phase = 'STRESS';
  else                                                phase = 'WIDENING';

  const descriptions: Record<CreditCyclePhase, string> = {
    EXPANSION: 'HY credit outperforming IG and above trend — risk appetite strong. Credit cycle supporting growth.',
    STABLE:    'Credit spreads neutral. HY and IG moving together — no stress or euphoria. Typical mid-cycle.',
    WIDENING:  'HY underperforming IG — quality spread widening. Early warning of credit stress.',
    STRESS:    'HY below trend and lagging IG significantly — credit stress active. Historically precedes equity corrections.',
  };

  return { phase, qualitySpread1M, spreadTrend, description: descriptions[phase] };
}

// ── Transition Risk: predict next regime ─────────────────────────────────────

function predictNextRegime(
  current: RegimeName,
  growthMomentum: number,
  inflationMomentum: number,
): RegimeName | null {
  const T = 0.04;
  const gFalling = growthMomentum    < -T;
  const gRising  = growthMomentum    >  T;
  const iFalling = inflationMomentum < -T;
  const iRising  = inflationMomentum >  T;

  switch (current) {
    case 'GOLDILOCKS':
      if (iRising  && gRising)  return 'REFLATION';
      if (gFalling && iFalling) return 'RECESSION';
      if (gFalling && iRising)  return 'STAGFLATION';
      break;
    case 'REFLATION':
      if (gFalling && iRising)  return 'STAGFLATION';
      if (gFalling && iFalling) return 'RECESSION';
      if (iFalling && gRising)  return 'GOLDILOCKS';
      break;
    case 'STAGFLATION':
      if (iFalling && gFalling) return 'RECESSION';
      if (gRising  && iRising)  return 'REFLATION';
      if (iFalling && gRising)  return 'GOLDILOCKS';
      break;
    case 'RECESSION':
      if (gRising  && iFalling) return 'GOLDILOCKS';
      if (gRising  && iRising)  return 'REFLATION';
      if (iRising  && gFalling) return 'STAGFLATION';
      break;
  }
  return null;
}

// ── 10 Leading Indicator Signals ─────────────────────────────────────────────

function computeTransitionRisk(
  indicators: Record<string, number[]>,
  currentRegime: RegimeName,
  growthMomentum: number,
  inflationMomentum: number,
): TransitionRiskResult {
  const spy  = indicators['SPY']  ?? [];
  const iwm  = indicators['IWM']  ?? [];
  const gld  = indicators['GLD']  ?? [];
  const cper = indicators['CPER'] ?? [];
  const xlu  = indicators['XLU']  ?? [];
  const xlk  = indicators['XLK']  ?? [];
  const eem  = indicators['EEM']  ?? [];
  const hyg  = indicators['HYG']  ?? [];
  const lqd  = indicators['LQD']  ?? [];
  const vix  = indicators['^VIX'] ?? [];
  const tnx  = indicators['^TNX'] ?? [];
  const irx  = indicators['^IRX'] ?? [];
  const tlt  = indicators['TLT']  ?? [];
  const uup  = indicators['UUP']  ?? [];
  const shy  = indicators['SHY']  ?? [];

  const signals: LeadingSignal[] = [];
  let rawScore = 0;

  const addSignal = (s: LeadingSignal) => {
    signals.push(s);
    if (s.signal === 'bearish') {
      rawScore += s.strength === 'strong' ? 18 : s.strength === 'moderate' ? 10 : 4;
    } else if (s.signal === 'bullish') {
      rawScore -= s.strength === 'strong' ? 5 : s.strength === 'moderate' ? 3 : 1;
    }
  };

  // LI1: Copper / Gold ratio — industrial demand vs safe haven
  if (cper.length > 63 && gld.length > 63) {
    const ratioNow = last(cper) / (last(gld) || 1);
    const ratio3M  = (cper[cper.length - 64] ?? last(cper)) / ((gld[gld.length - 64] ?? last(gld)) || 1);
    const ch       = ratio3M > 0 ? (ratioNow - ratio3M) / ratio3M : 0;
    const sig: LeadingSignal['signal'] = ch > 0.05 ? 'bullish' : ch < -0.03 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(ch) > 0.10 ? 'strong' : Math.abs(ch) > 0.05 ? 'moderate' : 'weak';
    addSignal({
      name: 'Copper / Gold Ratio', tickers: 'CPER / GLD',
      value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}% (3M)`, signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Industrial demand falling vs safe haven — growth expectations deteriorating'
        : sig === 'bullish' ? 'Industrial demand rising vs gold — growth regime building'
        : 'Ratio stable — no directional regime signal',
      timeHorizon: '3-6 months',
    });
  }

  // LI2: Small cap breadth — IWM/SPY ratio
  if (iwm.length > 42 && spy.length > 42) {
    const rNow = last(iwm) / (last(spy) || 1);
    const r2M  = (iwm[iwm.length - 43] ?? last(iwm)) / ((spy[spy.length - 43] ?? last(spy)) || 1);
    const ch   = r2M > 0 ? (rNow - r2M) / r2M : 0;
    const sig: LeadingSignal['signal'] = ch > 0.03 ? 'bullish' : ch < -0.03 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(ch) > 0.07 ? 'strong' : Math.abs(ch) > 0.03 ? 'moderate' : 'weak';
    addSignal({
      name: 'Small Cap Breadth', tickers: 'IWM / SPY',
      value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}% (2M)`, signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Small caps underperforming — late cycle, credit stress, growth breadth narrowing'
        : sig === 'bullish' ? 'Breadth widening — early/mid cycle, risk appetite broad'
        : 'Breadth neutral — no cycle signal',
      timeHorizon: '1-3 months',
    });
  }

  // LI3: Yield curve trajectory — un-inversion is the most dangerous signal
  if (tnx.length > 63 && irx.length > 63) {
    const spreadNow  = last(tnx) - last(irx);
    const spread3M   = (tnx[tnx.length - 64] ?? last(tnx)) - (irx[irx.length - 64] ?? last(irx));
    const slopeChg   = spreadNow - spread3M;
    const isInverted = spreadNow < 0;
    const unInverting = spread3M < -0.3 && spreadNow > spread3M + 0.3;
    const tnx1M      = last(tnx) - (tnx[tnx.length - 22] ?? last(tnx));
    const irx1M      = last(irx) - (irx[irx.length - 22] ?? last(irx));
    const bullSteepen = slopeChg > 0.3 && irx1M < -0.1 && tnx1M < irx1M;

    let sig: LeadingSignal['signal'] = 'neutral';
    let impl = '';
    let str: LeadingSignal['strength'] = 'weak';
    if (unInverting || bullSteepen) {
      sig  = 'bearish'; str = 'strong';
      impl = unInverting
        ? 'Yield curve un-inverting — historically most reliable recession signal within 1–3 months'
        : 'Bull steepening — short rates falling faster; market pricing rate cuts = recession signal';
    } else if (isInverted && slopeChg < -0.1) {
      sig  = 'bearish'; str = 'moderate';
      impl = 'Inversion deepening — recessionary pressure intensifying';
    } else if (!isInverted && slopeChg > 0.2) {
      sig  = 'bullish'; str = 'moderate';
      impl = 'Curve steepening from positive levels — growth recovery building';
    } else {
      impl = `Curve ${isInverted ? 'inverted' : 'positive'} at ${spreadNow.toFixed(2)}% — monitoring`;
    }
    addSignal({
      name: 'Yield Curve Trajectory', tickers: '^TNX − ^IRX',
      value: `${spreadNow.toFixed(2)}% (Δ${slopeChg >= 0 ? '+' : ''}${slopeChg.toFixed(2)}% vs 3M)`,
      signal: sig, strength: str, implication: impl, timeHorizon: '3-6 months',
    });
  }

  // LI4: VIX complacency / stress buildup
  if (vix.length > 60) {
    const vixNow  = last(vix);
    const vix60d  = sma(vix, 60);
    const ratio   = vixNow / (vix60d || 1);
    let sig: LeadingSignal['signal'] = 'neutral';
    let impl = '';
    let str: LeadingSignal['strength'] = 'weak';
    if (ratio < 0.70) {
      sig = 'bearish'; str = 'strong';
      impl = 'VIX far below 60d average — extreme complacency; historically precedes volatility spikes';
    } else if (ratio < 0.80) {
      sig = 'bearish'; str = 'moderate';
      impl = 'VIX below recent average — complacency building; contrarian warning';
    } else if (ratio > 1.40) {
      sig = 'bearish'; str = 'strong';
      impl = 'VIX surging well above average — acute stress regime building; drawdown risk elevated';
    } else if (ratio > 1.20) {
      sig = 'bearish'; str = 'moderate';
      impl = 'VIX elevated vs recent average — risk appetite declining, defensive rotation warranted';
    } else {
      impl = `VIX ${vixNow.toFixed(1)} in line with 60d avg ${vix60d.toFixed(1)} — no complacency or stress extreme`;
    }
    addSignal({
      name: 'Volatility Complacency / Stress', tickers: '^VIX vs 60d avg',
      value: `VIX ${vixNow.toFixed(1)} (60d avg: ${vix60d.toFixed(1)})`,
      signal: sig, strength: str, implication: impl, timeHorizon: '1-4 weeks',
    });
  }

  // LI5: Sector rotation — Tech vs Defensives (XLK/XLU)
  if (xlk.length > 42 && xlu.length > 42) {
    const rNow = last(xlk) / (last(xlu) || 1);
    const r2M  = (xlk[xlk.length - 43] ?? last(xlk)) / ((xlu[xlu.length - 43] ?? last(xlu)) || 1);
    const ch   = r2M > 0 ? (rNow - r2M) / r2M : 0;
    const sig: LeadingSignal['signal'] = ch > 0.04 ? 'bullish' : ch < -0.04 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(ch) > 0.10 ? 'strong' : Math.abs(ch) > 0.04 ? 'moderate' : 'weak';
    addSignal({
      name: 'Sector Rotation (Tech / Defensives)', tickers: 'XLK / XLU',
      value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}% (2M)`, signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Defensives outperforming tech — late-cycle rotation; investors positioning for slowdown'
        : sig === 'bullish' ? 'Tech outperforming defensives — risk-on; growth expectations rising'
        : 'Sector rotation neutral — no clear cycle signal',
      timeHorizon: '1-3 months',
    });
  }

  // LI6: EM vs DM (EEM/SPY) — global growth and USD signal
  if (eem.length > 42 && spy.length > 42) {
    const rNow = last(eem) / (last(spy) || 1);
    const r2M  = (eem[eem.length - 43] ?? last(eem)) / ((spy[spy.length - 43] ?? last(spy)) || 1);
    const ch   = r2M > 0 ? (rNow - r2M) / r2M : 0;
    const sig: LeadingSignal['signal'] = ch > 0.03 ? 'bullish' : ch < -0.03 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(ch) > 0.08 ? 'strong' : Math.abs(ch) > 0.03 ? 'moderate' : 'weak';
    addSignal({
      name: 'EM vs Developed Markets', tickers: 'EEM / SPY',
      value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}% (2M)`, signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'EM underperforming DM — USD strength, global growth concerns, EM capital outflows'
        : sig === 'bullish' ? 'EM outperforming — global recovery, USD weakness, commodity demand rising'
        : 'EM/DM neutral — no global divergence signal',
      timeHorizon: '1-3 months',
    });
  }

  // LI7: Credit spread velocity — rate of change of HY/IG spread
  if (hyg.length > 63 && lqd.length > 63) {
    const hyg1M    = nDayReturn(hyg, 21);
    const hyg3M    = nDayReturn(hyg, 63);
    const lqd1M    = nDayReturn(lqd, 21);
    const lqd3M    = nDayReturn(lqd, 63);
    const spd1M    = hyg1M - lqd1M;
    const spd3M    = hyg3M - lqd3M;
    const velocity = spd1M - spd3M;
    const sig: LeadingSignal['signal'] = velocity > 0.015 ? 'bullish' : velocity < -0.015 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(velocity) > 0.035 ? 'strong' : Math.abs(velocity) > 0.015 ? 'moderate' : 'weak';
    addSignal({
      name: 'Credit Spread Velocity', tickers: 'HYG vs LQD',
      value: `1M spread ${spd1M >= 0 ? '+' : ''}${(spd1M * 100).toFixed(1)}% vs 3M ${(spd3M * 100).toFixed(1)}%`,
      signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Credit quality spread deteriorating rapidly — stress building faster than trailing signals indicate'
        : sig === 'bullish' ? 'Credit conditions loosening faster recently — regime stability improving'
        : 'Credit spread velocity neutral',
      timeHorizon: '1-4 weeks',
    });
  }

  // LI8: Equity momentum deceleration (SPY)
  if (spy.length > 63) {
    const spy1M = nDayReturn(spy, 21);
    const spy3M = nDayReturn(spy, 63);
    const mom   = (spy1M * 12) - (spy3M * 4);
    const sig: LeadingSignal['signal'] = mom > 0.10 ? 'bullish' : mom < -0.10 ? 'bearish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(mom) > 0.25 ? 'strong' : Math.abs(mom) > 0.10 ? 'moderate' : 'weak';
    addSignal({
      name: 'Equity Momentum Shift', tickers: 'SPY',
      value: `1M ann. ${(spy1M * 1200).toFixed(0)}%  vs  3M ann. ${(spy3M * 400).toFixed(0)}%`,
      signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Equity momentum decelerating — short-term returns lagging medium-term trend; growth impulse fading'
        : sig === 'bullish' ? 'Equity momentum accelerating — short-term exceeding medium-term; growth building'
        : 'Equity momentum stable',
      timeHorizon: '1-3 months',
    });
  }

  // LI9: Dollar acceleration / deceleration
  if (uup.length > 63) {
    const uup1M  = nDayReturn(uup, 21);
    const uup3M  = nDayReturn(uup, 63);
    const dolMom = (uup1M * 12) - (uup3M * 4);
    const sig: LeadingSignal['signal'] = dolMom > 0.08 ? 'bearish' : dolMom < -0.08 ? 'bullish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(dolMom) > 0.18 ? 'strong' : Math.abs(dolMom) > 0.08 ? 'moderate' : 'weak';
    addSignal({
      name: 'Dollar Momentum', tickers: 'UUP',
      value: `1M ann. ${(uup1M * 1200).toFixed(0)}%  vs  3M ann. ${(uup3M * 400).toFixed(0)}%`,
      signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Dollar accelerating — global USD liquidity tightening; EM and commodity headwinds'
        : sig === 'bullish' ? 'Dollar decelerating — global liquidity improving; risk assets, EM, commodities supportive'
        : 'Dollar momentum stable — no liquidity impulse',
      timeHorizon: '1-3 months',
    });
  }

  // LI10: Duration preference — SHY/TLT ratio (flight to long duration = risk-off signal)
  if (shy.length > 42 && tlt.length > 42) {
    const rNow = last(shy) / (last(tlt) || 1);
    const r2M  = (shy[shy.length - 43] ?? last(shy)) / ((tlt[tlt.length - 43] ?? last(tlt)) || 1);
    const ch   = r2M > 0 ? (rNow - r2M) / r2M : 0;
    // Ratio falling = TLT (long duration) outperforming = flight to safety = bearish
    const sig: LeadingSignal['signal'] = ch < -0.03 ? 'bearish' : ch > 0.03 ? 'bullish' : 'neutral';
    const str: LeadingSignal['strength'] = Math.abs(ch) > 0.07 ? 'strong' : Math.abs(ch) > 0.03 ? 'moderate' : 'weak';
    addSignal({
      name: 'Duration Preference (Short / Long)', tickers: 'SHY / TLT',
      value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}% (2M)`, signal: sig, strength: str,
      implication: sig === 'bearish'
        ? 'Long-duration bonds outperforming — flight to safety; market pricing significant growth slowdown'
        : sig === 'bullish' ? 'Short duration outperforming — inflation/growth expectations rising, steepening curve'
        : 'Duration preference neutral',
      timeHorizon: '3-6 months',
    });
  }

  // Normalise score to 0–100
  const maxPossible = signals.length * 18;
  const normalised  = maxPossible > 0 ? clamp(Math.round((rawScore / maxPossible) * 100), 0, 100) : 0;

  let level: TransitionRiskLevel;
  if      (normalised >= 65) level = 'HIGH';
  else if (normalised >= 45) level = 'ELEVATED';
  else if (normalised >= 25) level = 'MODERATE';
  else                       level = 'LOW';

  const mostLikelyNextRegime = predictNextRegime(currentRegime, growthMomentum, inflationMomentum);

  const descriptions: Record<TransitionRiskLevel, string> = {
    LOW:      'Leading indicators broadly supportive of the current regime. Low probability of near-term shift.',
    MODERATE: 'Mixed signals — some leading indicators flashing early warnings. Monitor but no repositioning needed yet.',
    ELEVATED: 'Multiple leading indicators warning. Regime transition likely within 1–3 months. Begin positioning adjustments.',
    HIGH:     'Significant cross-asset warnings active. Regime shift appears imminent or underway. Defensive positioning strongly advised.',
  };

  return { level, score: normalised, signals, mostLikelyNextRegime, description: descriptions[level] };
}

// ── Cross-framework consensus ─────────────────────────────────────────────────

function computeConsensus(
  bridgewater:   RegimeResult,
  businessCycle: BusinessCycleResult,
  volatility:    VolatilityResult,
  liquidity:     LiquidityResult,
  creditCycle:   CreditCycleResult,
  transitionRisk: TransitionRiskResult,
): FullRegimeAnalysis['consensus'] {
  let riskOn = 0;
  let riskOff = 0;

  // Bridgewater
  if (['GOLDILOCKS', 'REFLATION'].includes(bridgewater.regime)) riskOn++;
  else if (['STAGFLATION', 'RECESSION', 'RISK_OFF_SPIKE'].includes(bridgewater.regime)) riskOff++;

  // Business Cycle
  if (['RECOVERY', 'EXPANSION'].includes(businessCycle.phase)) riskOn++;
  else if (['SLOWDOWN', 'CONTRACTION'].includes(businessCycle.phase)) riskOff++;

  // Volatility
  if (['LOW', 'NORMAL'].includes(volatility.level)) riskOn++;
  else if (['HIGH', 'CRISIS'].includes(volatility.level)) riskOff++;
  // ELEVATED = neutral, no count

  // Liquidity
  if (liquidity.level === 'AMPLE') riskOn++;
  else if (['TIGHTENING', 'STRESS'].includes(liquidity.level)) riskOff++;

  // Credit
  if (['EXPANSION', 'STABLE'].includes(creditCycle.phase)) riskOn++;
  else if (['WIDENING', 'STRESS'].includes(creditCycle.phase)) riskOff++;

  // Transition risk (inverse)
  if (transitionRisk.level === 'LOW') riskOn++;
  else if (['ELEVATED', 'HIGH'].includes(transitionRisk.level)) riskOff++;

  const total = 6;
  const score = riskOn / total;

  let riskBias: 'risk-on' | 'balanced' | 'risk-off';
  if      (score >= 0.60) riskBias = 'risk-on';
  else if (score <= 0.40) riskBias = 'risk-off';
  else                    riskBias = 'balanced';

  const conviction = Math.abs(score - 0.5) * 2;

  const summaries: Record<typeof riskBias, string> = {
    'risk-on':  `${riskOn}/${total} frameworks support risk-taking. Majority consensus: stay invested, bias toward growth assets.`,
    'balanced': `${riskOn}/${total} risk-on vs ${riskOff}/${total} risk-off. Mixed signals — balanced allocation appropriate, no directional conviction.`,
    'risk-off': `${riskOff}/${total} frameworks warn against risk. Majority consensus: defensive positioning, capital preservation.`,
  };

  return { riskBias, conviction, summary: summaries[riskBias] };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function computeFullAnalysis(indicators: Record<string, number[]>): FullRegimeAnalysis {
  const bridgewater    = computeBridgewater(indicators);
  const businessCycle  = computeBusinessCycle(indicators);
  const volatility     = computeVolatility(indicators);
  const liquidity      = computeLiquidity(indicators);
  const creditCycle    = computeCreditCycle(indicators);
  const transitionRisk = computeTransitionRisk(
    indicators,
    bridgewater.regime,
    businessCycle.growthMomentum,
    businessCycle.inflationMomentum,
  );
  const consensus = computeConsensus(
    bridgewater, businessCycle, volatility, liquidity, creditCycle, transitionRisk,
  );
  return { bridgewater, businessCycle, volatility, liquidity, creditCycle, transitionRisk, consensus };
}

// Backward-compatible alias
export const computeRegime = computeBridgewater;
