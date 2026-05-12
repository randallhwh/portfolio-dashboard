import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import { useState } from 'react';
import { format } from 'date-fns';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../store/portfolioStore';
import type { Currency } from '../types/portfolio';
import { BreakdownTab } from '../components/analytics/BreakdownTab';
import { TargetsTab } from '../components/analytics/TargetsTab';

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'All'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type AnalyticsTab = 'overview' | 'breakdown' | 'targets';

function getDaysBack(tf: Timeframe): number {
  return { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': Infinity }[tf];
}

function formatCurrencyK(n: number, base: Currency): string {
  const sym: Partial<Record<Currency, string>> = { USD: '$', SGD: 'S$', JPY: '¥', EUR: '€', GBP: '£', HKD: 'HK$' };
  const s = sym[base] ?? '';
  if (Math.abs(n) >= 1000) return `${s}${(n / 1000).toFixed(0)}k`;
  return `${s}${n.toFixed(0)}`;
}

export function Analytics() {
  const { snapshots, holdings: allHoldings, settings, exchangeRates, activePortfolio } = usePortfolioStore();
  const holdings = filterByPortfolio(allHoldings, activePortfolio);
  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');
  const [tab, setTab]             = useState<AnalyticsTab>('overview');

  const base      = settings.baseCurrency;
  const conv      = (amount: number, ccy: Currency) => toBase(amount, ccy, exchangeRates, base);
  const neutralMode = settings.neutralColorMode;
  const positiveColor = neutralMode ? '#3b82f6' : '#10b981';
  const negativeColor = neutralMode ? '#f59e0b' : '#ef4444';

  // ── Overview data ──────────────────────────────────────────────────────────
  const daysBack = getDaysBack(timeframe);
  const cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - (daysBack === Infinity ? 10000 : daysBack));

  const filtered  = snapshots.filter(s => new Date(s.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const first     = filtered[0]?.totalValue ?? 0;
  const last      = filtered[filtered.length - 1]?.totalValue ?? 0;
  const periodReturn = first > 0 ? ((last - first) / first) * 100 : 0;
  const periodGain   = last - first;

  const chartData = filtered.map(s => ({
    date:  s.date,
    value: s.totalValue,
    label: format(new Date(s.date), 'MMM d'),
  }));

  const totalValueBase = holdings.reduce((sum, h) => sum + conv(h.quantity * h.currentPrice, h.currency), 0);

  const byAsset = holdings.reduce<Record<string, { value: number; gain: number; cost: number }>>((acc, h) => {
    const cls = h.assetClass;
    if (!acc[cls]) acc[cls] = { value: 0, gain: 0, cost: 0 };
    acc[cls].value += conv(h.quantity * h.currentPrice, h.currency);
    acc[cls].cost  += conv(h.quantity * h.avgCostPerShare, h.currency);
    acc[cls].gain  += conv((h.currentPrice - h.avgCostPerShare) * h.quantity, h.currency);
    return acc;
  }, {});

  const assetBarData = Object.entries(byAsset).map(([cls, d]) => ({
    name:    cls,
    gain:    Math.round(d.gain),
    pct:     ((d.value / totalValueBase) * 100).toFixed(1),
    gainPct: d.cost > 0 ? ((d.gain / d.cost) * 100).toFixed(1) : '0',
  }));

  const holdingBars = holdings
    .map(h => ({
      name:    h.name || h.ticker,
      gainPct: ((h.currentPrice - h.avgCostPerShare) / h.avgCostPerShare) * 100,
    }))
    .sort((a, b) => b.gainPct - a.gainPct);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
          <p className="text-slate-400 text-xs mb-1">{label}</p>
          <p className="font-medium text-slate-100">{fmtBase(payload[0].value, base)}</p>
        </div>
      );
    }
    return null;
  };

  // ── Tab nav ────────────────────────────────────────────────────────────────
  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview',   label: 'Overview'   },
    { id: 'breakdown',  label: 'Breakdown'  },
    { id: 'targets',    label: 'Targets'    },
  ];

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Summary + timeframe */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-semibold text-slate-100 tabular-nums">
                {periodReturn >= 0 ? '+' : ''}{periodReturn.toFixed(2)}%
              </p>
              <span className={`text-sm font-medium ${periodReturn >= 0 ? (neutralMode ? 'text-blue-400' : 'text-emerald-400') : (neutralMode ? 'text-amber-400' : 'text-red-400')}`}>
                {periodGain >= 0 ? '+' : ''}{fmtBase(periodGain, base)} this period
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio value chart */}
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Portfolio Value</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => formatCurrencyK(v, base)} width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#valueGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {timeframe === '1M' && (
              <div className="mt-3 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                <span className="text-blue-400 text-xs">⚠</span>
                <p className="text-xs text-blue-300">
                  <strong>Recency bias check:</strong> You are viewing only 1 month. Switch to 1Y or All to evaluate performance in context.
                </p>
              </div>
            )}
          </div>

          {/* Per-holding returns */}
          {settings.showCostBasis && holdingBars.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Per-Holding Returns</h3>
              <p className="text-xs text-slate-500 mb-4">Sorted by return %. Winners and losers displayed symmetrically to counteract disposition effect.</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={holdingBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                    <Tooltip
                      formatter={(v: unknown) => { const n = v as number; return [`${n >= 0 ? '+' : ''}${n.toFixed(1)}%`, 'Return']; }}
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#f1f5f9' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
                    <Bar dataKey="gainPct" radius={[3, 3, 0, 0]}>
                      {holdingBars.map((entry, i) => (
                        <Cell key={i} fill={entry.gainPct >= 0 ? positiveColor : negativeColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Asset class breakdown */}
          {settings.showCostBasis && assetBarData.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Gain / Loss by Asset Class</h3>
              <div className="space-y-2">
                {assetBarData.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-20 capitalize">{d.name}</span>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(Math.abs(parseFloat(d.gainPct)), 100)}%`,
                            backgroundColor: parseFloat(d.gainPct) >= 0 ? positiveColor : negativeColor,
                          }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs tabular-nums font-medium w-14 text-right ${parseFloat(d.gainPct) >= 0 ? (neutralMode ? 'text-blue-400' : 'text-emerald-400') : (neutralMode ? 'text-amber-400' : 'text-red-400')}`}>
                      {parseFloat(d.gainPct) >= 0 ? '+' : ''}{d.gainPct}%
                    </span>
                    <span className="text-xs text-slate-500 w-12 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Long-term perspective */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Long-Term Perspective</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              {[
                { label: 'S&P 500 avg. annual return (100yr)', value: '~10%',          note: 'incl. dividends, before inflation' },
                { label: 'Market corrections > 10%',           value: 'Every ~1.9 yrs', note: 'on average since 1928' },
                { label: 'Recovery from bear markets',         value: '~2 years',       note: 'median since 1929' },
              ].map(({ label, value, note }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-lg font-semibold text-blue-400 mb-1">{value}</p>
                  <p className="text-xs font-medium text-slate-300 mb-0.5">{label}</p>
                  <p className="text-xs text-slate-600">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Breakdown ── */}
      {tab === 'breakdown' && <BreakdownTab />}

      {/* ── Targets ── */}
      {tab === 'targets' && <TargetsTab />}
    </div>
  );
}
