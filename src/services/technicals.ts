import type { OHLCVBar, TechnicalSignals, SignalRating } from '../types/portfolio';

// ─── Indicator helpers ────────────────────────────────────────────────────────

export function computeSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = values.slice(0, period).reduce((a, b) => a + b, 0);
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }
  return result;
}

export function computeEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

// Wilder's smoothed RSI — matches TradingView's implementation
export function computeRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function computeMACD(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
  const n = closes.length;
  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);

  const macdLine: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) {
      macdLine[i] = (emaFast[i] as number) - (emaSlow[i] as number);
    }
  }

  const firstValid = macdLine.findIndex(v => v !== null);
  const signalLine: (number | null)[] = new Array(n).fill(null);
  const histogram: (number | null)[] = new Array(n).fill(null);

  if (firstValid >= 0) {
    const validMacd = (macdLine.slice(firstValid) as number[]);
    const signalEMA = computeEMA(validMacd, signalPeriod);
    for (let i = 0; i < signalEMA.length; i++) {
      signalLine[firstValid + i] = signalEMA[i];
    }
    for (let i = 0; i < n; i++) {
      if (macdLine[i] != null && signalLine[i] != null) {
        histogram[i] = (macdLine[i] as number) - (signalLine[i] as number);
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

interface BollingerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  bandwidth: (number | null)[];
}

// Uses population std dev (divide by N) — matches TradingView's Bollinger Bands
export function computeBollingerBands(closes: number[], period = 20, mult = 2): BollingerResult {
  const n = closes.length;
  const sma = computeSMA(closes, period);
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  const bandwidth: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const mid = sma[i] as number;
    const slice = closes.slice(i - period + 1, i + 1);
    const variance = slice.reduce((sum, v) => sum + (v - mid) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mid + mult * sd;
    lower[i] = mid - mult * sd;
    bandwidth[i] = mid > 0 ? ((upper[i] as number) - (lower[i] as number)) / mid : null;
  }

  return { upper, middle: sma, lower, bandwidth };
}

// Wilder's smoothed ATR
export function computeATR(bars: OHLCVBar[], period = 14): (number | null)[] {
  const n = bars.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1) return result;

  const tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  let atr = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }
  return result;
}

export function computeOBV(bars: OHLCVBar[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const prev = obv[i - 1];
    if (bars[i].close > bars[i - 1].close) obv.push(prev + bars[i].volume);
    else if (bars[i].close < bars[i - 1].close) obv.push(prev - bars[i].volume);
    else obv.push(prev);
  }
  return obv;
}

// Chaikin Money Flow (20-bar) — weights volume by close position within H-L range.
// > 0.1 = accumulation, < −0.1 = distribution. More robust than raw OBV because
// it accounts for where the close fell in the day's range, not just direction.
export function computeCMF(bars: OHLCVBar[], period = 20): (number | null)[] {
  const n = bars.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n < period) return result;

  const mfv = bars.map(b => {
    const range = b.high - b.low;
    if (range === 0) return 0;
    return ((b.close - b.low) - (b.high - b.close)) / range * b.volume;
  });

  let mfvSum = mfv.slice(0, period).reduce((a, b) => a + b, 0);
  let volSum = bars.slice(0, period).reduce((a, b) => a + b.volume, 0);
  result[period - 1] = volSum !== 0 ? mfvSum / volSum : 0;

  for (let i = period; i < n; i++) {
    mfvSum += mfv[i] - mfv[i - period];
    volSum += bars[i].volume - bars[i - period].volume;
    result[i] = volSum !== 0 ? mfvSum / volSum : 0;
  }
  return result;
}

// Annualized realized volatility from log returns over `period` bars.
function computeRealizedVol(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-(period + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0 && slice[i] > 0) logReturns.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (logReturns.length < period - 2) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
  return Math.sqrt(variance * 252);
}

// 60-day rolling beta vs a benchmark (e.g. SPY closes).
// Aligns on the trailing min-length of both series.
export function computeBeta(closes: number[], benchCloses: number[], period = 60): number | null {
  const minLen = Math.min(closes.length, benchCloses.length);
  if (minLen < period + 1) return null;

  const stockSlice = closes.slice(closes.length - period - 1);
  const benchSlice = benchCloses.slice(benchCloses.length - period - 1);

  const stockRets: number[] = [];
  const benchRets: number[] = [];
  for (let i = 1; i < stockSlice.length; i++) {
    stockRets.push((stockSlice[i] - stockSlice[i - 1]) / stockSlice[i - 1]);
    benchRets.push((benchSlice[i] - benchSlice[i - 1]) / benchSlice[i - 1]);
  }

  const meanS = stockRets.reduce((a, b) => a + b, 0) / stockRets.length;
  const meanB = benchRets.reduce((a, b) => a + b, 0) / benchRets.length;

  let cov = 0, varB = 0;
  for (let i = 0; i < stockRets.length; i++) {
    cov  += (stockRets[i] - meanS) * (benchRets[i] - meanB);
    varB += (benchRets[i] - meanB) ** 2;
  }
  return varB > 0 ? Math.round(cov / varB * 100) / 100 : null;
}

// ─── Corwin-Schultz (2012) bid-ask spread from daily OHLC ─────────────────────
export function computeCorwinSchultzSpread(bars: OHLCVBar[], lookback = 20): number | null {
  if (bars.length < 2) return null;
  const sqrt2 = Math.SQRT2;
  const denom = 3 - 2 * sqrt2;

  const start = Math.max(0, bars.length - lookback - 1);
  const spreads: number[] = [];

  for (let i = start; i < bars.length - 1; i++) {
    const { high: h1, low: l1 } = bars[i];
    const { high: h2, low: l2 } = bars[i + 1];
    if (h1 <= 0 || l1 <= 0 || h2 <= 0 || l2 <= 0 || h1 < l1 || h2 < l2) continue;

    const beta  = Math.log(h1 / l1) ** 2 + Math.log(h2 / l2) ** 2;
    const gamma = Math.log(Math.max(h1, h2) / Math.min(l1, l2)) ** 2;
    const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / denom - Math.sqrt(gamma / denom);
    if (alpha < 0) continue;

    const spread = 2 * (Math.exp(alpha) - 1) / (1 + Math.exp(alpha));
    spreads.push(spread * 100);
  }

  if (spreads.length === 0) return null;
  return spreads.reduce((a, b) => a + b, 0) / spreads.length;
}

// ─── Alpha decay half-lives (trading days) ───────────────────────────────────
const HALF_LIVES: Record<'momentum' | 'mean_reversion' | 'neutral', number> = {
  momentum:       200,
  mean_reversion: 5,
  neutral:        30,
};

// ─── Regime multipliers ──────────────────────────────────────────────────────
const REGIME_MULTIPLIERS: Record<string, number> = {
  GOLDILOCKS:     1.00,
  REFLATION:      0.85,
  STAGFLATION:    0.60,
  RECESSION:      0.40,
  RISK_OFF_SPIKE: 0.00,
};

// ─── Options for computeTechnicalSignals ─────────────────────────────────────
export interface SignalComputeOptions {
  entryPrice?: number;              // avg cost; for Chandelier Exit baseline
  entryDate?: string;               // ISO date; to find max close since entry
  shortPctFloat?: number | null;    // from Yahoo Finance keyStats
  spyBars?: OHLCVBar[];             // for beta vs SPY computation
  livePrice?: number;               // live current price — overrides last bar close for entry/target computation
  nextEarningsDate?: string | null; // ISO date of next (or most recent) earnings
}

// ─── Main signal computation ─────────────────────────────────────────────────
export function computeTechnicalSignals(
  bars: OHLCVBar[],
  ticker: string,
  regime?: string,
  options?: SignalComputeOptions,
): TechnicalSignals {
  const n = bars.length;
  const closes = bars.map(b => b.close);
  const price = options?.livePrice ?? closes[n - 1];

  // ── Core indicators ────────────────────────────────────────────────────────
  const sma20arr = computeSMA(closes, 20);
  const sma50arr = computeSMA(closes, 50);
  const rsiArr   = computeRSI(closes, 14);
  const { macd: macdArr, signal: signalArr, histogram: histArr } = computeMACD(closes);
  const { upper: bbUp, middle: bbMid, lower: bbLow, bandwidth: bbBW } = computeBollingerBands(closes);
  const atrArr   = computeATR(bars);
  const atr22Arr = computeATR(bars, 22);
  const cmfArr   = computeCMF(bars, 20);
  const volSma   = computeSMA(bars.map(b => b.volume), 20);

  const sma20      = sma20arr[n - 1];
  const sma50      = sma50arr[n - 1];
  const sma50Prev  = sma50arr[n - 2];
  const sma20Prev  = sma20arr[n - 2];
  const rsi        = rsiArr[n - 1];
  const macd       = macdArr[n - 1];
  const macdSig    = signalArr[n - 1];
  const macdHist   = histArr[n - 1];
  const macdHistP  = histArr[n - 2];
  const bbUpper    = bbUp[n - 1];
  const bbMiddle   = bbMid[n - 1];
  const bbLower    = bbLow[n - 1];
  const bbBandwidth = bbBW[n - 1];
  const atr        = atrArr[n - 1];
  const atr22      = atr22Arr[n - 1];
  const cmf20      = cmfArr[n - 1];
  const volAvg     = volSma[n - 1];
  const volRatio   = volAvg != null && volAvg > 0 ? bars[n - 1].volume / volAvg : null;

  // BB %B: position within Bollinger Bands (0 = at lower, 1 = at upper)
  const bbPctB = (bbUpper != null && bbLower != null && bbUpper > bbLower)
    ? Math.round(((price - bbLower) / (bbUpper - bbLower)) * 1000) / 1000
    : null;

  // Price-to-52wk-high proxy (using full available bar window)
  const maxHigh = bars.length > 0 ? Math.max(...bars.map(b => b.high)) : price;
  const pth52wk = maxHigh > 0 ? Math.round((price / maxHigh) * 1000) / 1000 : null;
  const isNew52wkHigh = price >= maxHigh * 0.995 && (volRatio ?? 0) > 1.2;

  // Time-series momentum gate: 6M total return sign (Moskowitz, Ooi & Pedersen 2012)
  const tsmomReturn = closes[0] > 0 ? (price - closes[0]) / closes[0] : 0;
  const tsmomBullish = tsmomReturn > 0;

  // Intrastock volatility regime (21d vs 63d realized vol ratio)
  const rv21d = computeRealizedVol(closes, 21);
  const rv63d = computeRealizedVol(closes, Math.min(63, n - 2));
  let intraVolRegime: 'low' | 'normal' | 'high' = 'normal';
  if (rv21d != null && rv63d != null && rv63d > 0.001) {
    const volRatioIntra = rv21d / rv63d;
    if (volRatioIntra < 0.8 && rv21d < 0.20) intraVolRegime = 'low';
    else if (volRatioIntra > 1.5 || rv21d > 0.40) intraVolRegime = 'high';
  }

  const bbSqueeze = bbBandwidth != null && bbBandwidth < 0.04;

  // ── TREND SCORE (base weight 30%) ─────────────────────────────────────────
  let trendScore = 50;
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50 && price > sma20) trendScore = 85;
    else if (sma20 > sma50 && price < sma20) trendScore = 60;
    else if (sma20 < sma50 && price > sma20) trendScore = 40;
    else trendScore = 15;
  } else if (sma20 != null) {
    trendScore = price > sma20 ? 65 : 35;
  }

  const goldenCross = sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
    && sma20 > sma50 && sma20Prev <= sma50Prev;
  const deathCross  = sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
    && sma20 < sma50 && sma20Prev >= sma50Prev;

  if (goldenCross) trendScore = Math.min(100, trendScore + 12);
  if (deathCross)  trendScore = Math.max(0,   trendScore - 12);

  // TSMOM gate: if 6M return is negative, cap trend signals at neutral
  if (!tsmomBullish) trendScore = Math.min(trendScore, 50);

  // ── MOMENTUM SCORE (base weight 30%) ──────────────────────────────────────
  let macdScore = 50;
  if (macd != null && macdSig != null && macdHist != null) {
    if (macd > macdSig && macd > 0)
      macdScore = (macdHistP != null && macdHist > macdHistP) ? 95 : 75;
    else if (macd > macdSig && macd <= 0) macdScore = 45;
    else if (macd < macdSig && macdHist > 0) macdScore = 30;
    else macdScore = 10;
  }
  // TSMOM gate: cap MACD momentum at neutral in a 6M downtrend
  if (!tsmomBullish) macdScore = Math.min(macdScore, 50);

  let rsiScore = 50;
  if (rsi != null) {
    if (rsi >= 50 && rsi < 70)      rsiScore = 85;
    else if (rsi >= 40 && rsi < 50) rsiScore = 65;
    else if (rsi >= 30 && rsi < 40) rsiScore = 45;
    else if (rsi < 30)              rsiScore = 35; // oversold — mean-reversion potential
    else                            rsiScore = 25; // overbought
  }

  const momentumScore = macdScore * 0.6 + rsiScore * 0.4;

  // ── VOLATILITY SCORE (base weight 15%) ────────────────────────────────────
  let volatilityScore = 50;
  if (bbUpper != null && bbMiddle != null && bbLower != null) {
    if (price > bbUpper)      volatilityScore = 20;
    else if (price < bbLower) volatilityScore = 80;
    else if (price < bbMiddle) volatilityScore = 65;
    else                       volatilityScore = 55;
  }
  if (bbSqueeze) volatilityScore = Math.min(100, volatilityScore + 15);

  // ── VOLUME SCORE (base weight 15%) ────────────────────────────────────────
  // CMF is primary; volume ratio adds confirmation weight
  let volumeScore = 50;
  if (cmf20 != null) {
    if (cmf20 > 0.15)       volumeScore = 90;
    else if (cmf20 > 0.05)  volumeScore = 72;
    else if (cmf20 > -0.05) volumeScore = 50;
    else if (cmf20 > -0.15) volumeScore = 28;
    else                    volumeScore = 10;
  }
  if (volRatio != null) {
    // Volume ratio fine-tunes the CMF base score
    if (volRatio > 1.5)       volumeScore = Math.min(100, volumeScore + 10);
    else if (volRatio < 0.7)  volumeScore = Math.max(0,   volumeScore - 10);
  }

  // ── COMPOSITE with intra-vol regime weighting ─────────────────────────────
  // Weights shift to favour mean-reversion (vol/volume) in high-vol regimes
  // and trend/momentum in low-vol trending regimes.
  let wTrend = 0.30, wMom = 0.30, wVol = 0.15, wVolume = 0.15;
  if (intraVolRegime === 'low') {
    wTrend = 0.35; wMom = 0.32; wVol = 0.12; wVolume = 0.11;
  } else if (intraVolRegime === 'high') {
    wTrend = 0.20; wMom = 0.18; wVol = 0.32; wVolume = 0.20;
  }
  const rawScore = trendScore * wTrend + momentumScore * wMom + volatilityScore * wVol + volumeScore * wVolume;

  // Pull score toward 50 in adverse regimes
  const mult = regime && REGIME_MULTIPLIERS[regime] !== undefined ? REGIME_MULTIPLIERS[regime] : 1.0;

  // Short interest de-rating (only dampens bullish signals)
  const shortPct = options?.shortPctFloat ?? null;
  const shortPenalty = shortPct != null
    ? shortPct > 0.30 ? 0.70
    : shortPct > 0.20 ? 0.85
    : 1.0
    : 1.0;

  const rawFinal = 50 + (rawScore - 50) * mult;
  // Apply short penalty only to the bullish deviation
  const penalizedFinal = rawFinal > 50
    ? 50 + (rawFinal - 50) * shortPenalty
    : rawFinal;
  const finalScore = Math.round(Math.max(0, Math.min(100, penalizedFinal)));

  let rating: SignalRating;
  if (finalScore >= 75)      rating = 'STRONG_BUY';
  else if (finalScore >= 60) rating = 'BUY';
  else if (finalScore >= 40) rating = 'NEUTRAL';
  else if (finalScore >= 25) rating = 'SELL';
  else                       rating = 'STRONG_SELL';

  // ── ENTRY GUIDANCE ────────────────────────────────────────────────────────
  let entryLimit: number | null = null;
  let entryBreakout: number | null = null;
  let entryQuality: 'ideal' | 'ok' | 'stretched' | 'avoid' = 'avoid';
  let entryNote = '';

  const isBearish    = rating === 'SELL' || rating === 'STRONG_SELL';
  const oversoldNow  = rsi != null && rsi < 30;
  const overboughtNow = rsi != null && rsi > 70;

  // Near-earnings binary risk overrides entry quality
  const daysToEarnings = (() => {
    if (!options?.nextEarningsDate) return null;
    return Math.round((new Date(options.nextEarningsDate).getTime() - Date.now()) / 86400000);
  })();
  const nearEarnings = daysToEarnings != null && Math.abs(daysToEarnings) <= 7;

  if (nearEarnings) {
    entryQuality = 'avoid';
    const dir = daysToEarnings != null && daysToEarnings >= 0 ? `in ${daysToEarnings}d` : 'recently';
    entryNote = `Earnings ${dir} — binary event risk. Wait for post-announcement drift to establish before entering.`;
  } else if (isBearish) {
    entryQuality = 'avoid';
    entryNote = 'Signal is bearish — wait for trend to reverse before entering long.';
  } else if (!tsmomBullish && rating !== 'STRONG_BUY') {
    entryQuality = 'stretched';
    if (sma20 != null && price < sma20) {
      entryLimit = Math.round(price * 100) / 100;
      entryNote = `6-month return is negative (${(tsmomReturn * 100).toFixed(1)}%) and price is ${((1 - price / sma20) * 100).toFixed(1)}% below SMA20 — downtrend on both timeframes. Elevated reversal risk; wait for MA reclaim before entering.`;
    } else {
      entryLimit = sma20 != null ? Math.round(sma20 * 100) / 100 : null;
      entryNote = `6-month return is negative (${(tsmomReturn * 100).toFixed(1)}%) — stock is in a secular downtrend. Entry carries elevated reversal risk.`;
    }
  } else if (oversoldNow) {
    entryLimit = Math.round(price * 100) / 100;
    entryQuality = 'ideal';
    entryNote = `RSI ${rsi?.toFixed(1)} — oversold. Enter at market or limit slightly below current. Size conservatively; stop below recent low or −2×ATR.`;
  } else if (bbSqueeze) {
    const bbBuf = bbUpper != null ? Math.round(bbUpper * 1.005 * 100) / 100 : null;
    entryBreakout = bbBuf;
    entryQuality = 'ok';
    entryNote = `BB squeeze — volatility compression. Wait for close above ${bbBuf ?? 'BB upper'} with above-average volume before entering.`;
  } else if (isNew52wkHigh) {
    // Breakout setup: George & Hwang (2004)
    entryLimit = Math.round(price * 100) / 100;
    entryQuality = 'ideal';
    entryNote = `New 52wk high on elevated volume — supply overhang cleared. Breakout entry; stop below prior consolidation (−2×ATR).`;
    if (bbUpper != null) entryBreakout = Math.round(bbUpper * 100) / 100;
  } else if (sma20 != null) {
    const distPct = (price - sma20) / sma20;

    if (distPct < -0.08) {
      // Deep sell-off — price far below SMA20
      entryLimit = Math.round(price * 100) / 100;
      entryQuality = 'avoid';
      entryNote = `Price is ${(Math.abs(distPct) * 100).toFixed(1)}% below SMA20 (${sma20.toFixed(2)}) — deep sell-off. Wait for stabilisation near the MA before entering.`;
    } else if (distPct < -0.04) {
      entryLimit = Math.round(price * 100) / 100;
      entryQuality = 'ok';
      entryNote = `Price has pulled back ${(Math.abs(distPct) * 100).toFixed(1)}% below SMA20 (${sma20.toFixed(2)}). Decent dip entry; consider half-size and watch for reclaim of the MA.`;
    } else if (distPct < 0) {
      // Price right at or just below SMA20
      entryLimit = Math.round(price * 100) / 100;
      entryQuality = 'ideal';
      entryNote = `Price has pulled back to SMA20 (${sma20.toFixed(2)}) — textbook dip entry. Risk/reward is optimal; stop below recent low or −2×ATR.`;
    } else if (distPct <= 0.01) {
      entryLimit = Math.round(sma20 * 100) / 100;
      entryQuality = 'ideal';
      entryNote = `Price at SMA20 (${sma20.toFixed(2)}) — textbook pullback entry. Risk/reward is optimal.`;
    } else if (distPct <= 0.04) {
      entryLimit = Math.round(sma20 * 100) / 100;
      entryQuality = 'ok';
      entryNote = `Price is ${(distPct * 100).toFixed(1)}% above SMA20. Acceptable; consider half-size and add on dip toward ${sma20.toFixed(2)}.`;
    } else if (distPct <= 0.08) {
      entryLimit = Math.round(sma20 * 100) / 100;
      entryQuality = 'stretched';
      entryNote = `Price is ${(distPct * 100).toFixed(1)}% above SMA20 — extended. Wait for pullback to ~${sma20.toFixed(2)}.`;
    } else {
      entryLimit = Math.round(sma20 * 100) / 100;
      entryQuality = 'avoid';
      entryNote = `Price is ${(distPct * 100).toFixed(1)}% above SMA20 — overextended. High pullback risk; wait for reset to ~${sma20.toFixed(2)}.`;
    }

    if (bbUpper != null && price < bbUpper) {
      entryBreakout = Math.round(bbUpper * 100) / 100;
    }
  } else {
    if (rating === 'BUY' || rating === 'STRONG_BUY') {
      entryLimit = Math.round(price * 100) / 100;
      entryQuality = 'ok';
      entryNote = 'Insufficient history for SMA20. Enter at current price with tight stop (−2×ATR).';
    } else {
      entryNote = 'Mixed signals — no clear entry point. Wait for a clearer setup.';
    }
  }

  // ── EXITS ─────────────────────────────────────────────────────────────────
  // Static stop for new entries (2×ATR from current price)
  const suggestedStop = atr != null ? Math.round((price - 2 * atr) * 100) / 100 : null;

  // Chandelier Exit: max(close since entry) − 3×ATR(22), ratchets up with position
  let chandelierStop: number | null = null;
  if (atr22 != null) {
    let entryBarIndex = 0;
    if (options?.entryDate) {
      const entryMs = new Date(options.entryDate).getTime();
      for (let i = 0; i < bars.length; i++) {
        if (new Date(bars[i].date).getTime() >= entryMs) { entryBarIndex = i; break; }
      }
    }
    const highSinceEntry = Math.max(...bars.slice(entryBarIndex).map(b => b.close));
    const raw = highSinceEntry - 3 * atr22;
    // Only show Chandelier if it's above the static stop (otherwise it's not meaningful)
    if (raw > (suggestedStop ?? 0)) chandelierStop = Math.round(raw * 100) / 100;
  }

  // ATR-based targets from current price (replaces fixed 3%/6%)
  const tier1Target = atr != null ? Math.round((price + 1.5 * atr) * 100) / 100 : Math.round(price * 1.03 * 100) / 100;
  const tier2Target = atr != null ? Math.round((price + 3.0 * atr) * 100) / 100 : Math.round(price * 1.06 * 100) / 100;

  // ── EXECUTION QUALITY ─────────────────────────────────────────────────────
  const csSpreadPct = computeCorwinSchultzSpread(bars);

  const oversold   = oversoldNow;
  const overbought = overboughtNow;

  let rsiAge = 0;
  if (oversold) {
    for (let i = n - 1; i >= 0 && rsiArr[i] != null && (rsiArr[i] as number) < 30; i--) rsiAge++;
  } else if (overbought) {
    for (let i = n - 1; i >= 0 && rsiArr[i] != null && (rsiArr[i] as number) > 70; i--) rsiAge++;
  }

  let macdAge = 0;
  if (macdHist != null && macdHist > 0) {
    for (let i = n - 1; i >= 0 && histArr[i] != null && (histArr[i] as number) > 0; i--) macdAge++;
  } else if (macdHist != null && macdHist < 0) {
    for (let i = n - 1; i >= 0 && histArr[i] != null && (histArr[i] as number) < 0; i--) macdAge++;
  }

  let trendAge = 0;
  const trendBull = sma20 != null && sma50 != null && sma20 > sma50;
  const trendBear = sma20 != null && sma50 != null && sma20 < sma50;
  if (trendBull) {
    for (let i = n - 1; i >= 0 && sma20arr[i] != null && sma50arr[i] != null && (sma20arr[i] as number) > (sma50arr[i] as number); i--) trendAge++;
  } else if (trendBear) {
    for (let i = n - 1; i >= 0 && sma20arr[i] != null && sma50arr[i] != null && (sma20arr[i] as number) < (sma50arr[i] as number); i--) trendAge++;
  }

  let signalType: 'momentum' | 'mean_reversion' | 'neutral';
  let signalAgeBars: number;
  if (oversold || overbought) {
    signalType = 'mean_reversion';
    signalAgeBars = rsiAge;
  } else if (macdAge > 0 || trendAge > 0) {
    signalType = 'momentum';
    const ages = [macdAge, trendAge].filter(a => a > 0);
    signalAgeBars = ages.length > 0 ? Math.min(...ages) : 0;
  } else {
    signalType = 'neutral';
    signalAgeBars = 0;
  }

  const halfLife = HALF_LIVES[signalType];
  const decayPct = signalAgeBars > 0
    ? Math.max(1, Math.round(Math.pow(0.5, signalAgeBars / halfLife) * 100))
    : 100;

  // ── BETA vs SPY ───────────────────────────────────────────────────────────
  const betaVsSpy = options?.spyBars
    ? computeBeta(closes, options.spyBars.map(b => b.close))
    : null;

  // ── FEATURE VECTOR (for offline ML training) ──────────────────────────────
  // Values loosely normalized; clip outliers to [-3, 3] for gradient boosting
  const clip = (v: number, lo = -3, hi = 3) => Math.max(lo, Math.min(hi, v));
  const featureVector = [
    clip((rsi ?? 50 - 50) / 50),               // RSI centred at 50
    clip(bbPctB ?? 0.5),                        // BB %B [0,1]
    clip((macdHist ?? 0) / (atr ?? 1)),         // MACD hist / ATR (normalized)
    clip(bbBandwidth ?? 0),                     // BB bandwidth
    clip(cmf20 ?? 0),                           // CMF [-1,1]
    clip((volRatio ?? 1) - 1),                  // volume ratio deviation from 1
    clip(tsmomReturn),                          // 6M return
    clip(pth52wk ?? 0.8),                       // PTH [0,1]
    clip(rv21d ?? 0.15),                        // realized vol
    clip(betaVsSpy ?? 1),                       // beta
    clip(decayPct / 100),                       // decay [0,1]
    clip(trendScore / 100),                     // trend sub-score
    clip(momentumScore / 100),                  // momentum sub-score
    clip(volatilityScore / 100),                // volatility sub-score
    clip(volumeScore / 100),                    // volume sub-score
  ];

  // ── ROUNDING HELPERS ──────────────────────────────────────────────────────
  const round3 = (v: number | null) => v != null ? Math.round(v * 1000) / 1000 : null;
  const round2 = (v: number | null) => v != null ? Math.round(v * 100) / 100 : null;
  const round1 = (v: number | null) => v != null ? Math.round(v * 10) / 10 : null;

  return {
    ticker,
    computedAt: new Date().toISOString(),
    barsAvailable: n,
    score: finalScore,
    rating,
    trendScore:      Math.round(trendScore),
    momentumScore:   Math.round(momentumScore),
    volatilityScore: Math.round(volatilityScore),
    volumeScore:     Math.round(volumeScore),
    rsi:             round1(rsi),
    macd:            round3(macd),
    macdSignal:      round3(macdSig),
    macdHistogram:   round3(macdHist),
    sma20:           round2(sma20),
    sma50:           round2(sma50),
    bbUpper:         round2(bbUpper),
    bbMiddle:        round2(bbMiddle),
    bbLower:         round2(bbLower),
    bbBandwidth:     bbBandwidth != null ? Math.round(bbBandwidth * 1000) / 10 : null, // as %
    bbPctB:          bbPctB,
    atr:             round3(atr),
    volumeRatio:     volRatio != null ? Math.round(volRatio * 100) / 100 : null,
    goldenCross,
    deathCross,
    bbSqueeze,
    oversold,
    overbought,
    suggestedStop,
    chandelierStop,
    tier1Target,
    tier2Target,
    csSpreadPct:     csSpreadPct != null ? Math.round(csSpreadPct * 1000) / 1000 : null,
    signalType,
    signalAgeBars,
    decayPct,
    entryLimit,
    entryBreakout,
    entryQuality,
    entryNote,
    pth52wk,
    isNew52wkHigh,
    cmf20:           cmf20 != null ? Math.round(cmf20 * 1000) / 1000 : null,
    tsmomBullish,
    rv21d:           rv21d != null ? Math.round(rv21d * 1000) / 10 : null, // as %
    intraVolRegime,
    betaVsSpy,
    daysToEarnings,
    nearEarnings,
    featureVector,
  };
}
