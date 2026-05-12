import type { OHLCVBar } from '../types/portfolio';

export interface QuoteResult {
  symbol: string;
  price: number;
  currency: string;
  name?: string;
  dividendYieldPct?: number;
  prev1d?: number;   // previous trading day close
  prev7d?: number;   // ~7 calendar days ago close
  prev30d?: number;  // ~30 calendar days ago close
  prevYtd?: number;  // first trading day of the current calendar year
  ohlcv?: OHLCVBar[]; // full 6-month daily bars for technical analysis
}

// FX symbols: how many USD = 1 unit of this currency
export const FX_SYMBOLS: Record<string, string> = {
  SGD: 'SGDUSD=X',
  JPY: 'JPYUSD=X',
  HKD: 'HKDUSD=X',
  CNY: 'CNHUSD=X',
  EUR: 'EURUSD=X',
  GBP: 'GBPUSD=X',
  AUD: 'AUDUSD=X',
  CAD: 'CADUSD=X',
};

function findClosestPrice(
  timestamps: number[],
  closes: (number | null)[],
  targetTs: number
): number | undefined {
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const diff = Math.abs(timestamps[i] - targetTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? (closes[bestIdx] as number) : undefined;
}

async function fetchSingle(symbol: string): Promise<QuoteResult | null> {
  try {
    // 6 months of daily data covers 1d / 7d / 30d and YTD (Jan 1 of current year)
    const url = `/api/yf/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice) return null;

    const rawYield = meta.trailingAnnualDividendYield;
    const dividendYieldPct =
      typeof rawYield === 'number' && rawYield > 0 ? rawYield * 100 : undefined;

    const timestamps: number[] = result.timestamp ?? [];
    const quote0 = result.indicators?.quote?.[0] ?? {};
    const closes: (number | null)[] = quote0.close ?? [];
    const opens:  (number | null)[] = quote0.open  ?? [];
    const highs:  (number | null)[] = quote0.high  ?? [];
    const lows:   (number | null)[] = quote0.low   ?? [];
    const vols:   (number | null)[] = quote0.volume ?? [];
    const now = Date.now() / 1000;

    const ohlcv: OHLCVBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
      if (o == null || h == null || l == null || c == null) continue;
      ohlcv.push({
        date:   new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        open:   o,
        high:   h,
        low:    l,
        close:  c,
        volume: (vols[i] ?? 0) as number,
      });
    }

    const yearStartTs = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;

    const prev1d: number | undefined = meta.chartPreviousClose ?? meta.previousClose ?? undefined;
    const prev7d  = findClosestPrice(timestamps, closes, now - 7  * 86400);
    const prev30d = findClosestPrice(timestamps, closes, now - 30 * 86400);
    const prevYtd = findClosestPrice(timestamps, closes, yearStartTs);

    return {
      symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency ?? 'USD',
      name: meta.longName ?? meta.shortName,
      dividendYieldPct,
      prev1d,
      prev7d,
      prev30d,
      prevYtd,
      ohlcv: ohlcv.length > 0 ? ohlcv : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const unique = [...new Set(symbols)];
  const results = await Promise.allSettled(unique.map(fetchSingle));
  return results
    .filter((r): r is PromiseFulfilledResult<QuoteResult> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

// ─── Fundamentals: short interest + earnings ─────────────────────────────────

export interface FundamentalsData {
  ticker: string;
  shortPctFloat: number | null;         // short interest as % of float (0–1 scale)
  nextEarningsDate: string | null;      // ISO date of next (or most recent) earnings
  lastEarningsSurprisePct: number | null; // (actual − estimate) / |estimate| × 100
}

async function fetchSingleFundamentals(ticker: string): Promise<FundamentalsData | null> {
  try {
    const modules = 'defaultKeyStatistics%2CcalendarEvents%2CearningsHistory';
    const url = `/api/yf/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return null;

    // Short interest
    const shortPctFloat: number | null = result.defaultKeyStatistics?.shortPercentOfFloat?.raw ?? null;

    // Next earnings date (closest future date, or most recent past)
    let nextEarningsDate: string | null = null;
    const earningsDates = result.calendarEvents?.earnings?.earningsDate as { raw: number }[] | undefined;
    if (earningsDates && earningsDates.length > 0) {
      const nowSec = Date.now() / 1000;
      const sorted = [...earningsDates].sort((a, b) => a.raw - b.raw);
      // Prefer future date; fall back to most recent past (within 14 days)
      const future = sorted.find(d => d.raw > nowSec - 7 * 86400);
      if (future) nextEarningsDate = new Date(future.raw * 1000).toISOString().split('T')[0];
    }

    // Last earnings surprise
    let lastEarningsSurprisePct: number | null = null;
    const history = result.earningsHistory?.history as { epsActual?: { raw: number }; epsEstimate?: { raw: number } }[] | undefined;
    if (history && history.length > 0) {
      const last = history[history.length - 1];
      const actual = last?.epsActual?.raw;
      const estimate = last?.epsEstimate?.raw;
      if (actual != null && estimate != null && estimate !== 0) {
        lastEarningsSurprisePct = Math.round(((actual - estimate) / Math.abs(estimate)) * 1000) / 10;
      }
    }

    return { ticker, shortPctFloat, nextEarningsDate, lastEarningsSurprisePct };
  } catch {
    return null;
  }
}

export async function fetchFundamentals(tickers: string[]): Promise<FundamentalsData[]> {
  const unique = [...new Set(tickers)];
  const results = await Promise.allSettled(unique.map(fetchSingleFundamentals));
  return results
    .filter((r): r is PromiseFulfilledResult<FundamentalsData> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}
