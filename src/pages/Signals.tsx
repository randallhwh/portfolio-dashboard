import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Zap, BarChart2, Activity,
} from 'lucide-react';
import { usePortfolioStore, toBase } from '../store/portfolioStore';
import { useRegimeStore } from '../store/regimeStore';
import { computeTechnicalSignals } from '../services/technicals';
import type { TechnicalSignals, SignalRating, Holding } from '../types/portfolio';

// ─── Rating config ────────────────────────────────────────────────────────────

const RATING_CFG: Record<SignalRating, { label: string; bgCls: string; textCls: string; barCls: string }> = {
  STRONG_BUY:  { label: 'Strong Buy',  bgCls: 'bg-emerald-500/15', textCls: 'text-emerald-400', barCls: 'bg-emerald-500' },
  BUY:         { label: 'Buy',          bgCls: 'bg-green-500/15',   textCls: 'text-green-400',   barCls: 'bg-green-500'   },
  NEUTRAL:     { label: 'Neutral',      bgCls: 'bg-slate-500/15',   textCls: 'text-slate-400',   barCls: 'bg-slate-500'   },
  SELL:        { label: 'Sell',         bgCls: 'bg-amber-500/15',   textCls: 'text-amber-400',   barCls: 'bg-amber-500'   },
  STRONG_SELL: { label: 'Strong Sell',  bgCls: 'bg-red-500/15',     textCls: 'text-red-400',     barCls: 'bg-red-500'     },
};

const RATING_ORDER: SignalRating[] = ['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'];

function scoreBarCls(score: number) {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-green-500';
  if (score >= 40) return 'bg-slate-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Helper components ────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarCls(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{score}</span>
    </div>
  );
}

function ComponentBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarCls(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{score}</span>
    </div>
  );
}

function IndRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-200 font-mono">
        {value}
        {sub && <span className="text-slate-500 ml-1">{sub}</span>}
      </span>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  holding,
  sig,
  portfolioValue,
  fxRate,
}: {
  holding: Holding;
  sig: TechnicalSignals;
  portfolioValue: number;
  fxRate: number; // how many base units = 1 stock currency unit
}) {
  const price = holding.currentPrice;
  const costBasis = holding.avgCostPerShare;
  const hardStop = costBasis * 0.92; // O'Neil -8% rule
  const riskPerTrade2pct = portfolioValue * 0.02; // 2% of portfolio in base currency
  const riskPerTrade1pct = portfolioValue * 0.01;
  const stopDistBase = sig.suggestedStop != null ? (price - sig.suggestedStop) * fxRate : null;
  const shares2pct = stopDistBase != null && stopDistBase > 0
    ? Math.floor(riskPerTrade2pct / stopDistBase) : null;
  const posValue2pct = shares2pct != null ? shares2pct * price * fxRate : null;

  const macdDir = sig.macdHistogram != null
    ? (sig.macdHistogram > 0 ? '▲ Positive' : '▼ Negative')
    : '—';
  const macdColor = sig.macdHistogram != null
    ? (sig.macdHistogram > 0 ? 'text-emerald-400' : 'text-red-400')
    : 'text-slate-500';

  const priceVsSma20 = sig.sma20 != null
    ? (price > sig.sma20 ? '▲ Above' : '▼ Below')
    : '—';
  const priceVsSma50 = sig.sma50 != null
    ? (price > sig.sma50 ? '▲ Above' : '▼ Below')
    : '—';

  const fmt = (v: number | null, dp = 2) =>
    v != null ? v.toFixed(dp) : '—';

  return (
    <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-5">
      {/* Score breakdown */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Score Breakdown</p>
        <div className="space-y-1.5">
          <ComponentBar label="Trend (30%)"      score={sig.trendScore} />
          <ComponentBar label="Momentum (30%)"   score={sig.momentumScore} />
          <ComponentBar label="Volatility (15%)" score={sig.volatilityScore} />
          <ComponentBar label="Volume (15%)"     score={sig.volumeScore} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Trend & momentum indicators */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trend & Momentum</p>
          <IndRow label="RSI(14)" value={sig.rsi != null ? String(sig.rsi) : '—'}
            sub={sig.oversold ? '← oversold' : sig.overbought ? '← overbought' : undefined} />
          <IndRow label="MACD hist" value={macdDir} />
          <IndRow label={`MACD line`} value={fmt(sig.macd, 4)} />
          <IndRow label="Signal line" value={fmt(sig.macdSignal, 4)} />
          <IndRow label="SMA20" value={fmt(sig.sma20)} sub={`price ${priceVsSma20}`} />
          <IndRow label="SMA50" value={sig.sma50 != null ? fmt(sig.sma50) : 'warming up'}
            sub={sig.sma50 != null ? `price ${priceVsSma50}` : undefined} />
          {sig.goldenCross && (
            <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
              <Zap size={10} /> SMA20 crossed above SMA50
            </div>
          )}
          {sig.deathCross && (
            <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle size={10} /> SMA20 crossed below SMA50
            </div>
          )}
        </div>

        {/* Volatility & volume */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Volatility & Volume</p>
          <IndRow label="BB Upper" value={fmt(sig.bbUpper)} />
          <IndRow label="BB Middle" value={fmt(sig.bbMiddle)} />
          <IndRow label="BB Lower" value={fmt(sig.bbLower)} />
          <IndRow label="BB Width" value={sig.bbBandwidth != null ? `${fmt(sig.bbBandwidth, 1)}%` : '—'}
            sub={sig.bbSqueeze ? '← squeeze' : undefined} />
          <IndRow label="ATR(14)" value={fmt(sig.atr, 4)} />
          <IndRow label="Vol ratio" value={sig.volumeRatio != null ? `${sig.volumeRatio}×` : '—'}
            sub={sig.volumeRatio != null ? (sig.volumeRatio > 1.5 ? 'high' : sig.volumeRatio < 0.7 ? 'low' : 'avg') : undefined} />
          <IndRow label="Bars" value={`${sig.barsAvailable} days`} />
        </div>
      </div>

      {/* Entry / exit levels */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Entry / Exit Levels ({holding.currency})</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 space-y-1">
            <p className="text-xs text-slate-400">Stop Loss (ATR-based)</p>
            <p className="text-sm font-semibold text-red-400">
              {sig.suggestedStop != null ? sig.suggestedStop.toFixed(2) : '—'}
            </p>
            <p className="text-xs text-slate-500">Entry − 2×ATR</p>
            <p className="text-xs text-slate-500 mt-1">O'Neil rule: {hardStop.toFixed(2)} (−8% cost)</p>
          </div>
          <div className="space-y-1.5">
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Target 1 (sell ⅓)</p>
              <p className="text-sm font-semibold text-emerald-400">
                {sig.tier1Target != null ? sig.tier1Target.toFixed(2) : '—'}
                <span className="text-xs text-slate-500 ml-1">+3%</span>
              </p>
            </div>
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Target 2 (sell ⅓)</p>
              <p className="text-sm font-semibold text-emerald-400">
                {sig.tier2Target != null ? sig.tier2Target.toFixed(2) : '—'}
                <span className="text-xs text-slate-500 ml-1">+6%</span>
              </p>
            </div>
            <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Trailing (last ⅓)</p>
              <p className="text-xs text-slate-300">−10% trailing from peak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Position sizing */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Position Sizing</p>
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-1.5 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Risk 1% of portfolio</span>
            <span className="text-slate-200 font-mono">{riskPerTrade1pct.toFixed(0)} (base)</span>
          </div>
          <div className="flex justify-between">
            <span>Risk 2% of portfolio</span>
            <span className="text-slate-200 font-mono">{riskPerTrade2pct.toFixed(0)} (base)</span>
          </div>
          {sig.suggestedStop != null && (
            <div className="flex justify-between">
              <span>Stop distance (2×ATR)</span>
              <span className="text-slate-200 font-mono">{(price - sig.suggestedStop).toFixed(3)} {holding.currency}</span>
            </div>
          )}
          {shares2pct != null && (
            <>
              <div className="border-t border-slate-700 pt-1.5 flex justify-between">
                <span>Max shares (2% risk rule)</span>
                <span className="text-slate-200 font-mono">{shares2pct.toLocaleString()} shares</span>
              </div>
              <div className="flex justify-between">
                <span>Position value</span>
                <span className="text-slate-200 font-mono">≈ {posValue2pct?.toFixed(0)} (base)</span>
              </div>
            </>
          )}
          <p className="pt-1 text-slate-500 border-t border-slate-700">
            Conservative: 1% risk · Moderate: 2% risk · Cap any single position at 5% of portfolio.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({
  holding,
  sig,
  isSelected,
  onSelect,
  portfolioValue,
  fxRate,
}: {
  holding: Holding;
  sig: TechnicalSignals;
  isSelected: boolean;
  onSelect: () => void;
  portfolioValue: number;
  fxRate: number;
}) {
  const cfg = RATING_CFG[sig.rating];
  const gainPct = ((holding.currentPrice - holding.avgCostPerShare) / holding.avgCostPerShare) * 100;

  const macdBull = sig.macdHistogram != null && sig.macdHistogram > 0;
  const trendOk  = sig.sma20 != null && holding.currentPrice > sig.sma20;

  return (
    <div className="space-y-0">
      <button
        onClick={onSelect}
        className={`w-full text-left rounded-xl border transition-all p-4 ${
          isSelected
            ? 'bg-slate-800 border-blue-500/50'
            : 'bg-slate-900/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">{holding.ticker}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{holding.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-100">
              {holding.currentPrice.toFixed(holding.currentPrice < 10 ? 3 : 2)}
            </p>
            <p className={`text-xs font-medium ${gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Score bar */}
        <ScoreBar score={sig.score} />

        {/* Quick indicators */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-slate-500">RSI</p>
            <p className={`font-mono font-semibold ${
              sig.oversold ? 'text-emerald-400' : sig.overbought ? 'text-red-400' : 'text-slate-300'
            }`}>
              {sig.rsi != null ? sig.rsi : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500">MACD</p>
            <p className={`font-semibold ${macdBull ? 'text-emerald-400' : 'text-red-400'}`}>
              {sig.macd != null ? (macdBull ? '▲' : '▼') : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500">Trend</p>
            <p className={`font-semibold ${trendOk ? 'text-emerald-400' : 'text-red-400'}`}>
              {sig.sma20 != null ? (trendOk ? '✓' : '✗') : '—'}
            </p>
          </div>
        </div>

        {/* Flags */}
        {(sig.oversold || sig.overbought || sig.bbSqueeze || sig.goldenCross || sig.deathCross) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sig.oversold    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Oversold</span>}
            {sig.overbought  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Overbought</span>}
            {sig.bbSqueeze   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">BB Squeeze</span>}
            {sig.goldenCross && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">↑ MA Cross</span>}
            {sig.deathCross  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">↓ MA Cross</span>}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-1 text-slate-600">
          {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span className="text-[10px]">details</span>
        </div>
      </button>

      {isSelected && (
        <DetailPanel holding={holding} sig={sig} portfolioValue={portfolioValue} fxRate={fxRate} />
      )}
    </div>
  );
}

// ─── Regime description ───────────────────────────────────────────────────────

const REGIME_RULES: Record<string, { stops: string; size: string; strategy: string; color: string }> = {
  GOLDILOCKS:     { stops: '−10 to −12%', size: '2% risk / trade',  strategy: 'Trend-following; let winners run', color: 'text-emerald-400' },
  REFLATION:      { stops: '−6 to −8%',   size: '1.5% risk / trade', strategy: 'Prefer commodity & value; take profits faster', color: 'text-yellow-400' },
  STAGFLATION:    { stops: '−4 to −5%',   size: '0.5% risk / trade', strategy: 'Defensive only; mean-reversion bounces', color: 'text-amber-400' },
  RECESSION:      { stops: '−3%',          size: '0.5% risk / trade', strategy: 'Capital preservation; oversold bounces only', color: 'text-red-400' },
  RISK_OFF_SPIKE: { stops: 'Move to breakeven', size: 'Reduce 50%', strategy: 'No new entries; raise cash', color: 'text-red-500' },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function Signals() {
  const { holdings, ohlcvData, settings, exchangeRates, fetchLivePrices, priceStatus, getTotalValue } = usePortfolioStore();
  const { analysis, confirmedRegime } = useRegimeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'ticker' | 'gain'>('score');

  // Bridgewater regime: live detection takes priority over manual setting
  const bridgewaterRegime: string | undefined =
    analysis?.bridgewater?.regime ?? settings.marketRegime ?? undefined;

  const volRegime = analysis?.volatility?.regime;

  // Holdings eligible for technical signals (exclude cash)
  const signalHoldings = useMemo(
    () => holdings.filter(h => h.assetClass !== 'cash'),
    [holdings]
  );

  // Compute signals (memoised; recomputes when OHLCV data or regime changes)
  const signals = useMemo(() => {
    const result: Record<string, TechnicalSignals> = {};
    for (const h of signalHoldings) {
      const bars = ohlcvData[h.ticker];
      if (bars && bars.length >= 20) {
        result[h.ticker] = computeTechnicalSignals(bars, h.ticker, bridgewaterRegime);
      }
    }
    return result;
  }, [ohlcvData, signalHoldings, bridgewaterRegime]);

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<SignalRating, number> = { STRONG_BUY: 0, BUY: 0, NEUTRAL: 0, SELL: 0, STRONG_SELL: 0 };
    Object.values(signals).forEach(s => c[s.rating]++);
    return c;
  }, [signals]);

  const portfolioValue = getTotalValue();

  // Sort
  const sorted = useMemo(() => {
    return [...signalHoldings].sort((a, b) => {
      const sa = signals[a.ticker];
      const sb = signals[b.ticker];
      if (sortBy === 'score') {
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        return sb.score - sa.score;
      }
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker);
      if (sortBy === 'gain') {
        const ga = (a.currentPrice - a.avgCostPerShare) / a.avgCostPerShare;
        const gb = (b.currentPrice - b.avgCostPerShare) / b.avgCostPerShare;
        return gb - ga;
      }
      return 0;
    });
  }, [signalHoldings, signals, sortBy]);

  const hasAnySignals = Object.keys(signals).length > 0;
  const regimeRules = bridgewaterRegime ? REGIME_RULES[bridgewaterRegime] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity size={20} className="text-blue-400" />
            Entry / Exit Signals
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Technical analysis for non-cash holdings · 6-month daily data
          </p>
        </div>
        <button
          onClick={() => fetchLivePrices()}
          disabled={priceStatus === 'loading'}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={priceStatus === 'loading' ? 'animate-spin' : ''} />
          Refresh prices
        </button>
      </div>

      {/* Regime banner */}
      {bridgewaterRegime && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Regime
                </span>
                {analysis ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Live</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Manual</span>
                )}
              </div>
              <p className={`text-lg font-bold ${regimeRules?.color ?? 'text-slate-300'}`}>
                {bridgewaterRegime}
                {confirmedRegime !== bridgewaterRegime && analysis && (
                  <span className="text-xs font-normal text-slate-500 ml-2">(unconfirmed)</span>
                )}
              </p>
              {volRegime && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Volatility regime: <span className="text-slate-300">{volRegime}</span>
                  {(volRegime === 'HIGH' || volRegime === 'CRISIS') && (
                    <span className="text-amber-400 ml-2">· Reduce position sizes 30–50%</span>
                  )}
                </p>
              )}
            </div>
            {regimeRules && (
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 mb-0.5">Stops</p>
                  <p className="text-slate-200">{regimeRules.stops}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Position size</p>
                  <p className="text-slate-200">{regimeRules.size}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Strategy</p>
                  <p className="text-slate-200">{regimeRules.strategy}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasAnySignals && (
        <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-8 text-center">
          <BarChart2 size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No signal data yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Click <span className="text-slate-300">Refresh prices</span> to fetch 6-month OHLCV data and compute signals.
          </p>
        </div>
      )}

      {hasAnySignals && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-2">
            {RATING_ORDER.map(r => (
              <div key={r} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${RATING_CFG[r].bgCls} ${RATING_CFG[r].textCls}`}>
                <span className="text-base leading-none">
                  {r === 'STRONG_BUY' ? '↑↑' : r === 'BUY' ? '↑' : r === 'NEUTRAL' ? '—' : r === 'SELL' ? '↓' : '↓↓'}
                </span>
                <span>{counts[r]}</span>
                <span className="text-xs opacity-75">{RATING_CFG[r].label}</span>
              </div>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort:</span>
            {(['score', 'ticker', 'gain'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  sortBy === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'score' ? 'Signal Score' : s === 'ticker' ? 'Ticker' : 'P&L'}
              </button>
            ))}
          </div>

          {/* Signal cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map(h => {
              const sig = signals[h.ticker];
              if (!sig) {
                return (
                  <div key={h.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-slate-300">{h.ticker}</span>
                      <span className="text-xs text-slate-600">{h.currency}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      Insufficient data — refresh prices
                    </p>
                  </div>
                );
              }

              // FX rate: how many base units = 1 stock currency unit
              const fxRate = h.currency === settings.baseCurrency
                ? 1
                : toBase(1, h.currency, exchangeRates, settings.baseCurrency);

              return (
                <SignalCard
                  key={h.id}
                  holding={h}
                  sig={sig}
                  isSelected={selectedId === h.id}
                  onSelect={() => setSelectedId(selectedId === h.id ? null : h.id)}
                  portfolioValue={portfolioValue}
                  fxRate={fxRate}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Signal Methodology</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
              <div>
                <p className="text-slate-400 font-medium mb-1">Trend (30%)</p>
                <p>SMA20 vs SMA50 alignment · price position relative to moving averages</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-1">Momentum (30%)</p>
                <p>MACD(12,26,9) crossover & histogram · RSI(14) Wilder smoothing</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-1">Volatility (15%)</p>
                <p>Bollinger Bands(20,2σ) · bandwidth squeeze detection</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-1">Volume (15%)</p>
                <p>Volume ratio vs 20-day avg · OBV trend (on-balance volume)</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Scores are regime-adjusted: regime multiplier pulls composite toward neutral (50) in adverse regimes.
              SMA200 requires 200 days of data — only 6 months (~126 bars) available; SMA20/50 cross used as proxy.
              Signals are informational only — not financial advice.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
