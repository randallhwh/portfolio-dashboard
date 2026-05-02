import { useRef } from 'react';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../../store/portfolioStore';
import type { AssetClass, Currency } from '../../types/portfolio';

const ASSET_COLORS: Record<string, string> = {
  stock:       '#3b82f6',
  bond:        '#06b6d4',
  cash:        '#10b981',
  real_estate: '#f59e0b',
  etf:         '#8b5cf6',
  crypto:      '#f97316',
  commodity:   '#ef4444',
  other:       '#64748b',
};

const ASSET_LABEL: Record<string, string> = {
  stock: 'Stocks', bond: 'Bonds', cash: 'Cash', real_estate: 'Real Estate',
  etf: 'ETFs', crypto: 'Crypto', commodity: 'Commodities', other: 'Other',
};

const ALL_CLASSES: AssetClass[] = ['stock', 'bond', 'cash', 'real_estate', 'etf', 'crypto', 'commodity', 'other'];

type Regime = 'risk-on' | 'balanced' | 'defensive' | 'stagflation';

const REGIME_LABELS: Record<Regime, string> = {
  'risk-on':    'Risk-On',
  'balanced':   'Balanced',
  'defensive':  'Defensive',
  'stagflation':'Stagflation',
};

const REGIME_DESC: Record<Regime, string> = {
  'risk-on':    'Growth expansion — favour equities and real assets over bonds and cash.',
  'balanced':   'Neutral environment — diversified across asset classes.',
  'defensive':  'Risk-off / contraction — rotate into bonds and cash; reduce equity.',
  'stagflation':'High inflation + slow growth — real assets, cash; avoid long-duration bonds.',
};

// Allocations sum to 100 for each regime
const REGIME_PRESETS: Record<Regime, Partial<Record<AssetClass, number>>> = {
  'risk-on':    { stock: 70, bond: 10, cash: 5,  real_estate: 15 },
  'balanced':   { stock: 55, bond: 20, cash: 10, real_estate: 15 },
  'defensive':  { stock: 30, bond: 40, cash: 20, real_estate: 10 },
  'stagflation':{ stock: 25, bond: 10, cash: 30, real_estate: 20, commodity: 15 },
};

const ZERO_ALLOCS: Record<AssetClass, number> = {
  stock: 0, bond: 0, cash: 0, real_estate: 0, etf: 0, crypto: 0, commodity: 0, other: 0,
};

// ── Draggable proportional bar ────────────────────────────────────────────────
interface DraggableBarProps {
  classes: AssetClass[];
  values: Record<string, number>;
  onUpdate: (cls: AssetClass, val: number) => void;
}

function DraggableBar({ classes, values, onUpdate }: DraggableBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const active = classes.filter(c => (values[c] ?? 0) > 0);
  const total  = active.reduce((s, c) => s + (values[c] ?? 0), 0);

  const startDrag = (e: React.MouseEvent, leftCls: AssetClass, rightCls: AssetClass) => {
    e.preventDefault();
    const leftStart  = values[leftCls]  ?? 0;
    const rightStart = values[rightCls] ?? 0;
    const combined   = leftStart + rightStart;
    const startX     = e.clientX;

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const barW   = barRef.current.getBoundingClientRect().width;
      const delta  = ((ev.clientX - startX) / barW) * 100;
      const newL   = Math.round(Math.max(0, Math.min(combined, leftStart + delta)));
      const newR   = combined - newL;
      onUpdate(leftCls,  newL);
      onUpdate(rightCls, newR);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={barRef} className="relative flex h-12 rounded-xl overflow-hidden select-none cursor-default">
      {active.map((cls, idx) => {
        const pct = total > 0 ? (values[cls] ?? 0) / total * 100 : 0;
        return (
          <div
            key={cls}
            className="relative flex items-center justify-center overflow-hidden transition-[width] duration-75"
            style={{ width: `${pct}%`, backgroundColor: ASSET_COLORS[cls] }}
          >
            {pct >= 9 && (
              <span className="text-xs font-semibold text-white/90 px-1 truncate z-10 pointer-events-none">
                {ASSET_LABEL[cls]} {Math.round(values[cls] ?? 0)}%
              </span>
            )}
            {idx < active.length - 1 && (
              <div
                className="absolute right-0 top-0 bottom-0 w-3 z-20 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => startDrag(e, cls, active[idx + 1])}
              >
                <div className="w-px h-7 bg-white/40 group-hover:bg-white/80 transition-colors" />
                <div className="absolute w-3 h-full" />
              </div>
            )}
          </div>
        );
      })}
      {active.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-600">
          Set target allocations below
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TargetsTab() {
  const {
    holdings: allHoldings, settings, exchangeRates,
    activePortfolio, updateSettings,
  } = usePortfolioStore();

  const holdings  = filterByPortfolio(allHoldings, activePortfolio);
  const base      = settings.baseCurrency;
  const fmt       = (n: number) => fmtBase(n, base);
  const conv      = (amt: number, ccy: Currency) => toBase(amt, ccy, exchangeRates, base);
  const targets   = settings.targetAllocations;
  const regime    = settings.marketRegime ?? 'balanced';
  const neutralMode = settings.neutralColorMode;

  const totalValue = holdings.reduce((s, h) => s + conv(h.quantity * h.currentPrice, h.currency), 0);

  // Current allocation %
  const currentAlloc = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});
  const currentPct = Object.fromEntries(
    ALL_CLASSES.map(cls => [cls, totalValue > 0 ? (currentAlloc[cls] ?? 0) / totalValue * 100 : 0])
  ) as Record<AssetClass, number>;

  // Which classes are relevant (present in portfolio OR have a target set)
  const relevantClasses = ALL_CLASSES.filter(
    cls => (currentPct[cls] ?? 0) > 0.1 || (targets[cls] ?? 0) > 0
  );

  const applyRegime = (r: Regime) => {
    updateSettings({
      marketRegime: r,
      targetAllocations: { ...ZERO_ALLOCS, ...REGIME_PRESETS[r] },
    });
  };

  const setTarget = (cls: AssetClass, val: number) => {
    updateSettings({ targetAllocations: { ...targets, [cls]: val } });
  };

  const totalTarget = ALL_CLASSES.reduce((s, c) => s + (targets[c] ?? 0), 0);

  const gainColor = (v: number) => {
    if (Math.abs(v) < 1) return 'text-slate-500';
    if (neutralMode) return v > 0 ? 'text-blue-400' : 'text-amber-400';
    return v > 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="space-y-6">

      {/* Market regime selector */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Market Regime</h3>
        <p className="text-xs text-slate-500 mb-4">
          Select a regime to load suggested target allocations, then drag segments or use sliders to customise.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(Object.keys(REGIME_LABELS) as Regime[]).map((r) => (
            <button
              key={r}
              onClick={() => applyRegime(r)}
              className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                regime === r
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <p>{REGIME_LABELS[r]}</p>
            </button>
          ))}
        </div>
        {regime && (
          <p className="mt-3 text-xs text-slate-500 italic">{REGIME_DESC[regime]}</p>
        )}
      </div>

      {/* Current vs Target bars */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Allocation Comparison</h3>

        {/* Current */}
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Current</p>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {relevantClasses.filter(c => (currentPct[c] ?? 0) > 0).map(cls => (
              <div
                key={cls}
                title={`${ASSET_LABEL[cls]} ${(currentPct[cls] ?? 0).toFixed(1)}%`}
                className="relative flex items-center justify-center overflow-hidden"
                style={{ width: `${currentPct[cls] ?? 0}%`, backgroundColor: ASSET_COLORS[cls] }}
              >
                {(currentPct[cls] ?? 0) >= 9 && (
                  <span className="text-xs font-semibold text-white/80 px-1 truncate pointer-events-none">
                    {(currentPct[cls] ?? 0).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Target — draggable */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500">Target</p>
            {Math.abs(totalTarget - 100) > 1 && (
              <span className="text-xs text-amber-400">
                Total: {totalTarget}% — adjust to reach 100%
              </span>
            )}
          </div>
          <DraggableBar
            classes={relevantClasses}
            values={targets}
            onUpdate={setTarget}
          />
          <p className="mt-1.5 text-xs text-slate-600">Drag the dividers to rebalance targets between adjacent classes.</p>
        </div>
      </div>

      {/* Per-class sliders + gap table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <p className="text-sm font-semibold text-slate-300">Target Allocation</p>
          <p className="text-xs text-slate-500 mt-0.5">Drag the sliders below to fine-tune each class.</p>
        </div>
        <div className="divide-y divide-slate-700/20">
          {relevantClasses.map(cls => {
            const curr = currentPct[cls] ?? 0;
            const tgt  = targets[cls]    ?? 0;
            const gap  = curr - tgt;
            return (
              <div key={cls} className="px-5 py-3 flex items-center gap-4">
                {/* Color dot + label */}
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[cls] }} />
                  <span className="text-sm text-slate-300">{ASSET_LABEL[cls]}</span>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={tgt}
                  onChange={(e) => setTarget(cls, Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: ASSET_COLORS[cls] }}
                />

                {/* Target % */}
                <span className="text-sm font-semibold text-slate-200 tabular-nums w-10 text-right">
                  {tgt}%
                </span>

                {/* Current % */}
                <span className="text-xs text-slate-500 tabular-nums w-14 text-right">
                  now {curr.toFixed(1)}%
                </span>

                {/* Gap */}
                <span className={`text-xs font-semibold tabular-nums w-16 text-right ${gainColor(gap)}`}>
                  {Math.abs(gap) < 0.5 ? '✓' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action items */}
      {relevantClasses.some(cls => Math.abs((currentPct[cls] ?? 0) - (targets[cls] ?? 0)) >= 3) && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Rebalancing Actions</h3>
          <div className="space-y-2">
            {relevantClasses
              .map(cls => ({ cls, gap: (currentPct[cls] ?? 0) - (targets[cls] ?? 0) }))
              .filter(({ gap }) => Math.abs(gap) >= 3)
              .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
              .map(({ cls, gap }) => {
                const action    = gap > 0 ? 'Reduce' : 'Increase';
                const absGapVal = Math.abs(gap / 100) * totalValue;
                return (
                  <div key={cls} className="flex items-center gap-3 text-sm">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ASSET_COLORS[cls] }}
                    />
                    <span className="text-slate-300">
                      <span className={gap > 0
                        ? (neutralMode ? 'text-amber-400' : 'text-red-400')
                        : (neutralMode ? 'text-blue-400' : 'text-emerald-400')
                      }>{action}</span>
                      {' '}{ASSET_LABEL[cls]} by ~{Math.abs(gap).toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500">
                      (~{fmt(absGapVal)})
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
