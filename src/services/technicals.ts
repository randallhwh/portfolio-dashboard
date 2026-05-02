import type { OHLCVBar, TechnicalSignals, SignalRating } from '../types/portfolio';

// --- Indicator helpers ---

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

// --- Regime multipliers ---
// Pulls the composite score toward neutral (50) rather than raw multiplication,
// so signals are dampened in bearish regimes without flipping polarity.
const REGIME_MULTIPLIERS: Record<string, number> = {
  GOLDILOCKS:     1.00,
  REFLATION:      0.85,
  STAGFLATION:    0.60,
  RECESSION:      0.40,
  RISK_OFF_SPIKE: 0.00,
};

export function computeTechnicalSignals(
  bars: OHLCVBar[],
  ticker: string,
  regime?: string,
): TechnicalSignals {
  const n = bars.length;
  const closes = bars.map(b => b.close);
  const price = closes[n - 1];

  const sma20arr = computeSMA(closes, 20);
  const sma50arr = computeSMA(closes, 50);
  const rsiArr   = computeRSI(closes, 14);
  const { macd: macdArr, signal: signalArr, histogram: histArr } = computeMACD(closes);
  const { upper: bbUp, middle: bbMid, lower: bbLow, bandwidth: bbBW } = computeBollingerBands(closes);
  const atrArr  = computeATR(bars);
  const obvArr  = computeOBV(bars);
  const volSma  = computeSMA(bars.map(b => b.volume), 20);

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
  const obvLatest  = obvArr[n - 1];
  const obvSmaArr  = computeSMA(obvArr, 20);
  const obvSma     = obvSmaArr[n - 1];
  const volAvg     = volSma[n - 1];
  const volRatio   = volAvg != null && volAvg > 0 ? bars[n - 1].volume / volAvg : null;

  // ── TREND SCORE (30%) ──────────────────────────────────────────────────────
  let trendScore = 50;
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50 && price > sma20) trendScore = 85;
    else if (sma20 > sma50 && price < sma20) trendScore = 60; // pullback in uptrend
    else if (sma20 < sma50 && price > sma20) trendScore = 40; // bounce in downtrend
    else trendScore = 15;                                      // sma20 < sma50, price < sma20
  } else if (sma20 != null) {
    trendScore = price > sma20 ? 65 : 35;
  }

  // SMA20 crossing SMA50 (proxy for golden/death cross with 6-month data window)
  const goldenCross = sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
    && sma20 > sma50 && sma20Prev <= sma50Prev;
  const deathCross  = sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
    && sma20 < sma50 && sma20Prev >= sma50Prev;

  if (goldenCross) trendScore = Math.min(100, trendScore + 12);
  if (deathCross)  trendScore = Math.max(0,   trendScore - 12);

  // ── MOMENTUM SCORE (30%) ───────────────────────────────────────────────────
  let macdScore = 50;
  if (macd != null && macdSig != null && macdHist != null) {
    if (macd > macdSig && macd > 0)
      macdScore = (macdHistP != null && macdHist > macdHistP) ? 95 : 75;
    else if (macd > macdSig && macd <= 0) macdScore = 45;
    else if (macd < macdSig && macdHist > 0) macdScore = 30;
    else macdScore = 10;
  }

  let rsiScore = 50;
  if (rsi != null) {
    if (rsi >= 50 && rsi < 70)      rsiScore = 85;
    else if (rsi >= 40 && rsi < 50) rsiScore = 65;
    else if (rsi >= 30 && rsi < 40) rsiScore = 45;
    else if (rsi < 30)              rsiScore = 35; // oversold — potential reversal
    else                            rsiScore = 25; // overbought > 70
  }

  const momentumScore = macdScore * 0.6 + rsiScore * 0.4;

  // ── VOLATILITY SCORE (15%) ─────────────────────────────────────────────────
  let volatilityScore = 50;
  if (bbUpper != null && bbMiddle != null && bbLower != null) {
    if (price > bbUpper)      volatilityScore = 20; // overbought extreme
    else if (price < bbLower) volatilityScore = 80; // oversold extreme — reversal potential
    else if (price < bbMiddle) volatilityScore = 65;
    else                       volatilityScore = 55;
  }
  const bbSqueeze = bbBandwidth != null && bbBandwidth < 0.04;
  if (bbSqueeze) volatilityScore = Math.min(100, volatilityScore + 15);

  // ── VOLUME SCORE (15%) ─────────────────────────────────────────────────────
  let volumeScore = 50;
  if (volRatio != null) {
    if (volRatio > 2.0)       volumeScore = 90;
    else if (volRatio > 1.5)  volumeScore = 75;
    else if (volRatio > 1.0)  volumeScore = 50;
    else if (volRatio > 0.7)  volumeScore = 35;
    else                      volumeScore = 15;
  }
  if (obvSma != null) {
    if (obvLatest > obvSma) volumeScore = Math.min(100, volumeScore + 15);
    else                    volumeScore = Math.max(0,   volumeScore - 15);
  }

  // ── COMPOSITE (weights sum to 0.90; regime factor accounts for remaining 0.10) ──
  const rawScore = trendScore * 0.30 + momentumScore * 0.30 + volatilityScore * 0.15 + volumeScore * 0.15;

  // Pull score toward 50 in adverse regimes, rather than directly multiplying
  // (so RECESSION: score of 75 becomes 50+(75-50)*0.4=60, not 75*0.4=30)
  const mult = regime && REGIME_MULTIPLIERS[regime] !== undefined ? REGIME_MULTIPLIERS[regime] : 1.0;
  const finalScore = Math.round(Math.max(0, Math.min(100, 50 + (rawScore - 50) * mult)));

  let rating: SignalRating;
  if (finalScore >= 75)      rating = 'STRONG_BUY';
  else if (finalScore >= 60) rating = 'BUY';
  else if (finalScore >= 40) rating = 'NEUTRAL';
  else if (finalScore >= 25) rating = 'SELL';
  else                       rating = 'STRONG_SELL';

  const round3 = (v: number | null) => v != null ? Math.round(v * 1000) / 1000 : null;
  const round2 = (v: number | null) => v != null ? Math.round(v * 100) / 100 : null;
  const round1 = (v: number | null) => v != null ? Math.round(v * 10) / 10 : null;

  return {
    ticker,
    computedAt: new Date().toISOString(),
    barsAvailable: n,
    score: finalScore,
    rating,
    trendScore:     Math.round(trendScore),
    momentumScore:  Math.round(momentumScore),
    volatilityScore: Math.round(volatilityScore),
    volumeScore:    Math.round(volumeScore),
    rsi:            round1(rsi),
    macd:           round3(macd),
    macdSignal:     round3(macdSig),
    macdHistogram:  round3(macdHist),
    sma20:          round2(sma20),
    sma50:          round2(sma50),
    bbUpper:        round2(bbUpper),
    bbMiddle:       round2(bbMiddle),
    bbLower:        round2(bbLower),
    bbBandwidth:    bbBandwidth != null ? Math.round(bbBandwidth * 1000) / 10 : null, // as %
    atr:            round3(atr),
    volumeRatio:    volRatio != null ? Math.round(volRatio * 100) / 100 : null,
    goldenCross,
    deathCross,
    bbSqueeze,
    oversold:   rsi != null && rsi < 30,
    overbought: rsi != null && rsi > 70,
    suggestedStop:  atr != null ? round2(price - 2 * atr) : null,
    tier1Target:    round2(price * 1.03),
    tier2Target:    round2(price * 1.06),
  };
}
