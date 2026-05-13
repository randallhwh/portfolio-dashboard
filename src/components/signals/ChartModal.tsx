import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  ComposedChart, Line, Area, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  computeSMA, computeRSI, computeMACD, computeBollingerBands, rollingMeanN,
} from '../../services/technicals';
import type { OHLCVBar, TechnicalSignals, SignalRating } from '../../types/portfolio';

// ─── Rating colour map ────────────────────────────────────────────────────────

const RATING_HEX: Record<SignalRating, string> = {
  STRONG_BUY:  '#10b981',
  BUY:         '#22c55e',
  NEUTRAL:     '#64748b',
  SELL:        '#f59e0b',
  STRONG_SELL: '#ef4444',
};

const ENTRY_HEX: Record<TechnicalSignals['entryQuality'], string> = {
  ideal:     '#10b981',
  ok:        '#22c55e',
  stretched: '#f59e0b',
  avoid:     '#ef4444',
};

const ENTRY_LABEL: Record<TechnicalSignals['entryQuality'], string> = {
  ideal:     'Ideal Entry',
  ok:        'OK Entry',
  stretched: 'Stretched — Wait',
  avoid:     'Avoid',
};

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function PriceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; name: string; value: number; stroke?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const show = ['close', 'sma20', 'sma50', 'bbUpper', 'bbMiddle', 'bbLower'];
  const rows = payload.filter(p => show.includes(p.dataKey));
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-xs shadow-xl min-w-[140px]">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {rows.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.stroke ?? p.color }}>{p.name}</span>
          <span className="font-mono text-slate-200">{p.value?.toFixed(2) ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function RSITooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const rsi = payload.find(p => p.dataKey === 'rsi');
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-slate-400">{label}</p>
      {rsi && <p className="font-mono text-violet-300">RSI: {rsi.value?.toFixed(1)}</p>}
    </div>
  );
}

function MACDTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const macd = payload.find(p => p.dataKey === 'macdLine');
  const sig  = payload.find(p => p.dataKey === 'macdSignal');
  const histP = payload.find(p => p.dataKey === 'macdHistPos');
  const histN = payload.find(p => p.dataKey === 'macdHistNeg');
  const hist = histP ?? histN;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-slate-400">{label}</p>
      {macd && <p className="font-mono text-blue-300">MACD: {macd.value?.toFixed(4)}</p>}
      {sig  && <p className="font-mono text-orange-300">Signal: {sig.value?.toFixed(4)}</p>}
      {hist && <p className={`font-mono ${(histP && !histN) ? 'text-emerald-400' : 'text-red-400'}`}>Hist: {hist.value?.toFixed(4)}</p>}
    </div>
  );
}

function FlameTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const weekly  = payload.find(p => p.dataKey === 'flameWeekly');
  const monthly = payload.find(p => p.dataKey === 'flameMonthly');
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-slate-400">{label}</p>
      {weekly  && <p className="font-mono text-amber-300">Weekly:  {weekly.value?.toFixed(2)}</p>}
      {monthly && <p className="font-mono text-blue-300"> Monthly: {monthly.value?.toFixed(2)}</p>}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ChartModal({
  ticker,
  name,
  bars,
  sig,
  currency,
  onClose,
}: {
  ticker: string;
  name: string;
  bars: OHLCVBar[];
  sig: TechnicalSignals;
  currency: string;
  onClose: () => void;
}) {
  // Keyboard close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Compute indicator series
  const { chartData, yDomain } = useMemo(() => {
    const closes  = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const sma20a = computeSMA(closes, 20);
    const sma50a = computeSMA(closes, 50);
    const sma10a = computeSMA(closes, 10);
    const volSma = computeSMA(volumes, 20);
    const { upper: bbUp, middle: bbMid, lower: bbLow } = computeBollingerBands(closes);
    const rsiA = computeRSI(closes, 14);
    const { macd: macdA, signal: sigA, histogram: histA } = computeMACD(closes);

    // Flame indicator
    const thrustA: (number | null)[] = bars.map((b, i) => {
      if (i === 0) return null;
      const r = closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] * 100 : null;
      const avgVol = volSma[i];
      if (r == null || avgVol == null || avgVol === 0) return null;
      return r * (b.volume / avgVol);
    });
    const demandA  = rollingMeanN(thrustA.map(t => t == null ? null : Math.max(t, 0)), 20);
    const supplyA  = rollingMeanN(thrustA.map(t => t == null ? null : Math.max(-t, 0)), 20);
    const mPctA    = closes.map((c, i) => sma20a[i] != null ? 100 * (c / sma20a[i]! - 1) : null);
    const fmPctA   = closes.map((c, i) => sma10a[i] != null ? 100 * (c / sma10a[i]! - 1) : null);
    const rawA: (number | null)[] = closes.map((_, i) => {
      const m = mPctA[i], fm = fmPctA[i], d = demandA[i], s = supplyA[i];
      if (m == null || fm == null || d == null || s == null) return null;
      return 0.4 * m + 0.3 * fm + 0.3 * (d - s);
    });
    const flameWA = rollingMeanN(rawA, 10);
    const flameMA = rollingMeanN(rawA, 60);

    const data = bars.map((b, i) => ({
      date:       b.date.slice(5),         // MM-DD for X labels
      close:      b.close,
      sma20:      sma20a[i] ?? undefined,
      sma50:      sma50a[i] ?? undefined,
      bbUpper:    bbUp[i]  ?? undefined,
      bbMiddle:   bbMid[i] ?? undefined,
      bbLower:    bbLow[i] ?? undefined,
      // Range area [low, high] — fills between bbLower and bbUpper without anchoring to 0
      bbRange:    bbUp[i] != null && bbLow[i] != null
                    ? [bbLow[i]!, bbUp[i]!] as [number, number]
                    : undefined,
      rsi:        rsiA[i]  ?? undefined,
      macdLine:   macdA[i] ?? undefined,
      macdSignal: sigA[i]  ?? undefined,
      macdHistPos: histA[i] != null && histA[i]! > 0  ? histA[i]! : undefined,
      macdHistNeg: histA[i] != null && histA[i]! <= 0 ? histA[i]! : undefined,
      flameWeekly:  flameWA[i] ?? undefined,
      flameMonthly: flameMA[i] ?? undefined,
    }));

    // Y domain: encompass price, BB bands, and all reference levels
    const ys: number[] = [];
    data.forEach(d => {
      if (d.close)   ys.push(d.close);
      if (d.bbUpper) ys.push(d.bbUpper);
      if (d.bbLower) ys.push(d.bbLower);
    });
    [sig.suggestedStop, sig.entryLimit, sig.entryBreakout, sig.tier1Target, sig.tier2Target]
      .forEach(v => { if (v != null) ys.push(v); });

    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = (hi - lo) * 0.06;
    const yDomain: [number, number] = [
      Math.floor((lo - pad) * 10) / 10,
      Math.ceil((hi + pad) * 10) / 10,
    ];

    return { chartData: data, yDomain };
  }, [bars, sig]);

  const xInterval = Math.max(1, Math.floor(chartData.length / 6));

  const entryHex   = ENTRY_HEX[sig.entryQuality];
  const entryLabel = ENTRY_LABEL[sig.entryQuality];
  const ratingHex  = RATING_HEX[sig.rating];
  const currentPrice = bars[bars.length - 1]?.close;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-stretch justify-center p-2"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal fills the padded viewport — no overflow-y-auto, no fixed pixel heights */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-7xl flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-100 font-mono">{ticker}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: ratingHex + '25', color: ratingHex }}
                >
                  {sig.rating.replace('_', ' ')}
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ background: entryHex + '20', color: entryHex }}
                >
                  {entryLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{name} · {currency}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-xl font-bold font-mono text-slate-100">
                {currentPrice?.toFixed(currentPrice < 10 ? 3 : 2)}
              </p>
              <p className="text-xs text-slate-500">Signal score {sig.score}/100</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body: flex column filling remaining height ─────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">

          {/* Legend + entry note row */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-[11px] text-slate-400 px-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-blue-400 rounded" />Close</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-green-400 rounded" />SMA20</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-orange-400 rounded" />SMA50</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-[3px] rounded" style={{ background: 'repeating-linear-gradient(90deg,#64748b 0,#64748b 4px,transparent 4px,transparent 7px)' }} />BB Bands</span>
              {sig.entryLimit != null && sig.entryQuality !== 'avoid' && (
                <span className="flex items-center gap-1.5" style={{ color: entryHex }}>
                  <span className="inline-block w-5 h-0.5 rounded" style={{ background: entryHex }} />Entry
                </span>
              )}
              {sig.entryBreakout != null && (
                <span className="flex items-center gap-1.5 text-blue-300">
                  <span className="inline-block w-5 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg,#93c5fd 0,#93c5fd 5px,transparent 5px,transparent 9px)' }} />Breakout
                </span>
              )}
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="inline-block w-5 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg,#f87171 0,#f87171 4px,transparent 4px,transparent 7px)' }} />Stop
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="inline-block w-5 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg,#34d399 0,#34d399 4px,transparent 4px,transparent 7px)' }} />T1/T2
              </span>
            </div>
            {/* Inline entry note */}
            <span style={{ color: entryHex }} className="font-medium hidden md:block truncate max-w-sm text-right">
              {ENTRY_LABEL[sig.entryQuality]} — {sig.entryNote.split('.')[0]}.
            </span>
          </div>

          {/* ── Price chart — takes 60% of chart area ──────────────────────── */}
          <div className="flex-[6] min-h-0 bg-slate-950/60 rounded-xl flex flex-col p-3">
            <p className="shrink-0 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Price · Bollinger Bands (20, 2σ) · SMA20 / SMA50
            </p>
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 90, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  interval={xInterval}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: '#475569' }}
                  tickFormatter={v => v.toFixed(v >= 100 ? 1 : 2)}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                />
                <Tooltip content={<PriceTooltip />} />

                {/* BB band fill — range area [bbLower, bbUpper], no zero-anchor */}
                <Area
                  dataKey="bbRange"
                  fill="#3b82f6"
                  fillOpacity={0.07}
                  stroke="none"
                  dot={false}
                  legendType="none"
                  activeDot={false}
                  isAnimationActive={false}
                />

                {/* BB band strokes */}
                <Line dataKey="bbUpper"  stroke="#475569" strokeWidth={1} strokeDasharray="3 4" dot={false} name="BB Upper"  isAnimationActive={false} />
                <Line dataKey="bbMiddle" stroke="#334155" strokeWidth={1} strokeDasharray="2 3" dot={false} name="BB Mid"    isAnimationActive={false} />
                <Line dataKey="bbLower"  stroke="#475569" strokeWidth={1} strokeDasharray="3 4" dot={false} name="BB Lower"  isAnimationActive={false} />

                {/* Moving averages */}
                <Line dataKey="sma20" stroke="#4ade80" strokeWidth={1.5} dot={false} name="SMA20" isAnimationActive={false} />
                <Line dataKey="sma50" stroke="#fb923c" strokeWidth={1.5} dot={false} name="SMA50" isAnimationActive={false} />

                {/* Close price — on top */}
                <Line dataKey="close" stroke="#60a5fa" strokeWidth={2} dot={false} name="Close" isAnimationActive={false} />

                {/* ── Entry levels ── */}
                {sig.entryLimit != null && sig.entryQuality !== 'avoid' && (
                  <ReferenceLine
                    y={sig.entryLimit}
                    stroke={entryHex}
                    strokeWidth={1.5}
                    label={{ value: `Entry  ${sig.entryLimit.toFixed(2)}`, position: 'right', fill: entryHex, fontSize: 10, fontFamily: 'monospace' }}
                  />
                )}
                {sig.entryBreakout != null && (
                  <ReferenceLine
                    y={sig.entryBreakout}
                    stroke="#93c5fd"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: `Break ${sig.entryBreakout.toFixed(2)}`, position: 'right', fill: '#93c5fd', fontSize: 10, fontFamily: 'monospace' }}
                  />
                )}

                {/* ── Stop loss ── */}
                {sig.suggestedStop != null && (
                  <ReferenceLine
                    y={sig.suggestedStop}
                    stroke="#f87171"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    label={{ value: `Stop   ${sig.suggestedStop.toFixed(2)}`, position: 'right', fill: '#f87171', fontSize: 10, fontFamily: 'monospace' }}
                  />
                )}

                {/* ── Profit targets ── */}
                {sig.tier1Target != null && (
                  <ReferenceLine
                    y={sig.tier1Target}
                    stroke="#34d399"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{ value: `T1     ${sig.tier1Target.toFixed(2)}`, position: 'right', fill: '#34d399', fontSize: 10, fontFamily: 'monospace' }}
                  />
                )}
                {sig.tier2Target != null && (
                  <ReferenceLine
                    y={sig.tier2Target}
                    stroke="#34d399"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{ value: `T2     ${sig.tier2Target.toFixed(2)}`, position: 'right', fill: '#34d399', fontSize: 10, fontFamily: 'monospace' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* ── RSI panel — 20% of chart area ──────────────────────────────── */}
          <div className="flex-[2] min-h-0 bg-slate-950/60 rounded-xl flex flex-col p-3">
            <div className="shrink-0 flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">RSI (14)</p>
              {sig.rsi != null && (
                <span className={`text-[11px] font-mono font-bold ${
                  sig.oversold ? 'text-emerald-400' : sig.overbought ? 'text-red-400' : 'text-violet-300'
                }`}>
                  {sig.rsi}{sig.oversold ? ' ← oversold' : sig.overbought ? ' ← overbought' : ''}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 90, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="#1e293b" />
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 30, 50, 70, 100]}
                  tick={{ fontSize: 9, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                />
                <Tooltip content={<RSITooltip />} />
                <ReferenceLine y={70} stroke="#f8717160" strokeDasharray="3 3"
                  label={{ value: 'OB 70', position: 'right', fill: '#f87171', fontSize: 9 }} />
                <ReferenceLine y={50} stroke="#33415560" strokeDasharray="2 4" />
                <ReferenceLine y={30} stroke="#34d39960" strokeDasharray="3 3"
                  label={{ value: 'OS 30', position: 'right', fill: '#34d399', fontSize: 9 }} />
                <Line dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="RSI" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* ── MACD panel — 20% of chart area ─────────────────────────────── */}
          <div className="flex-[2] min-h-0 bg-slate-950/60 rounded-xl flex flex-col p-3">
            <div className="shrink-0 flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">MACD (12, 26, 9)</p>
              {sig.macdHistogram != null && (
                <span className={`text-[11px] font-mono font-bold ${sig.macdHistogram > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Hist {sig.macdHistogram > 0 ? '▲' : '▼'} {sig.macdHistogram.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 90, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="#1e293b" />
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: '#475569' }}
                  tickFormatter={v => v.toFixed(3)}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                />
                <Tooltip content={<MACDTooltip />} />
                <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
                <Bar dataKey="macdHistPos" fill="#10b981" fillOpacity={0.75} name="Hist +" isAnimationActive={false} />
                <Bar dataKey="macdHistNeg" fill="#ef4444" fillOpacity={0.75} name="Hist −" isAnimationActive={false} />
                <Line dataKey="macdLine"   stroke="#60a5fa" strokeWidth={1.5} dot={false} name="MACD"   isAnimationActive={false} />
                <Line dataKey="macdSignal" stroke="#fb923c" strokeWidth={1.5} dot={false} name="Signal" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* ── Flame panel ─────────────────────────────────────────────────── */}
          <div className="flex-[2] min-h-0 bg-slate-950/60 rounded-xl flex flex-col p-3">
            <div className="shrink-0 flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Flame · 0.4·M + 0.3·FM + 0.3·(D−S)
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                {sig.flameWeekly != null && (
                  <span className={sig.flameWeekly >= 0 ? 'text-amber-300' : 'text-amber-600'}>
                    W {sig.flameWeekly >= 0 ? '+' : ''}{sig.flameWeekly.toFixed(2)}
                  </span>
                )}
                {sig.flameMonthly != null && (
                  <span className={sig.flameMonthly >= 0 ? 'text-blue-300' : 'text-blue-500'}>
                    M {sig.flameMonthly >= 0 ? '+' : ''}{sig.flameMonthly.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 90, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#475569' }}
                    tickFormatter={v => v.toFixed(1)}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip content={<FlameTooltip />} />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                  <Line dataKey="flameMonthly" stroke="#60a5fa" strokeWidth={2}   dot={false} name="Monthly" isAnimationActive={false} />
                  <Line dataKey="flameWeekly"  stroke="#fbbf24" strokeWidth={1.5} dot={false} name="Weekly"  isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
