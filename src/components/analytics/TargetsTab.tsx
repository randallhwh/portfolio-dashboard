import { useRef } from 'react';
import { Activity, Zap, TrendingDown, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../../store/portfolioStore';
import { useRegimeStore } from '../../store/regimeStore';
import {
  REGIME_META,
  BUSINESS_CYCLE_META,
  VOLATILITY_META,
  LIQUIDITY_META,
  CREDIT_CYCLE_META,
  type RegimeName,
} from '../../services/regimeDetection';
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

const ZERO_ALLOCS: Record<AssetClass, number> = {
  stock: 0, bond: 0, cash: 0, real_estate: 0, etf: 0, crypto: 0, commodity: 0, other: 0,
};

const SELECTABLE_REGIMES: RegimeName[] = ['GOLDILOCKS', 'REFLATION', 'STAGFLATION', 'RECESSION', 'RISK_OFF_SPIKE'];

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
      const barW  = barRef.current.getBoundingClientRect().width;
      const delta = ((ev.clientX - startX) / barW) * 100;
      const newL  = Math.round(Math.max(0, Math.min(combined, leftStart + delta)));
      onUpdate(leftCls,  newL);
      onUpdate(rightCls, combined - newL);
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

// ── Regime selector card ──────────────────────────────────────────────────────
function RegimeCard({
  regime, isSelected, isDetected, onClick,
}: {
  regime: RegimeName;
  isSelected: boolean;
  isDetected: boolean;
  onClick: () => void;
}) {
  const meta    = REGIME_META[regime];
  const targets = meta.targets as Record<string, number>;

  // Pick a representative icon per regime
  const icon =
    regime === 'GOLDILOCKS'     ? <TrendingUp  size={13} /> :
    regime === 'REFLATION'      ? <Activity    size={13} /> :
    regime === 'STAGFLATION'    ? <TrendingDown size={13} /> :
    regime === 'RECESSION'      ? <TrendingDown size={13} /> :
                                  <AlertTriangle size={13} />;

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl border p-3.5 text-left transition-all ${
        isSelected
          ? `${meta.bgColor} ${meta.borderColor} ring-1 ring-inset ${meta.borderColor}`
          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {isDetected && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
          detected
        </span>
      )}
      <div className={`flex items-center gap-1.5 mb-1.5 ${isSelected ? meta.color : 'text-slate-500'}`}>
        {icon}
        <p className={`text-xs font-bold uppercase tracking-wider ${isSelected ? meta.color : 'text-slate-400'}`}>
          {meta.label}
        </p>
      </div>
      <p className={`text-[11px] mb-2 ${isSelected ? meta.color : 'text-slate-500'} font-medium`}>
        {meta.tagline}
      </p>
      {/* Mini allocation preview */}
      <div className="space-y-0.5">
        {Object.entries(targets)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px]">
              <span className="text-slate-600">{ASSET_LABEL[k] ?? k}</span>
              <span className={isSelected ? 'text-slate-300 font-medium' : 'text-slate-600'}>{v}%</span>
            </div>
          ))}
        {Object.entries(targets).filter(([, v]) => v > 0).length > 3 && (
          <p className="text-[10px] text-slate-700">+{Object.entries(targets).filter(([, v]) => v > 0).length - 3} more</p>
        )}
      </div>
    </button>
  );
}

// ── Framework snapshot strip ──────────────────────────────────────────────────
function FrameworkStrip() {
  const { analysis, confirmedRegime, status, lastUpdated, fetch } = useRegimeStore();
  const bc     = analysis?.businessCycle;
  const vol    = analysis?.volatility;
  const liq    = analysis?.liquidity;
  const credit = analysis?.creditCycle;

  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  if (!analysis) {
    return (
      <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
        <p className="text-xs text-slate-500">Run regime detection to see live framework readings</p>
        <button
          onClick={fetch}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={status === 'loading' ? 'animate-spin' : ''} />
          {status === 'loading' ? 'Detecting…' : 'Detect Now'}
        </button>
      </div>
    );
  }

  const bwMeta   = REGIME_META[confirmedRegime];
  const bcMeta   = bc     ? BUSINESS_CYCLE_META[bc.phase]   : null;
  const volMeta  = vol    ? VOLATILITY_META[vol.level]       : null;
  const liqMeta  = liq    ? LIQUIDITY_META[liq.level]        : null;
  const credMeta = credit ? CREDIT_CYCLE_META[credit.phase]  : null;

  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Framework Readings</p>
        <div className="flex items-center gap-3">
          {lastUpdatedStr && <span className="text-xs text-slate-600">{lastUpdatedStr}</span>}
          <button
            onClick={fetch}
            disabled={status === 'loading'}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={10} className={status === 'loading' ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {/* Bridgewater */}
        <div className={`rounded-lg border px-3 py-2 ${bwMeta.bgColor} ${bwMeta.borderColor}`}>
          <p className="text-[10px] text-slate-500 mb-0.5">Bridgewater</p>
          <p className={`text-xs font-bold ${bwMeta.color}`}>{bwMeta.label}</p>
          <p className="text-[10px] text-slate-600">{bwMeta.tagline}</p>
        </div>
        {/* Business Cycle */}
        {bcMeta && (
          <div className={`rounded-lg border px-3 py-2 ${bcMeta.bgColor} ${bcMeta.borderColor}`}>
            <p className="text-[10px] text-slate-500 mb-0.5">Business Cycle</p>
            <p className={`text-xs font-bold ${bcMeta.color}`}>{bc!.phase}</p>
            <p className="text-[10px] text-slate-600">
              {bc!.growthMomentum > 0.02 ? 'growth ↑' : bc!.growthMomentum < -0.02 ? 'growth ↓' : 'growth →'}
            </p>
          </div>
        )}
        {/* Volatility */}
        {volMeta && (
          <div className={`rounded-lg border px-3 py-2 ${volMeta.bgColor} ${volMeta.borderColor}`}>
            <p className="text-[10px] text-slate-500 mb-0.5">Volatility</p>
            <p className={`text-xs font-bold ${volMeta.color}`}>{vol!.level}</p>
            <p className="text-[10px] text-slate-600">VIX {vol!.vix.toFixed(1)}</p>
          </div>
        )}
        {/* Liquidity */}
        {liqMeta && (
          <div className={`rounded-lg border px-3 py-2 ${liqMeta.bgColor} ${liqMeta.borderColor}`}>
            <p className="text-[10px] text-slate-500 mb-0.5">Liquidity</p>
            <p className={`text-xs font-bold ${liqMeta.color}`}>{liq!.level}</p>
            <p className="text-[10px] text-slate-600">score {liq!.score > 0 ? '+' : ''}{liq!.score}/±3</p>
          </div>
        )}
        {/* Credit */}
        {credMeta && (
          <div className={`rounded-lg border px-3 py-2 ${credMeta.bgColor} ${credMeta.borderColor}`}>
            <p className="text-[10px] text-slate-500 mb-0.5">Credit</p>
            <p className={`text-xs font-bold ${credMeta.color}`}>{credit!.phase}</p>
            <p className="text-[10px] text-slate-600">HY/IG {credit!.spreadTrend}</p>
          </div>
        )}
      </div>
      {/* Consensus */}
      {analysis.consensus && (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
          analysis.consensus.riskBias === 'risk-on'  ? 'bg-emerald-500/10 border-emerald-500/20' :
          analysis.consensus.riskBias === 'risk-off' ? 'bg-red-500/10 border-red-500/20'         :
                                                       'bg-blue-500/10 border-blue-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Consensus:</p>
            <p className={`text-xs font-bold ${
              analysis.consensus.riskBias === 'risk-on'  ? 'text-emerald-400' :
              analysis.consensus.riskBias === 'risk-off' ? 'text-red-400'     : 'text-blue-400'
            }`}>
              {analysis.consensus.riskBias === 'risk-on' ? 'Risk-On' :
               analysis.consensus.riskBias === 'risk-off' ? 'Risk-Off' : 'Balanced'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600">Conviction</p>
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full"
                style={{
                  width: `${analysis.consensus.conviction * 100}%`,
                  backgroundColor:
                    analysis.consensus.riskBias === 'risk-on'  ? '#10b981' :
                    analysis.consensus.riskBias === 'risk-off' ? '#ef4444' : '#3b82f6',
                }} />
            </div>
            <p className="text-xs text-slate-500">{(analysis.consensus.conviction * 100).toFixed(0)}%</p>
          </div>
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
  const { confirmedRegime, analysis } = useRegimeStore();

  const holdings    = filterByPortfolio(allHoldings, activePortfolio);
  const base        = settings.baseCurrency;
  const fmt         = (n: number) => fmtBase(n, base);
  const conv        = (amt: number, ccy: Currency) => toBase(amt, ccy, exchangeRates, base);
  const targets     = settings.targetAllocations;
  const regime      = settings.marketRegime;
  const neutralMode = settings.neutralColorMode;

  const totalValue = holdings.reduce((s, h) => s + conv(h.quantity * h.currentPrice, h.currency), 0);

  const currentAlloc = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});
  const currentPct = Object.fromEntries(
    ALL_CLASSES.map(cls => [cls, totalValue > 0 ? (currentAlloc[cls] ?? 0) / totalValue * 100 : 0])
  ) as Record<AssetClass, number>;

  const relevantClasses = ALL_CLASSES.filter(
    cls => (currentPct[cls] ?? 0) > 0.1 || (targets[cls] ?? 0) > 0
  );

  const applyRegime = (r: RegimeName) => {
    const regimeTargets = REGIME_META[r].targets as Partial<Record<AssetClass, number>>;
    updateSettings({
      marketRegime: r,
      targetAllocations: { ...ZERO_ALLOCS, ...regimeTargets },
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

  // Is the detected regime different from the selected one?
  const detectedIsLive  = confirmedRegime !== 'UNKNOWN';
  const detectedMismatch = detectedIsLive && regime !== confirmedRegime;

  return (
    <div className="space-y-6">

      {/* Live framework readings strip */}
      <FrameworkStrip />

      {/* Mismatch nudge */}
      {detectedMismatch && (
        <div className="flex items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-0.5">Detected regime differs from selected</p>
            <p className="text-xs text-slate-500">
              Live detection: <span className={`font-semibold ${REGIME_META[confirmedRegime].color}`}>{REGIME_META[confirmedRegime].label}</span>
              {regime && (
                <> · Target set for: <span className={`font-semibold ${REGIME_META[regime].color}`}>{REGIME_META[regime].label}</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => applyRegime(confirmedRegime)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
          >
            Apply {REGIME_META[confirmedRegime].label}
          </button>
        </div>
      )}

      {/* Regime selector */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Select Regime</h3>
        <p className="text-xs text-slate-500 mb-4">
          Each regime loads its suggested target allocations. Customise further with the sliders below.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {SELECTABLE_REGIMES.map(r => (
            <RegimeCard
              key={r}
              regime={r}
              isSelected={regime === r}
              isDetected={confirmedRegime === r && confirmedRegime !== 'UNKNOWN'}
              onClick={() => applyRegime(r)}
            />
          ))}
        </div>
        {regime && (
          <div className="mt-4 bg-slate-900/40 rounded-lg px-4 py-3">
            <p className={`text-xs font-semibold mb-1 ${REGIME_META[regime].color}`}>{REGIME_META[regime].label} — Strategy</p>
            <p className="text-xs text-slate-400 leading-relaxed">{REGIME_META[regime].description}</p>
          </div>
        )}
      </div>

      {/* Current vs Target bars */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Allocation Comparison</h3>

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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500">
              Target{regime ? ` — ${REGIME_META[regime].label}` : ''}
            </p>
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
          <p className="text-xs text-slate-500 mt-0.5">Drag sliders to fine-tune each asset class.</p>
        </div>
        <div className="divide-y divide-slate-700/20">
          {relevantClasses.map(cls => {
            const curr = currentPct[cls] ?? 0;
            const tgt  = targets[cls]    ?? 0;
            const gap  = curr - tgt;
            return (
              <div key={cls} className="px-5 py-3 flex items-center gap-4">
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[cls] }} />
                  <span className="text-sm text-slate-300">{ASSET_LABEL[cls]}</span>
                </div>
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
                <span className="text-sm font-semibold text-slate-200 tabular-nums w-10 text-right">{tgt}%</span>
                <span className="text-xs text-slate-500 tabular-nums w-14 text-right">now {curr.toFixed(1)}%</span>
                <span className={`text-xs font-semibold tabular-nums w-16 text-right ${gainColor(gap)}`}>
                  {Math.abs(gap) < 0.5 ? '✓' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rebalancing actions */}
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
                        : (neutralMode ? 'text-blue-400'  : 'text-emerald-400')
                      }>{action}</span>
                      {' '}{ASSET_LABEL[cls]} by ~{Math.abs(gap).toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500">(~{fmt(absGapVal)})</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
