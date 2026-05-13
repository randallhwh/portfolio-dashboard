import { useState, useMemo, useRef } from 'react';
import {
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Zap, BarChart2, Activity, Plus, X, Loader2, LineChart,
  TrendingUp,
} from 'lucide-react';
import { usePortfolioStore, toBase } from '../store/portfolioStore';
import { useRegimeStore } from '../store/regimeStore';
import { computeTechnicalSignals, computeDailySentiment } from '../services/technicals';
import { ChartModal } from '../components/signals/ChartModal';
import type { TechnicalSignals, SignalRating, DailySentiment, Holding, WatchlistEntry, OHLCVBar } from '../types/portfolio';

type ChartEntry = { ticker: string; name: string; currency: string; bars: OHLCVBar[]; sig: TechnicalSignals };

// ─── Shared rating config ─────────────────────────────────────────────────────

const RATING_CFG: Record<SignalRating, { label: string; bgCls: string; textCls: string }> = {
  STRONG_BUY:  { label: 'Strong Buy',  bgCls: 'bg-emerald-500/15', textCls: 'text-emerald-400' },
  BUY:         { label: 'Buy',          bgCls: 'bg-green-500/15',   textCls: 'text-green-400'   },
  NEUTRAL:     { label: 'Neutral',      bgCls: 'bg-slate-500/15',   textCls: 'text-slate-400'   },
  SELL:        { label: 'Sell',         bgCls: 'bg-amber-500/15',   textCls: 'text-amber-400'   },
  STRONG_SELL: { label: 'Strong Sell',  bgCls: 'bg-red-500/15',     textCls: 'text-red-400'     },
};

const RATING_ORDER: SignalRating[] = ['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'];

const DAILY_CFG: Record<DailySentiment['label'], {
  label: string; dotCls: string; bgCls: string; textCls: string; barCls: string;
}> = {
  bullish:      { label: 'Bullish',   dotCls: 'bg-emerald-400', bgCls: 'bg-emerald-500/15', textCls: 'text-emerald-400', barCls: 'bg-emerald-500' },
  lean_bullish: { label: 'Lean Buy',  dotCls: 'bg-green-400',   bgCls: 'bg-green-500/15',   textCls: 'text-green-400',   barCls: 'bg-green-500'   },
  neutral:      { label: 'Neutral',   dotCls: 'bg-slate-400',   bgCls: 'bg-slate-700/60',   textCls: 'text-slate-400',   barCls: 'bg-slate-500'   },
  lean_bearish: { label: 'Lean Sell', dotCls: 'bg-amber-400',   bgCls: 'bg-amber-500/15',   textCls: 'text-amber-400',   barCls: 'bg-amber-500'   },
  bearish:      { label: 'Bearish',   dotCls: 'bg-red-400',     bgCls: 'bg-red-500/15',     textCls: 'text-red-400',     barCls: 'bg-red-500'     },
};

function DailyPulseBadge({ ds }: { ds: DailySentiment | undefined }) {
  if (!ds) return null;
  const c = DAILY_CFG[ds.label];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${c.bgCls} ${c.textCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotCls}`} />
      {c.label}
    </span>
  );
}

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
        <div className={`h-full rounded-full transition-all ${scoreBarCls(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{score}</span>
    </div>
  );
}

function ComponentBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarCls(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{score}</span>
    </div>
  );
}

function IndRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'amber' }) {
  const hlCls = highlight === 'green' ? 'text-emerald-400' : highlight === 'red' ? 'text-red-400' : highlight === 'amber' ? 'text-amber-400' : 'text-slate-200';
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-mono ${hlCls}`}>
        {value}
        {sub && <span className="text-slate-500 ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function spreadTier(pct: number | null): { cls: string; label: string } {
  if (pct == null) return { cls: 'bg-slate-700/40 text-slate-500', label: '— bps' };
  const bps = pct * 100;
  if (pct < 0.05) return { cls: 'bg-emerald-500/15 text-emerald-400', label: `${bps.toFixed(1)} bps · Liquid` };
  if (pct < 0.20) return { cls: 'bg-amber-500/15 text-amber-400',   label: `${bps.toFixed(1)} bps · Moderate` };
  return            { cls: 'bg-red-500/15 text-red-400',             label: `${bps.toFixed(1)} bps · Wide` };
}

function decayCls(pct: number) {
  if (pct >= 70) return 'text-emerald-400';
  if (pct >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function decayBarCls(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function cmfLabel(cmf: number | null): { text: string; cls: string } {
  if (cmf == null) return { text: '—', cls: 'text-slate-500' };
  if (cmf > 0.15)  return { text: `${cmf.toFixed(3)} ↑ Accumulating`, cls: 'text-emerald-400' };
  if (cmf > 0.05)  return { text: `${cmf.toFixed(3)} ↑ Mild inflow`,  cls: 'text-green-400' };
  if (cmf < -0.15) return { text: `${cmf.toFixed(3)} ↓ Distributing`, cls: 'text-red-400' };
  if (cmf < -0.05) return { text: `${cmf.toFixed(3)} ↓ Mild outflow`, cls: 'text-amber-400' };
  return { text: `${cmf.toFixed(3)} Neutral`, cls: 'text-slate-400' };
}

function volRegimeBadge(r: TechnicalSignals['intraVolRegime']) {
  if (r === 'low')  return { label: 'Low-vol trending', cls: 'bg-emerald-500/15 text-emerald-400' };
  if (r === 'high') return { label: 'High-vol regime',  cls: 'bg-red-500/15 text-red-400' };
  return                   { label: 'Normal vol',       cls: 'bg-slate-700/60 text-slate-400' };
}

function shortFlag(pct: number | null): { badge: string | null; cls: string } {
  if (pct == null || pct < 0.20) return { badge: null, cls: '' };
  if (pct > 0.30) return { badge: `⚠ ${(pct * 100).toFixed(0)}% short float`, cls: 'bg-red-500/15 text-red-400' };
  return                 { badge: `${(pct * 100).toFixed(0)}% short float`,    cls: 'bg-amber-500/15 text-amber-400' };
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  currency,
  currentPrice,
  avgCostPerShare,
  sig,
  portfolioValue,
  fxRate,
  csRank,
  csTotal,
  dailySentiment,
}: {
  ticker: string;
  currency: string;
  currentPrice: number;
  avgCostPerShare?: number;
  sig: TechnicalSignals;
  portfolioValue: number;
  fxRate: number;
  csRank?: number;
  csTotal?: number;
  dailySentiment?: DailySentiment;
}) {
  const hardStop = avgCostPerShare != null ? avgCostPerShare * 0.92 : null;
  const riskPerTrade2pct = portfolioValue * 0.02;
  const riskPerTrade1pct = portfolioValue * 0.01;

  // Vol-scaled position size: target 0.3% daily vol contribution per position
  const dailyVol = sig.rv21d != null ? (sig.rv21d / 100) / Math.sqrt(252) : null;
  const targetDailyVol = 0.003;
  const volScaleMultiplier = dailyVol != null && dailyVol > 0 ? targetDailyVol / dailyVol : null;

  const stopForSizing = sig.chandelierStop ?? sig.suggestedStop;
  const stopDistBase  = stopForSizing != null ? (currentPrice - stopForSizing) * fxRate : null;
  const shares2pct    = stopDistBase != null && stopDistBase > 0 ? Math.floor(riskPerTrade2pct / stopDistBase) : null;
  const posValue2pct  = shares2pct != null ? shares2pct * currentPrice * fxRate : null;

  const macdDir    = sig.macdHistogram != null ? (sig.macdHistogram > 0 ? '▲ Positive' : '▼ Negative') : '—';
  const priceVsSma20 = sig.sma20 != null ? (currentPrice > sig.sma20 ? '▲ Above' : '▼ Below') : '—';
  const priceVsSma50 = sig.sma50 != null ? (currentPrice > sig.sma50 ? '▲ Above' : '▼ Below') : '—';
  const fmt = (v: number | null, dp = 2) => v != null ? v.toFixed(dp) : '—';
  const vrBadge = volRegimeBadge(sig.intraVolRegime);
  const cmfInfo = cmfLabel(sig.cmf20);

  return (
    <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-5">

      {/* ── Earnings warning ─────────────────────────────────────────────── */}
      {sig.nearEarnings && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-300">
            <span className="font-semibold">Earnings event {sig.daysToEarnings != null && sig.daysToEarnings >= 0 ? `in ${sig.daysToEarnings}d` : 'recently'}</span>
            {' — '} binary risk. Signals may be unreliable across the event window.
          </div>
        </div>
      )}

      {/* ── Score breakdown ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Score Breakdown</p>
          <div className="flex items-center gap-2">
            {csRank != null && csTotal != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                #{csRank} of {csTotal} · 6M RS
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${vrBadge.cls}`}>{vrBadge.label}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <ComponentBar label={`Trend${!sig.tsmomBullish ? ' ⊘gated' : ''} (30%)`}  score={sig.trendScore} />
          <ComponentBar label={`Momentum${!sig.tsmomBullish ? ' ⊘gated' : ''} (30%)`} score={sig.momentumScore} />
          <ComponentBar label="Volatility (15%)" score={sig.volatilityScore} />
          <ComponentBar label="Volume (15%)"     score={sig.volumeScore} />
        </div>
        {!sig.tsmomBullish && (
          <p className="mt-1.5 text-[10px] text-amber-400/80">
            ⊘ Trend & momentum scores capped at neutral — 6M return is negative (TSMOM gate).
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* ── Trend & Momentum ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trend & Momentum</p>
          <IndRow label="6M return (TSMOM)"
            value={`${(((sig.featureVector[6] ?? 0)) * 100).toFixed(1)}%`}
            highlight={sig.tsmomBullish ? 'green' : 'red'}
          />
          <IndRow label="RSI(14)" value={sig.rsi != null ? String(sig.rsi) : '—'}
            sub={sig.oversold ? '← oversold' : sig.overbought ? '← overbought' : undefined}
            highlight={sig.oversold ? 'green' : sig.overbought ? 'red' : undefined}
          />
          <IndRow label="MACD hist" value={macdDir}
            highlight={sig.macdHistogram != null ? (sig.macdHistogram > 0 ? 'green' : 'red') : undefined}
          />
          <IndRow label="SMA20" value={fmt(sig.sma20)} sub={`price ${priceVsSma20}`} />
          <IndRow label="SMA50" value={sig.sma50 != null ? fmt(sig.sma50) : 'warming up'}
            sub={sig.sma50 != null ? `price ${priceVsSma50}` : undefined} />
          <IndRow label="52wk high ratio"
            value={sig.pth52wk != null ? `${(sig.pth52wk * 100).toFixed(1)}%` : '—'}
            highlight={sig.isNew52wkHigh ? 'green' : sig.pth52wk != null && sig.pth52wk < 0.70 ? 'red' : undefined}
            sub={sig.isNew52wkHigh ? '← new high' : undefined}
          />
          {sig.betaVsSpy != null && (
            <IndRow label="Beta vs SPY"
              value={sig.betaVsSpy.toFixed(2)}
              sub={sig.betaVsSpy < 0.7 ? '← low beta' : sig.betaVsSpy > 1.5 ? '← high beta' : undefined}
              highlight={sig.betaVsSpy > 1.5 ? 'amber' : undefined}
            />
          )}
          {sig.goldenCross && <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1"><Zap size={10} /> SMA20 crossed above SMA50</p>}
          {sig.deathCross  && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> SMA20 crossed below SMA50</p>}
        </div>

        {/* ── Volatility & Volume ───────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Volatility & Volume</p>
          <IndRow label="BB %B" value={sig.bbPctB != null ? sig.bbPctB.toFixed(3) : '—'}
            sub={sig.bbPctB != null ? (sig.bbPctB > 0.8 ? '← near upper' : sig.bbPctB < 0.2 ? '← near lower' : '') : undefined}
            highlight={sig.bbPctB != null ? (sig.bbPctB > 0.8 ? 'red' : sig.bbPctB < 0.2 ? 'green' : undefined) : undefined}
          />
          <IndRow label="BB Upper"  value={fmt(sig.bbUpper)} />
          <IndRow label="BB Lower"  value={fmt(sig.bbLower)} />
          <IndRow label="BB Width"  value={sig.bbBandwidth != null ? `${fmt(sig.bbBandwidth, 1)}%` : '—'}
            sub={sig.bbSqueeze ? '← squeeze' : undefined} />
          <IndRow label="ATR(14)"   value={fmt(sig.atr, 4)} />
          <IndRow label="Realized vol" value={sig.rv21d != null ? `${sig.rv21d.toFixed(1)}%` : '—'}
            sub="21d ann."
            highlight={sig.intraVolRegime === 'high' ? 'red' : sig.intraVolRegime === 'low' ? 'green' : undefined}
          />
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-xs text-slate-500">CMF(20)</span>
            <span className={`text-xs font-mono ${cmfInfo.cls}`}>{cmfInfo.text}</span>
          </div>
          <IndRow label="Vol ratio" value={sig.volumeRatio != null ? `${sig.volumeRatio}×` : '—'}
            sub={sig.volumeRatio != null ? (sig.volumeRatio > 1.5 ? 'high' : sig.volumeRatio < 0.7 ? 'low' : 'avg') : undefined} />
        </div>
      </div>

      {/* ── Flame indicator ──────────────────────────────────────────────── */}
      {(sig.flameWeekly != null || sig.flameMonthly != null) && (() => {
        const wPos = sig.flameWeekly  != null && sig.flameWeekly  >= 0;
        const mPos = sig.flameMonthly != null && sig.flameMonthly >= 0;
        const both = wPos && mPos;
        const neither = !wPos && !mPos;
        const label = both ? 'Bullish — both timeframes positive'
          : neither ? 'Bearish — both timeframes negative'
          : wPos ? 'Recovering — short-term buying, long-term weak'
          : 'Weakening — short-term selling, long-term fading';
        const labelCls = both ? 'text-emerald-400' : neither ? 'text-red-400' : 'text-amber-400';
        return (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Flame Indicator</p>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${labelCls}`}>{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Weekly Flame <span className="text-slate-600">(10d)</span></p>
                  <p className={`text-sm font-bold font-mono ${sig.flameWeekly != null && sig.flameWeekly >= 0 ? 'text-amber-300' : 'text-amber-600'}`}>
                    {sig.flameWeekly != null ? `${sig.flameWeekly >= 0 ? '+' : ''}${sig.flameWeekly.toFixed(2)}` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">fast signal</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Monthly Flame <span className="text-slate-600">(60d)</span></p>
                  <p className={`text-sm font-bold font-mono ${sig.flameMonthly != null && sig.flameMonthly >= 0 ? 'text-blue-300' : 'text-blue-500'}`}>
                    {sig.flameMonthly != null ? `${sig.flameMonthly >= 0 ? '+' : ''}${sig.flameMonthly.toFixed(2)}` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">slow trend</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 border-t border-slate-700/50 pt-1.5">
                0.4·M (SMA20 deviation) + 0.3·FM (SMA10 deviation) + 0.3·(D−S) (volume demand/supply)
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Daily Pulse ──────────────────────────────────────────────────── */}
      {dailySentiment && (() => {
        const c = DAILY_CFG[dailySentiment.label];
        return (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Daily Pulse</p>
            <div className={`border ${c.bgCls.replace('/15', '/20')} border-slate-700/60 rounded-xl p-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dotCls}`} />
                  <span className={`text-sm font-bold ${c.textCls}`}>{c.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{dailySentiment.score}/100</span>
                </div>
                <div className="flex-1 mx-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${c.barCls}`} style={{ width: `${dailySentiment.score}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                {dailySentiment.components.map(comp => (
                  <div key={comp.label} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-slate-500 w-24 shrink-0">{comp.label}</span>
                    <span className={`text-[10px] font-mono shrink-0 w-8 text-right ${comp.score > 0 ? 'text-emerald-400' : comp.score < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {comp.score > 0 ? `+${comp.score}` : comp.score === 0 ? '—' : comp.score}
                    </span>
                    <span className="text-[10px] text-slate-500 flex-1 text-right">{comp.note}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 border-t border-slate-700/50 pt-1.5">
                RSI(2) timing · Volume conviction · Candle quality · SMA5 trend · Day return · Flame momentum
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Entry guidance ────────────────────────────────────────────────── */}
      {(() => {
        const qCfg = {
          ideal:    { border: 'border-emerald-500/40', bg: 'bg-emerald-500/8',  badge: 'bg-emerald-500/15 text-emerald-400', label: 'Ideal Entry' },
          ok:       { border: 'border-green-500/40',   bg: 'bg-green-500/8',    badge: 'bg-green-500/15 text-green-400',     label: 'OK Entry' },
          stretched:{ border: 'border-amber-500/40',   bg: 'bg-amber-500/8',    badge: 'bg-amber-500/15 text-amber-400',     label: 'Stretched — Wait' },
          avoid:    { border: 'border-red-500/40',     bg: 'bg-red-500/8',      badge: 'bg-red-500/15 text-red-400',         label: 'Avoid Entry' },
        }[sig.entryQuality];
        return (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Entry Guidance</p>
            <div className={`border ${qCfg.border} ${qCfg.bg} rounded-xl p-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${qCfg.badge}`}>{qCfg.label}</span>
                <div className="flex items-center gap-2 text-xs">
                  {sig.isNew52wkHigh && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">↑ 52wk High</span>
                  )}
                  <span className="text-slate-500">{currency}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">
                    {sig.oversold ? 'Enter at / below' : sig.isNew52wkHigh ? 'Breakout entry' : 'Limit order target'}
                  </p>
                  <p className="text-lg font-bold text-slate-100 font-mono">
                    {sig.entryLimit != null ? sig.entryLimit.toFixed(2) : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {sig.oversold ? 'RSI oversold — current price'
                      : sig.isNew52wkHigh ? 'Current price at new high'
                      : sig.sma20 != null
                        ? (sig.entryLimit != null && sig.entryLimit < sig.sma20
                          ? 'Below SMA20 — dip entry'
                          : 'SMA20 pullback target')
                        : 'Current price'}
                  </p>
                </div>
                {sig.entryBreakout != null && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">Breakout entry above</p>
                    <p className="text-lg font-bold text-blue-300 font-mono">{sig.entryBreakout.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {sig.bbSqueeze ? 'BB upper — squeeze breakout' : 'Bollinger upper band'}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-700/50 pt-2">
                {sig.entryNote}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Exit levels ───────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Exit Levels ({currency})
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Stop loss */}
          <div className="space-y-1.5">
            {sig.chandelierStop != null && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 space-y-1">
                <p className="text-xs text-slate-400">Chandelier Stop <span className="text-slate-600">(trailing)</span></p>
                <p className="text-sm font-semibold text-red-400">{sig.chandelierStop.toFixed(2)}</p>
                <p className="text-xs text-slate-500">Peak close − 3×ATR(22)</p>
              </div>
            )}
            <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 space-y-1">
              <p className="text-xs text-slate-400">ATR Stop <span className="text-slate-600">(entry-based)</span></p>
              <p className="text-sm font-semibold text-red-400">
                {sig.suggestedStop != null ? sig.suggestedStop.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-slate-500">Price − 2×ATR</p>
              {hardStop != null && (
                <p className="text-xs text-slate-500">O'Neil rule: {hardStop.toFixed(2)} (−8%)</p>
              )}
            </div>
          </div>
          {/* Targets */}
          <div className="space-y-1.5">
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Target 1 — sell ⅓</p>
              <p className="text-sm font-semibold text-emerald-400">
                {sig.tier1Target != null ? sig.tier1Target.toFixed(2) : '—'}
                {sig.atr != null && <span className="text-xs text-slate-500 ml-1">+1.5×ATR</span>}
              </p>
            </div>
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Target 2 — sell ⅓</p>
              <p className="text-sm font-semibold text-emerald-400">
                {sig.tier2Target != null ? sig.tier2Target.toFixed(2) : '—'}
                {sig.atr != null && <span className="text-xs text-slate-500 ml-1">+3×ATR</span>}
              </p>
            </div>
            <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Trailing — last ⅓</p>
              <p className="text-xs text-slate-300">
                {sig.chandelierStop != null ? 'Use Chandelier Stop above' : '−10% trail from peak'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Execution quality ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Execution Quality</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-slate-500 mb-1">CS Spread Estimate</p>
            {sig.csSpreadPct != null ? (
              <>
                <p className={`text-sm font-semibold ${spreadTier(sig.csSpreadPct).cls.split(' ')[1]}`}>
                  {(sig.csSpreadPct * 100).toFixed(2)} bps
                </p>
                <p className="text-xs text-slate-500">
                  {sig.csSpreadPct < 0.05 ? 'Liquid — tight spread' : sig.csSpreadPct < 0.20 ? 'Moderate — normal cost' : 'Wide — expect slippage'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-600">Insufficient OHLCV data</p>
            )}
            <p className="text-[10px] text-slate-600 mt-1">Corwin-Schultz (2012) · 20-day avg</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-slate-500 mb-1">Signal Edge Decay</p>
            <p className={`text-sm font-semibold ${decayCls(sig.decayPct)}`}>
              {sig.decayPct}% edge remaining
            </p>
            <p className="text-xs text-slate-500">
              {sig.signalType === 'momentum' ? 'Momentum' : sig.signalType === 'mean_reversion' ? 'Mean-reversion' : 'No active'} signal
              {sig.signalAgeBars > 0 ? ` · ${sig.signalAgeBars}d active` : ''}
            </p>
            <div className="h-1 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${decayBarCls(sig.decayPct)}`} style={{ width: `${sig.decayPct}%` }} />
            </div>
            <p className="text-[10px] text-slate-600">
              ½-life: {sig.signalType === 'momentum' ? '200d' : sig.signalType === 'mean_reversion' ? '5d' : '30d'} · Di Mascio et al. (2021)
            </p>
          </div>
        </div>
        {/* Earnings proximity detail */}
        {sig.daysToEarnings != null && (
          <div className="mt-2 bg-slate-800/40 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Next earnings</span>
            <span className={`font-mono ${Math.abs(sig.daysToEarnings) <= 7 ? 'text-amber-400' : 'text-slate-300'}`}>
              {sig.daysToEarnings >= 0 ? `in ${sig.daysToEarnings}d` : `${Math.abs(sig.daysToEarnings)}d ago`}
            </span>
          </div>
        )}
      </div>

      {/* ── Position sizing ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Position Sizing</p>
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-1.5 text-xs text-slate-400">
          {volScaleMultiplier != null && (
            <div className="flex justify-between pb-1.5 mb-0.5 border-b border-slate-700">
              <span>
                Vol-target multiplier
                <span className="text-slate-600 ml-1">(0.3% daily vol target)</span>
              </span>
              <span className={`font-mono font-semibold ${volScaleMultiplier >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {volScaleMultiplier.toFixed(2)}×
                <span className="text-slate-500 ml-1 font-normal">
                  {volScaleMultiplier >= 1 ? 'can size up' : 'size down'}
                </span>
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Risk 1% of portfolio</span>
            <span className="text-slate-200 font-mono">{riskPerTrade1pct.toFixed(0)} (base ccy)</span>
          </div>
          <div className="flex justify-between">
            <span>Risk 2% of portfolio</span>
            <span className="text-slate-200 font-mono">{riskPerTrade2pct.toFixed(0)} (base ccy)</span>
          </div>
          {stopForSizing != null && (
            <div className="flex justify-between">
              <span>Stop distance ({sig.chandelierStop != null ? 'Chandelier' : '2×ATR'})</span>
              <span className="text-slate-200 font-mono">{(currentPrice - stopForSizing).toFixed(3)} {currency}</span>
            </div>
          )}
          {shares2pct != null && (
            <>
              <div className="border-t border-slate-700 pt-1.5 flex justify-between">
                <span>Max shares (2% risk)</span>
                <span className="text-slate-200 font-mono">{shares2pct.toLocaleString()} shares</span>
              </div>
              <div className="flex justify-between">
                <span>Position value</span>
                <span className="text-slate-200 font-mono">≈ {posValue2pct?.toFixed(0)} (base ccy)</span>
              </div>
            </>
          )}
          <p className="pt-1 text-slate-500 border-t border-slate-700">
            Conservative: 1% risk · Moderate: 2% risk · Cap any single position at 5% of portfolio.
            {volScaleMultiplier != null && ` Vol-target multiplier adjusts for realized volatility.`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Card signal flags row ────────────────────────────────────────────────────

function SignalFlags({ sig, shortPct }: { sig: TechnicalSignals; shortPct?: number | null }) {
  const sf = shortFlag(shortPct ?? null);
  const hasFlags = sig.oversold || sig.overbought || sig.bbSqueeze || sig.goldenCross || sig.deathCross
    || sig.isNew52wkHigh || sig.nearEarnings || !sig.tsmomBullish || sf.badge != null;
  if (!hasFlags) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {sig.nearEarnings    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">⏰ Earnings</span>}
      {sig.isNew52wkHigh   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">↑ 52wk High</span>}
      {sig.oversold        && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Oversold</span>}
      {sig.overbought      && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Overbought</span>}
      {sig.bbSqueeze       && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">BB Squeeze</span>}
      {sig.goldenCross     && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">↑ MA Cross</span>}
      {sig.deathCross      && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">↓ MA Cross</span>}
      {!sig.tsmomBullish   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">⊘ 6M Downtrend</span>}
      {sf.badge != null    && <span className={`text-[10px] px-1.5 py-0.5 rounded ${sf.cls}`}>{sf.badge}</span>}
    </div>
  );
}

// ─── Portfolio signal card ────────────────────────────────────────────────────

function PortfolioSignalCard({
  holding, sig, isSelected, onSelect, onOpenChart, portfolioValue, fxRate,
  csRank, csTotal, shortPct, dailySentiment,
}: {
  holding: Holding;
  sig: TechnicalSignals;
  isSelected: boolean;
  onSelect: () => void;
  onOpenChart: () => void;
  portfolioValue: number;
  fxRate: number;
  csRank?: number;
  csTotal?: number;
  shortPct?: number | null;
  dailySentiment?: DailySentiment;
}) {
  const cfg    = RATING_CFG[sig.rating];
  const gainPct = ((holding.currentPrice - holding.avgCostPerShare) / holding.avgCostPerShare) * 100;
  const macdBull = sig.macdHistogram != null && sig.macdHistogram > 0;
  const cmfBull  = sig.cmf20 != null && sig.cmf20 > 0.05;
  const cmfBear  = sig.cmf20 != null && sig.cmf20 < -0.05;

  return (
    <div>
      <button
        onClick={onSelect}
        className={`w-full text-left rounded-xl border transition-all p-4 ${
          isSelected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={e => { e.stopPropagation(); onOpenChart(); }}
                className="flex items-center gap-1 text-sm font-bold text-slate-100 hover:text-blue-300 transition-colors group"
                title="Open chart"
              >
                {holding.ticker}
                <LineChart size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
              </button>
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                {cfg.label}
              </span>
              {csRank != null && csTotal != null && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                  #{csRank}/{csTotal}
                </span>
              )}
              <DailyPulseBadge ds={dailySentiment} />
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
        <ScoreBar score={sig.score} />
        <div className="mt-3 grid grid-cols-4 gap-1 text-xs">
          <div className="text-center">
            <p className="text-slate-500">RSI</p>
            <p className={`font-mono font-semibold ${sig.oversold ? 'text-emerald-400' : sig.overbought ? 'text-red-400' : 'text-slate-300'}`}>
              {sig.rsi ?? '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500">MACD</p>
            <p className={`font-semibold ${macdBull ? 'text-emerald-400' : 'text-red-400'}`}>
              {sig.macd != null ? (macdBull ? '▲' : '▼') : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500">CMF</p>
            <p className={`font-semibold ${cmfBull ? 'text-emerald-400' : cmfBear ? 'text-red-400' : 'text-slate-400'}`}>
              {sig.cmf20 != null ? (cmfBull ? '▲' : cmfBear ? '▼' : '—') : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500">PTH</p>
            <p className={`font-mono font-semibold text-[11px] ${sig.isNew52wkHigh ? 'text-emerald-400' : sig.pth52wk != null && sig.pth52wk > 0.9 ? 'text-green-400' : 'text-slate-400'}`}>
              {sig.pth52wk != null ? `${(sig.pth52wk * 100).toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>
        <SignalFlags sig={sig} shortPct={shortPct} />
        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span className={`px-1.5 py-0.5 rounded ${spreadTier(sig.csSpreadPct).cls}`}>
            {spreadTier(sig.csSpreadPct).label}
          </span>
          <span className={`font-mono ${decayCls(sig.decayPct)}`}>
            Edge {sig.decayPct}%{sig.signalAgeBars > 0 ? ` · ${sig.signalAgeBars}d` : ''}
          </span>
          <div className="flex items-center gap-1 text-slate-600">
            {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>details</span>
          </div>
        </div>
      </button>
      {isSelected && (
        <DetailPanel
          ticker={holding.ticker}
          currency={holding.currency}
          currentPrice={holding.currentPrice}
          avgCostPerShare={holding.avgCostPerShare}
          sig={sig}
          portfolioValue={portfolioValue}
          fxRate={fxRate}
          csRank={csRank}
          csTotal={csTotal}
          dailySentiment={dailySentiment}
        />
      )}
    </div>
  );
}

// ─── Watchlist signal card ────────────────────────────────────────────────────

function WatchlistSignalCard({
  entry, sig, isSelected, onSelect, onRemove, onOpenChart, portfolioValue, csRank, csTotal, shortPct, dailySentiment,
}: {
  entry: WatchlistEntry;
  sig: TechnicalSignals | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onOpenChart: () => void;
  portfolioValue: number;
  csRank?: number;
  csTotal?: number;
  shortPct?: number | null;
  dailySentiment?: DailySentiment;
}) {
  const cfg = sig ? RATING_CFG[sig.rating] : null;
  const macdBull = sig?.macdHistogram != null && sig.macdHistogram > 0;
  const cmfBull  = sig?.cmf20 != null && sig.cmf20 > 0.05;
  const cmfBear  = sig?.cmf20 != null && sig.cmf20 < -0.05;

  return (
    <div>
      <div className={`rounded-xl border transition-all p-4 ${isSelected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900/60 border-slate-700'}`}>
        <div className="flex items-start justify-between mb-3">
          <button onClick={onSelect} className="flex-1 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={sig ? e => { e.stopPropagation(); onOpenChart(); } : undefined}
                className={`flex items-center gap-1 text-sm font-bold text-slate-100 ${sig ? 'hover:text-blue-300 cursor-pointer group' : ''} transition-colors`}
              >
                {entry.ticker}
                {sig && <LineChart size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors" />}
              </span>
              {cfg && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                  {cfg.label}
                </span>
              )}
              {csRank != null && csTotal != null && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                  #{csRank}/{csTotal}
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">Watchlist</span>
              <DailyPulseBadge ds={dailySentiment} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{entry.name}</p>
          </button>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-100">
                {entry.currentPrice.toFixed(entry.currentPrice < 10 ? 3 : 2)}
              </p>
              <p className="text-xs text-slate-500">{entry.currency}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {sig ? (
          <button onClick={onSelect} className="w-full text-left">
            <ScoreBar score={sig.score} />
            <div className="mt-3 grid grid-cols-4 gap-1 text-xs">
              <div className="text-center">
                <p className="text-slate-500">RSI</p>
                <p className={`font-mono font-semibold ${sig.oversold ? 'text-emerald-400' : sig.overbought ? 'text-red-400' : 'text-slate-300'}`}>
                  {sig.rsi ?? '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">MACD</p>
                <p className={`font-semibold ${macdBull ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sig.macd != null ? (macdBull ? '▲' : '▼') : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">CMF</p>
                <p className={`font-semibold ${cmfBull ? 'text-emerald-400' : cmfBear ? 'text-red-400' : 'text-slate-400'}`}>
                  {sig.cmf20 != null ? (cmfBull ? '▲' : cmfBear ? '▼' : '—') : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">PTH</p>
                <p className={`font-mono font-semibold text-[11px] ${sig.isNew52wkHigh ? 'text-emerald-400' : sig.pth52wk != null && sig.pth52wk > 0.9 ? 'text-green-400' : 'text-slate-400'}`}>
                  {sig.pth52wk != null ? `${(sig.pth52wk * 100).toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
            <SignalFlags sig={sig} shortPct={shortPct} />
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className={`px-1.5 py-0.5 rounded ${spreadTier(sig.csSpreadPct).cls}`}>
                {spreadTier(sig.csSpreadPct).label}
              </span>
              <span className={`font-mono ${decayCls(sig.decayPct)}`}>
                Edge {sig.decayPct}%{sig.signalAgeBars > 0 ? ` · ${sig.signalAgeBars}d` : ''}
              </span>
              <div className="flex items-center gap-1 text-slate-600">
                {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span>details</span>
              </div>
            </div>
          </button>
        ) : (
          <p className="text-xs text-slate-600 italic mt-1">No data — click Refresh prices to load signals</p>
        )}
      </div>

      {isSelected && sig && (
        <DetailPanel
          ticker={entry.ticker}
          currency={entry.currency}
          currentPrice={entry.currentPrice}
          sig={sig}
          portfolioValue={portfolioValue}
          fxRate={1}
          csRank={csRank}
          csTotal={csTotal}
          dailySentiment={dailySentiment}
        />
      )}
    </div>
  );
}

// ─── Add-to-watchlist form ────────────────────────────────────────────────────

function AddWatchlistForm({ onAdd }: { onAdd: (ticker: string) => Promise<{ success: boolean; error?: string }> }) {
  const [input, setInput]   = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (!t) return;
    setStatus('loading');
    setErrorMsg('');
    const result = await onAdd(t);
    if (result.success) { setInput(''); setStatus('idle'); inputRef.current?.focus(); }
    else { setStatus('error'); setErrorMsg(result.error ?? 'Unknown error'); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value.toUpperCase()); setStatus('idle'); setErrorMsg(''); }}
          placeholder="e.g. AAPL, NVDA, 9988.HK"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={!input.trim() || status === 'loading'}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
        >
          {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> {errorMsg}</p>
      )}
    </form>
  );
}

// ─── Regime rules ─────────────────────────────────────────────────────────────

const REGIME_RULES: Record<string, { stops: string; size: string; strategy: string; color: string }> = {
  GOLDILOCKS:     { stops: '−10 to −12%', size: '2% risk / trade',  strategy: 'Trend-following; let winners run',    color: 'text-emerald-400' },
  REFLATION:      { stops: '−6 to −8%',   size: '1.5% risk / trade', strategy: 'Prefer commodity & value; take profits faster', color: 'text-yellow-400' },
  STAGFLATION:    { stops: '−4 to −5%',   size: '0.5% risk / trade', strategy: 'Defensive only; mean-reversion bounces',        color: 'text-amber-400'  },
  RECESSION:      { stops: '−3%',          size: '0.5% risk / trade', strategy: 'Capital preservation; oversold bounces only',   color: 'text-red-400'    },
  RISK_OFF_SPIKE: { stops: 'Move to b/e',  size: 'Reduce 50%',        strategy: 'No new entries; raise cash',                    color: 'text-red-500'    },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function Signals() {
  const {
    holdings, ohlcvData, settings, exchangeRates,
    fetchLivePrices, priceStatus, getTotalValue,
    watchlist, addToWatchlist, removeFromWatchlist,
    fundamentalsData,
  } = usePortfolioStore();
  const { analysis, confirmedRegime, indicators: regimeIndicators } = useRegimeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy]         = useState<'score' | 'ticker' | 'gain' | 'rank'>('score');
  const [chartEntry, setChartEntry] = useState<ChartEntry | null>(null);

  const bridgewaterRegime: string | undefined = analysis?.bridgewater?.regime ?? settings.marketRegime ?? undefined;
  const volRegime = analysis?.volatility?.level;
  const spyBars   = ohlcvData['SPY'];

  const signalHoldings = useMemo(
    () => holdings.filter(h => h.assetClass !== 'cash'),
    [holdings]
  );

  const portfolioSignals = useMemo(() => {
    const result: Record<string, TechnicalSignals> = {};
    for (const h of signalHoldings) {
      const bars = ohlcvData[h.ticker];
      if (bars && bars.length >= 20) {
        const fund = fundamentalsData[h.ticker];
        result[h.ticker] = computeTechnicalSignals(bars, h.ticker, bridgewaterRegime, {
          entryPrice:       h.avgCostPerShare,
          entryDate:        h.purchaseDate,
          shortPctFloat:    fund?.shortPctFloat ?? null,
          spyBars,
          nextEarningsDate: fund?.nextEarningsDate ?? null,
          livePrice:        h.currentPrice,
          investingStyle:   settings.investingStyle,
        });
      }
    }
    return result;
  }, [ohlcvData, signalHoldings, bridgewaterRegime, fundamentalsData, spyBars, settings.investingStyle]);

  const watchlistSignals = useMemo(() => {
    const result: Record<string, TechnicalSignals> = {};
    for (const w of watchlist) {
      const bars = ohlcvData[w.ticker];
      if (bars && bars.length >= 20) {
        const fund = fundamentalsData[w.ticker];
        result[w.ticker] = computeTechnicalSignals(bars, w.ticker, bridgewaterRegime, {
          shortPctFloat:    fund?.shortPctFloat ?? null,
          spyBars,
          nextEarningsDate: fund?.nextEarningsDate ?? null,
          livePrice:        w.currentPrice > 0 ? w.currentPrice : undefined,
          investingStyle:   settings.investingStyle,
        });
      }
    }
    return result;
  }, [ohlcvData, watchlist, bridgewaterRegime, fundamentalsData, spyBars, settings.investingStyle]);

  const portfolioDailyPulse = useMemo(() => {
    const result: Record<string, DailySentiment> = {};
    for (const h of signalHoldings) {
      const bars = ohlcvData[h.ticker];
      if (bars && bars.length >= 6) {
        result[h.ticker] = computeDailySentiment(bars, {
          livePrice:    h.currentPrice,
          flameWeekly:  portfolioSignals[h.ticker]?.flameWeekly ?? null,
        });
      }
    }
    return result;
  }, [ohlcvData, signalHoldings, portfolioSignals]);

  const watchlistDailyPulse = useMemo(() => {
    const result: Record<string, DailySentiment> = {};
    for (const w of watchlist) {
      const bars = ohlcvData[w.ticker];
      if (bars && bars.length >= 6) {
        result[w.ticker] = computeDailySentiment(bars, {
          livePrice:    w.currentPrice > 0 ? w.currentPrice : undefined,
          flameWeekly:  watchlistSignals[w.ticker]?.flameWeekly ?? null,
        });
      }
    }
    return result;
  }, [ohlcvData, watchlist, watchlistSignals]);

  const marketPulse = useMemo(() => {
    const vixArr = regimeIndicators['^VIX'] ?? [];
    const vixNow  = vixArr.length > 0 ? vixArr[vixArr.length - 1] : null;
    const iwmArr  = regimeIndicators['IWM']  ?? [];
    const spyArr  = regimeIndicators['SPY']  ?? [];
    // Breadth: IWM/SPY 5d return delta (positive = small-caps leading = broad risk appetite)
    const breadthDelta = iwmArr.length >= 6 && spyArr.length >= 6
      ? ((iwmArr[iwmArr.length-1] / iwmArr[iwmArr.length-6]) - (spyArr[spyArr.length-1] / spyArr[spyArr.length-6])) * 100
      : null;
    if (!spyBars || spyBars.length < 6) return null;
    const spyPulse = computeDailySentiment(spyBars);
    const spyReturn = spyBars.length >= 2
      ? (spyBars[spyBars.length-1].close - spyBars[spyBars.length-2].close) / spyBars[spyBars.length-2].close * 100
      : null;
    return { pulse: spyPulse, vix: vixNow, spyReturn, breadthDelta };
  }, [spyBars, regimeIndicators]);

  // Cross-sectional relative strength rank (6M return, skip last 20 bars)
  // Rank 1 = strongest 6M momentum in the universe
  const csRanks = useMemo(() => {
    const entries: { key: string; ret: number }[] = [];

    const addEntry = (ticker: string, key: string) => {
      const bars = ohlcvData[ticker];
      if (!bars || bars.length < 40) return;
      const cutoff = Math.max(0, bars.length - 21);
      const startClose = bars[0].close;
      const endClose   = bars[cutoff].close;
      if (startClose > 0) entries.push({ key, ret: (endClose - startClose) / startClose });
    };

    for (const h of signalHoldings) addEntry(h.ticker, h.id);
    for (const w of watchlist) addEntry(w.ticker, `wl-${w.ticker}`);

    entries.sort((a, b) => b.ret - a.ret);
    const ranks: Record<string, number> = {};
    entries.forEach((e, i) => { ranks[e.key] = i + 1; });
    return { ranks, total: entries.length };
  }, [ohlcvData, signalHoldings, watchlist]);

  const counts = useMemo(() => {
    const c: Record<SignalRating, number> = { STRONG_BUY: 0, BUY: 0, NEUTRAL: 0, SELL: 0, STRONG_SELL: 0 };
    [...Object.values(portfolioSignals), ...Object.values(watchlistSignals)].forEach(s => c[s.rating]++);
    return c;
  }, [portfolioSignals, watchlistSignals]);

  const portfolioValue = getTotalValue();

  const sortedHoldings = useMemo(() => {
    return [...signalHoldings].sort((a, b) => {
      const sa = portfolioSignals[a.ticker];
      const sb = portfolioSignals[b.ticker];
      if (sortBy === 'score') {
        if (!sa && !sb) return 0;
        if (!sa) return 1; if (!sb) return -1;
        return sb.score - sa.score;
      }
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker);
      if (sortBy === 'rank') {
        const ra = csRanks.ranks[a.id] ?? Infinity;
        const rb = csRanks.ranks[b.id] ?? Infinity;
        return ra - rb;
      }
      const ga = (a.currentPrice - a.avgCostPerShare) / a.avgCostPerShare;
      const gb = (b.currentPrice - b.avgCostPerShare) / b.avgCostPerShare;
      return gb - ga;
    });
  }, [signalHoldings, portfolioSignals, sortBy, csRanks]);

  const hasPortfolioSignals = Object.keys(portfolioSignals).length > 0;
  const hasAnyData = hasPortfolioSignals || Object.keys(watchlistSignals).length > 0;
  const regimeRules = bridgewaterRegime ? REGIME_RULES[bridgewaterRegime] : null;

  const toggle = (id: string) => setSelectedId(prev => prev === id ? null : id);

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
            RSI · MACD · Bollinger · ATR · CMF · TSMOM · Chandelier · Beta · Cross-sectional rank
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
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Regime</span>
                {analysis
                  ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Live</span>
                  : <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Manual</span>}
              </div>
              <p className={`text-lg font-bold ${regimeRules?.color ?? 'text-slate-300'}`}>
                {bridgewaterRegime}
                {confirmedRegime !== bridgewaterRegime && analysis && (
                  <span className="text-xs font-normal text-slate-500 ml-2">(unconfirmed)</span>
                )}
              </p>
              {volRegime && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Macro vol: <span className="text-slate-300">{volRegime}</span>
                  {(volRegime === 'HIGH' || volRegime === 'CRISIS') && (
                    <span className="text-amber-400 ml-2">· Reduce position sizes 30–50%</span>
                  )}
                </p>
              )}
            </div>
            {regimeRules && (
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div><p className="text-slate-500 mb-0.5">Stops</p><p className="text-slate-200">{regimeRules.stops}</p></div>
                <div><p className="text-slate-500 mb-0.5">Position size</p><p className="text-slate-200">{regimeRules.size}</p></div>
                <div><p className="text-slate-500 mb-0.5">Strategy</p><p className="text-slate-200">{regimeRules.strategy}</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investing style banner */}
      {settings.investingStyle === 'value' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-amber-400 text-lg">&#9670;</span>
          <p className="text-sm text-amber-300">
            <span className="font-semibold">Value Mode</span> — signals are entry timing aids. Your fundamental thesis drives the decision; technicals only tell you when to act on it.
          </p>
        </div>
      )}
      {settings.investingStyle === 'momentum' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-blue-400 text-lg">&#9650;</span>
          <p className="text-sm text-blue-300">
            <span className="font-semibold">Momentum Mode</span> — trend and TSMOM gates are fully active. Signals favour stocks with positive 6-month price momentum.
          </p>
        </div>
      )}

      {/* Market Pulse */}
      {marketPulse && (() => {
        const c = DAILY_CFG[marketPulse.pulse.label];
        const vix = marketPulse.vix;
        const vixLabel = vix == null ? null : vix > 30 ? 'Crisis' : vix > 25 ? 'High' : vix > 20 ? 'Elevated' : vix > 15 ? 'Normal' : 'Low';
        const vixCls = vix == null ? 'text-slate-400' : vix > 25 ? 'text-red-400' : vix > 20 ? 'text-amber-400' : 'text-emerald-400';
        const breadth = marketPulse.breadthDelta;
        return (
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Activity size={14} className={c.textCls} />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Market Pulse · Today</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-bold ${c.textCls}`}>{c.label}</span>
                    <span className="text-xs text-slate-500 font-mono">{marketPulse.pulse.score}/100</span>
                    {marketPulse.spyReturn != null && (
                      <span className={`text-xs font-mono ${marketPulse.spyReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        SPY {marketPulse.spyReturn >= 0 ? '+' : ''}{marketPulse.spyReturn.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {vix != null && (
                  <div className="text-center">
                    <p className="text-slate-500 text-[10px]">VIX</p>
                    <p className={`font-semibold font-mono ${vixCls}`}>{vix.toFixed(1)} <span className="font-normal text-[10px]">{vixLabel}</span></p>
                  </div>
                )}
                {breadth != null && (
                  <div className="text-center">
                    <p className="text-slate-500 text-[10px]">IWM/SPY 5d</p>
                    <p className={`font-semibold font-mono ${breadth > 0.5 ? 'text-emerald-400' : breadth < -0.5 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {breadth >= 0 ? '+' : ''}{breadth.toFixed(1)}%
                    </p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-slate-500 text-[10px]">RSI(2)</p>
                  <p className={`font-semibold font-mono ${marketPulse.pulse.rsi2 != null && marketPulse.pulse.rsi2 < 25 ? 'text-emerald-400' : marketPulse.pulse.rsi2 != null && marketPulse.pulse.rsi2 > 75 ? 'text-red-400' : 'text-slate-300'}`}>
                    {marketPulse.pulse.rsi2 != null ? marketPulse.pulse.rsi2.toFixed(1) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* No data state */}
      {!hasAnyData && watchlist.length === 0 && (
        <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-8 text-center">
          <BarChart2 size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No signal data yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Click <span className="text-slate-300">Refresh prices</span> to fetch OHLCV data and compute signals.
          </p>
        </div>
      )}

      {/* Summary + sort */}
      {hasAnyData && (
        <>
          <div className="flex flex-wrap gap-2">
            {RATING_ORDER.map(r => (
              <div key={r} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${RATING_CFG[r].bgCls} ${RATING_CFG[r].textCls}`}>
                <span>{r === 'STRONG_BUY' ? '↑↑' : r === 'BUY' ? '↑' : r === 'NEUTRAL' ? '—' : r === 'SELL' ? '↓' : '↓↓'}</span>
                <span>{counts[r]}</span>
                <span className="text-xs opacity-75">{RATING_CFG[r].label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Sort:</span>
            {(['score', 'rank', 'ticker', 'gain'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${sortBy === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                {s === 'score' ? 'Signal Score' : s === 'rank' ? '6M RS Rank' : s === 'ticker' ? 'Ticker' : 'P&L'}
              </button>
            ))}
            {csRanks.total > 0 && (
              <span className="text-[10px] text-slate-600 ml-1">
                <TrendingUp size={10} className="inline mr-0.5" />
                RS rank across {csRanks.total} tickers (Jegadeesh-Titman, skip last 20d)
              </span>
            )}
          </div>
        </>
      )}

      {/* ── Portfolio holdings ──────────────────────────────────────────────── */}
      {signalHoldings.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Portfolio Holdings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedHoldings.map(h => {
              const sig = portfolioSignals[h.ticker];
              const fxRate = h.currency === settings.baseCurrency
                ? 1
                : toBase(1, h.currency, exchangeRates, settings.baseCurrency);

              if (!sig) {
                return (
                  <div key={h.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-slate-300">{h.ticker}</span>
                      <span className="text-xs text-slate-600">{h.currency}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic">Refresh prices to load signals</p>
                  </div>
                );
              }

              return (
                <PortfolioSignalCard
                  key={h.id}
                  holding={h}
                  sig={sig}
                  isSelected={selectedId === h.id}
                  onSelect={() => toggle(h.id)}
                  onOpenChart={() => setChartEntry({ ticker: h.ticker, name: h.name, currency: h.currency, bars: ohlcvData[h.ticker], sig })}
                  portfolioValue={portfolioValue}
                  fxRate={fxRate}
                  csRank={csRanks.ranks[h.id]}
                  csTotal={csRanks.total}
                  shortPct={fundamentalsData[h.ticker]?.shortPctFloat ?? null}
                  dailySentiment={portfolioDailyPulse[h.ticker]}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Watchlist ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
            Watchlist
            {watchlist.length > 0 && (
              <span className="text-xs normal-case font-normal text-slate-500">
                · {watchlist.length} ticker{watchlist.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
        </div>

        <AddWatchlistForm onAdd={addToWatchlist} />

        {watchlist.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {watchlist.map(w => (
              <WatchlistSignalCard
                key={w.ticker}
                entry={w}
                sig={watchlistSignals[w.ticker]}
                isSelected={selectedId === `wl-${w.ticker}`}
                onSelect={() => toggle(`wl-${w.ticker}`)}
                onRemove={() => removeFromWatchlist(w.ticker)}
                onOpenChart={() => {
                  const sig = watchlistSignals[w.ticker];
                  if (sig) setChartEntry({ ticker: w.ticker, name: w.name, currency: w.currency, bars: ohlcvData[w.ticker], sig });
                }}
                portfolioValue={portfolioValue}
                csRank={csRanks.ranks[`wl-${w.ticker}`]}
                csTotal={csRanks.total}
                shortPct={fundamentalsData[w.ticker]?.shortPctFloat ?? null}
                dailySentiment={watchlistDailyPulse[w.ticker]}
              />
            ))}
          </div>
        )}

        {watchlist.length === 0 && (
          <p className="mt-3 text-xs text-slate-600">
            Add any ticker (e.g. AAPL, NVDA, 9988.HK, TSLA) to analyse entry/exit signals without adding it to your portfolio.
          </p>
        )}
      </section>

      {/* Legend */}
      {hasAnyData && (
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Signal Methodology</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
            <div><p className="text-slate-400 font-medium mb-1">Trend (30%)</p><p>SMA20/50 alignment · TSMOM gate: momentum capped at neutral when 6M return is negative</p></div>
            <div><p className="text-slate-400 font-medium mb-1">Momentum (30%)</p><p>MACD(12,26,9) · RSI(14) Wilder · gated by 12M time-series momentum sign</p></div>
            <div><p className="text-slate-400 font-medium mb-1">Volatility (15%)</p><p>BB(20,2σ) · %B · bandwidth squeeze · intra-vol regime shifts sub-score weights</p></div>
            <div><p className="text-slate-400 font-medium mb-1">Volume (15%)</p><p>CMF(20) Chaikin Money Flow primary · volume ratio secondary · replaces raw OBV</p></div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500 border-t border-slate-700/50 pt-3">
            <div><p className="text-slate-400 font-medium mb-1">Exits</p><p>Chandelier Exit: max(close since entry) − 3×ATR(22). Ratchets up with position. ATR-based targets replace fixed %.</p></div>
            <div><p className="text-slate-400 font-medium mb-1">RS Rank</p><p>Cross-sectional 6M return rank (George & Hwang 2004). Skip last 20d to avoid short-term reversal.</p></div>
            <div><p className="text-slate-400 font-medium mb-1">Beta / Short</p><p>60-day rolling beta vs SPY. Short interest {'>'} 20% de-rates bullish signals (Oxford RAPS 2023).</p></div>
            <div><p className="text-slate-400 font-medium mb-1">Vol Sizing</p><p>Vol-target multiplier: 0.3% daily vol contribution per position. High-vol stocks get smaller allocations.</p></div>
          </div>
          <p className="mt-2 text-xs text-slate-600">For informational purposes only. Not financial advice.</p>
        </div>
      )}

      {/* Chart modal */}
      {chartEntry && (
        <ChartModal
          ticker={chartEntry.ticker}
          name={chartEntry.name}
          currency={chartEntry.currency}
          bars={chartEntry.bars}
          sig={chartEntry.sig}
          onClose={() => setChartEntry(null)}
        />
      )}
    </div>
  );
}
