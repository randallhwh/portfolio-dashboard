import { useRef } from 'react';
import { Activity, Zap, Droplets, CreditCard, TrendingDown, TrendingUp, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../../store/portfolioStore';
import { useRegimeStore } from '../../store/regimeStore';
import {
  REGIME_META,
  BUSINESS_CYCLE_META,
  VOLATILITY_META,
  LIQUIDITY_META,
  CREDIT_CYCLE_META,
  TRANSITION_RISK_META,
  type RegimeName,
  type FullRegimeAnalysis,
} from '../../services/regimeDetection';
import type { AssetClass, Currency } from '../../types/portfolio';

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
  stock: '#3b82f6', bond: '#06b6d4', cash: '#10b981',
  real_estate: '#f59e0b', etf: '#8b5cf6', crypto: '#f97316',
  commodity: '#ef4444', other: '#64748b',
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

// ── Adjustment logic ──────────────────────────────────────────────────────────

interface FrameworkAdj {
  framework: string;
  reading: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  deltas: { cls: string; delta: number }[];
  reason: string;
}

function computeAdjustments(analysis: FullRegimeAnalysis): FrameworkAdj[] {
  const { businessCycle: bc, volatility: vol, liquidity: liq, creditCycle: credit, transitionRisk: tr } = analysis;
  const result: FrameworkAdj[] = [];

  // ── Business Cycle ──
  const bcMeta = BUSINESS_CYCLE_META[bc.phase];
  const bcDeltas: { cls: string; delta: number }[] = [];
  if      (bc.phase === 'RECOVERY')    { bcDeltas.push({ cls: 'stock', delta: 5 }, { cls: 'bond', delta: -5 }); }
  else if (bc.phase === 'EXPANSION')   { bcDeltas.push({ cls: 'commodity', delta: 5 }, { cls: 'bond', delta: -5 }); }
  else if (bc.phase === 'SLOWDOWN')    { bcDeltas.push({ cls: 'stock', delta: -5 }, { cls: 'bond', delta: 5 }); }
  else if (bc.phase === 'CONTRACTION') { bcDeltas.push({ cls: 'stock', delta: -10 }, { cls: 'bond', delta: 5 }, { cls: 'cash', delta: 5 }); }
  result.push({
    framework: 'Business Cycle', reading: bc.phase,
    icon: <Activity size={13} />,
    color: bcMeta.color, bgColor: bcMeta.bgColor, borderColor: bcMeta.borderColor,
    description: bc.phase === 'RECOVERY'
      ? `Growth re-accelerating (mom. ${bc.growthMomentum >= 0 ? '+' : ''}${(bc.growthMomentum * 100).toFixed(1)}%). Early-cycle leaders outperform.`
      : bc.phase === 'EXPANSION'
      ? `Both growth and inflation accelerating. Broad equity participation, cyclicals and real assets favoured.`
      : bc.phase === 'SLOWDOWN'
      ? `Growth decelerating (mom. ${(bc.growthMomentum * 100).toFixed(1)}%). Late-cycle — breadth narrowing, rotate defensive.`
      : bc.phase === 'CONTRACTION'
      ? `Both growth and inflation falling. Recessionary pressure — capital preservation in bonds and cash.`
      : 'Insufficient momentum data to classify the cycle phase.',
    deltas: bcDeltas,
    reason: bc.phase === 'RECOVERY'    ? 'Add equities, cut defensive bonds — early-cycle leaders outperform'
          : bc.phase === 'EXPANSION'   ? 'Add real assets and commodities, trim long bonds — mid-cycle'
          : bc.phase === 'SLOWDOWN'    ? 'Rotate from equities to bonds — late-cycle defensiveness'
          : bc.phase === 'CONTRACTION' ? 'Preserve capital in bonds and cash — minimum equity'
          : 'No adjustment — cycle phase unknown',
  });

  // ── Volatility ──
  const volMeta = VOLATILITY_META[vol.level];
  const volDeltas: { cls: string; delta: number }[] = [];
  if      (vol.level === 'LOW')      { volDeltas.push({ cls: 'stock', delta: 3 }, { cls: 'cash', delta: -3 }); }
  else if (vol.level === 'ELEVATED') { volDeltas.push({ cls: 'stock', delta: -5 }, { cls: 'cash', delta: 5 }); }
  else if (vol.level === 'HIGH')     { volDeltas.push({ cls: 'stock', delta: -8 }, { cls: 'bond', delta: 3 }, { cls: 'cash', delta: 5 }); }
  else if (vol.level === 'CRISIS')   { volDeltas.push({ cls: 'stock', delta: -15 }, { cls: 'bond', delta: 5 }, { cls: 'cash', delta: 10 }); }
  result.push({
    framework: 'Volatility', reading: `${vol.level} · VIX ${vol.vix.toFixed(1)}`,
    icon: <Zap size={13} />,
    color: volMeta.color, bgColor: volMeta.bgColor, borderColor: volMeta.borderColor,
    description: `VIX ${vol.vix.toFixed(1)} vs 20d avg ${vol.vix20dAvg.toFixed(1)} (${vol.vixTrend}). Bond vol proxy: ${vol.bondVolProxy.toFixed(1)}% ann.`,
    deltas: volDeltas,
    reason: vol.level === 'LOW'      ? 'Complacency zone — lean into equities, reduce cash drag'
          : vol.level === 'NORMAL'   ? 'Standard vol — no adjustment to base allocation'
          : vol.level === 'ELEVATED' ? 'VIX elevated — reduce equity exposure, build cash buffer'
          : vol.level === 'HIGH'     ? 'High stress — defensive shift across portfolio, raise cash'
          : 'Crisis mode — emergency capital preservation, maximum cash',
  });

  // ── Liquidity ──
  const liqMeta = LIQUIDITY_META[liq.level];
  const liqDeltas: { cls: string; delta: number }[] = [];
  if      (liq.level === 'AMPLE')      { liqDeltas.push({ cls: 'stock', delta: 3 }, { cls: 'cash', delta: -3 }); }
  else if (liq.level === 'TIGHTENING') { liqDeltas.push({ cls: 'stock', delta: -5 }, { cls: 'cash', delta: 8 }, { cls: 'bond', delta: -3 }); }
  else if (liq.level === 'STRESS')     { liqDeltas.push({ cls: 'stock', delta: -10 }, { cls: 'cash', delta: 10 }); }
  result.push({
    framework: 'Liquidity', reading: liq.level,
    icon: <Droplets size={13} />,
    color: liqMeta.color, bgColor: liqMeta.bgColor, borderColor: liqMeta.borderColor,
    description: liq.signals.slice(0, 2).join(' · '),
    deltas: liqDeltas,
    reason: liq.level === 'AMPLE'      ? 'Easy conditions — lean into risk, reduce cash drag'
          : liq.level === 'NEUTRAL'    ? 'Neutral conditions — no adjustment to base allocation'
          : liq.level === 'TIGHTENING' ? 'Policy tightening — cut equities and duration, build cash'
          : 'Acute stress — maximum cash, exit illiquid and long-duration positions',
  });

  // ── Credit Cycle ──
  const credMeta = CREDIT_CYCLE_META[credit.phase];
  const creditDeltas: { cls: string; delta: number }[] = [];
  if      (credit.phase === 'WIDENING') { creditDeltas.push({ cls: 'stock', delta: -3 }, { cls: 'bond', delta: 3 }); }
  else if (credit.phase === 'STRESS')   { creditDeltas.push({ cls: 'stock', delta: -7 }, { cls: 'bond', delta: 3 }, { cls: 'cash', delta: 4 }); }
  result.push({
    framework: 'Credit Cycle', reading: credit.phase,
    icon: <CreditCard size={13} />,
    color: credMeta.color, bgColor: credMeta.bgColor, borderColor: credMeta.borderColor,
    description: `HY vs IG 1M spread: ${credit.qualitySpread1M >= 0 ? '+' : ''}${(credit.qualitySpread1M * 100).toFixed(1)}% (${credit.spreadTrend}). ${credit.description}`,
    deltas: creditDeltas,
    reason: credit.phase === 'EXPANSION' ? 'HY outperforming — credit cycle supportive, no adjustment'
          : credit.phase === 'STABLE'    ? 'Credit neutral — no adjustment to base allocation'
          : credit.phase === 'WIDENING'  ? 'Spreads widening — rotate from equities to quality bonds'
          : 'Credit stress — defensive; avoid HY, move to quality bonds and cash',
  });

  // ── Transition Risk ──
  const trMeta = TRANSITION_RISK_META[tr.level];
  const trDeltas: { cls: string; delta: number }[] = [];
  if      (tr.level === 'MODERATE') { trDeltas.push({ cls: 'stock', delta: -3 }, { cls: 'cash', delta: 3 }); }
  else if (tr.level === 'ELEVATED') { trDeltas.push({ cls: 'stock', delta: -7 }, { cls: 'bond', delta: 2 }, { cls: 'cash', delta: 5 }); }
  else if (tr.level === 'HIGH')     { trDeltas.push({ cls: 'stock', delta: -10 }, { cls: 'bond', delta: 2 }, { cls: 'cash', delta: 8 }); }
  result.push({
    framework: 'Transition Risk', reading: `${tr.level} · ${tr.score}/100`,
    icon: <AlertTriangle size={13} />,
    color: trMeta.color, bgColor: trMeta.bgColor, borderColor: trMeta.borderColor,
    description: tr.description + (tr.mostLikelyNextRegime ? ` Most likely next: ${REGIME_META[tr.mostLikelyNextRegime].label}.` : ''),
    deltas: trDeltas,
    reason: tr.level === 'LOW'      ? 'Regime stable — no pre-emptive defensive adjustment'
          : tr.level === 'MODERATE' ? 'Early warnings — trim equity slightly ahead of potential shift'
          : tr.level === 'ELEVATED' ? 'Multiple signals — meaningful defensive shift warranted now'
          : 'Shift likely imminent — significant reduction in risk assets',
  });

  return result;
}

function buildSuggestedAllocation(
  baseRegime: RegimeName,
  adjustments: FrameworkAdj[],
): Record<string, number> {
  const raw = { ...REGIME_META[baseRegime].targets } as Record<string, number>;
  for (const adj of adjustments) {
    for (const { cls, delta } of adj.deltas) {
      raw[cls] = (raw[cls] ?? 0) + delta;
    }
  }
  for (const k of Object.keys(raw)) raw[k] = Math.max(0, Math.min(80, raw[k]));
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total <= 0) return raw;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Math.round((v / total) * 100);
  // fix rounding drift
  const sum = Object.values(out).reduce((s, v) => s + v, 0);
  if (sum !== 100) {
    const maxKey = Object.entries(out).sort(([, a], [, b]) => b - a)[0]?.[0];
    if (maxKey) out[maxKey] += 100 - sum;
  }
  return out;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StaticBar({ values, label, dim }: { values: Record<string, number>; label: string; dim?: boolean }) {
  const entries = Object.entries(values).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      <div className={`flex h-8 rounded-lg overflow-hidden ${dim ? 'opacity-50' : ''}`}>
        {entries.map(([k, v]) => (
          <div
            key={k}
            title={`${ASSET_LABEL[k] ?? k}: ${v}%`}
            className="relative flex items-center justify-center overflow-hidden"
            style={{ width: `${total > 0 ? v / total * 100 : 0}%`, backgroundColor: ASSET_COLORS[k] ?? '#64748b' }}
          >
            {total > 0 && v / total * 100 >= 10 && (
              <span className="text-xs font-semibold text-white/80 px-1 truncate pointer-events-none">
                {Math.round(v)}%
              </span>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="flex-1 bg-slate-700/40 flex items-center justify-center">
            <span className="text-xs text-slate-600">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaChip({ cls, delta }: { cls: string; delta: number }) {
  const isPos = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full
      ${isPos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {isPos ? '+' : ''}{delta}% {ASSET_LABEL[cls] ?? cls}
    </span>
  );
}

function FrameworkAdjCard({ adj }: { adj: FrameworkAdj }) {
  const isNeutral = adj.deltas.length === 0;
  return (
    <div className={`rounded-xl border p-4 ${adj.bgColor} ${adj.borderColor}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${adj.color}`}>
        {adj.icon}
        <p className="text-[10px] font-bold uppercase tracking-wider">{adj.framework}</p>
      </div>
      <p className={`text-sm font-bold mb-1.5 ${adj.color}`}>{adj.reading}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{adj.description}</p>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Portfolio impact</p>
        {isNeutral ? (
          <p className="text-[11px] text-slate-600 italic">Neutral — no adjustment to base</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {adj.deltas.map(d => <DeltaChip key={d.cls} cls={d.cls} delta={d.delta} />)}
          </div>
        )}
        <p className="text-[11px] text-slate-500 leading-snug">{adj.reason}</p>
      </div>
    </div>
  );
}

function DraggableBar({ classes, values, onUpdate }: {
  classes: AssetClass[];
  values: Record<string, number>;
  onUpdate: (cls: AssetClass, val: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const active = classes.filter(c => (values[c] ?? 0) > 0);
  const total  = active.reduce((s, c) => s + (values[c] ?? 0), 0);

  const startDrag = (e: React.MouseEvent, leftCls: AssetClass, rightCls: AssetClass) => {
    e.preventDefault();
    const leftStart = values[leftCls]  ?? 0;
    const combined  = leftStart + (values[rightCls] ?? 0);
    const startX    = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const delta = ((ev.clientX - startX) / barRef.current.getBoundingClientRect().width) * 100;
      const newL  = Math.round(Math.max(0, Math.min(combined, leftStart + delta)));
      onUpdate(leftCls, newL);
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
          <div key={cls} className="relative flex items-center justify-center overflow-hidden transition-[width] duration-75"
            style={{ width: `${pct}%`, backgroundColor: ASSET_COLORS[cls] }}>
            {pct >= 9 && (
              <span className="text-xs font-semibold text-white/90 px-1 truncate z-10 pointer-events-none">
                {ASSET_LABEL[cls]} {Math.round(values[cls] ?? 0)}%
              </span>
            )}
            {idx < active.length - 1 && (
              <div className="absolute right-0 top-0 bottom-0 w-3 z-20 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => startDrag(e, cls, active[idx + 1])}>
                <div className="w-px h-7 bg-white/40 group-hover:bg-white/80 transition-colors" />
                <div className="absolute w-3 h-full" />
              </div>
            )}
          </div>
        );
      })}
      {active.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-600">Set target allocations below</div>
      )}
    </div>
  );
}

function RegimeCard({ regime, isSelected, isDetected, onClick }: {
  regime: RegimeName; isSelected: boolean; isDetected: boolean; onClick: () => void;
}) {
  const meta    = REGIME_META[regime];
  const targets = meta.targets as Record<string, number>;
  const icon    = regime === 'GOLDILOCKS'  ? <TrendingUp  size={13} /> :
                  regime === 'REFLATION'   ? <Activity    size={13} /> :
                  regime === 'RECESSION'   ? <TrendingDown size={13} /> :
                  regime === 'STAGFLATION' ? <TrendingDown size={13} /> :
                                             <AlertTriangle size={13} />;
  return (
    <button onClick={onClick}
      className={`relative rounded-xl border p-3.5 text-left transition-all ${
        isSelected
          ? `${meta.bgColor} ${meta.borderColor} ring-1 ring-inset ${meta.borderColor}`
          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
      }`}>
      {isDetected && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
          detected
        </span>
      )}
      <div className={`flex items-center gap-1.5 mb-1 ${isSelected ? meta.color : 'text-slate-500'}`}>
        {icon}
        <p className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? meta.color : 'text-slate-400'}`}>{meta.label}</p>
      </div>
      <p className={`text-[10px] mb-2 font-medium ${isSelected ? meta.color : 'text-slate-600'}`}>{meta.tagline}</p>
      <div className="space-y-0.5">
        {Object.entries(targets).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[10px]">
            <span className="text-slate-600">{ASSET_LABEL[k] ?? k}</span>
            <span className={isSelected ? 'text-slate-300 font-medium' : 'text-slate-600'}>{v}%</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TargetsTab() {
  const { holdings: allHoldings, settings, exchangeRates, activePortfolio, updateSettings } = usePortfolioStore();
  const { confirmedRegime, analysis, status, lastUpdated, fetch } = useRegimeStore();

  const holdings    = filterByPortfolio(allHoldings, activePortfolio);
  const base        = settings.baseCurrency;
  const fmt         = (n: number) => fmtBase(n, base);
  const conv        = (amt: number, ccy: Currency) => toBase(amt, ccy, exchangeRates, base);
  const targets     = settings.targetAllocations;
  const regime      = SELECTABLE_REGIMES.includes(settings.marketRegime as RegimeName)
    ? settings.marketRegime as RegimeName : undefined;
  const neutralMode = settings.neutralColorMode;

  const totalValue = holdings.reduce((s, h) => s + conv(h.quantity * h.currentPrice, h.currency), 0);
  const currentAlloc = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});
  const currentPct = Object.fromEntries(
    ALL_CLASSES.map(cls => [cls, totalValue > 0 ? (currentAlloc[cls] ?? 0) / totalValue * 100 : 0])
  ) as Record<AssetClass, number>;
  const relevantClasses = ALL_CLASSES.filter(cls => (currentPct[cls] ?? 0) > 0.1 || (targets[cls] ?? 0) > 0);

  const applyRegime = (r: RegimeName) => {
    updateSettings({
      marketRegime: r,
      targetAllocations: { ...ZERO_ALLOCS, ...REGIME_META[r].targets as Partial<Record<AssetClass, number>> },
    });
  };
  const applyAllocation = (alloc: Record<string, number>) => {
    updateSettings({ targetAllocations: { ...ZERO_ALLOCS, ...alloc } });
  };
  const setTarget = (cls: AssetClass, val: number) => {
    updateSettings({ targetAllocations: { ...targets, [cls]: val } });
  };

  const totalTarget = ALL_CLASSES.reduce((s, c) => s + (targets[c] ?? 0), 0);
  const gainColor   = (v: number) => {
    if (Math.abs(v) < 1) return 'text-slate-500';
    return neutralMode ? (v > 0 ? 'text-blue-400' : 'text-amber-400') : (v > 0 ? 'text-emerald-400' : 'text-red-400');
  };

  const detectedIsLive   = confirmedRegime !== 'UNKNOWN';
  const detectedMismatch = detectedIsLive && regime !== confirmedRegime;
  const lastUpdatedStr   = lastUpdated
    ? new Date(lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  // Compute adjustments + synthesis when both regime and analysis are available
  const adjustments    = analysis ? computeAdjustments(analysis) : null;
  const baseAlloc      = regime ? REGIME_META[regime].targets as Record<string, number> : null;
  const suggestedAlloc = regime && adjustments ? buildSuggestedAllocation(regime, adjustments) : null;

  // Net deltas per class (for synthesis table)
  const netDeltas: Record<string, number> = {};
  if (adjustments) {
    for (const adj of adjustments) {
      for (const { cls, delta } of adj.deltas) {
        netDeltas[cls] = (netDeltas[cls] ?? 0) + delta;
      }
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Regime selector ── */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Base Regime</h3>
            <p className="text-xs text-slate-500">Select the macro regime that sets your target allocation foundation.</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdatedStr && <span className="text-xs text-slate-600">{lastUpdatedStr}</span>}
            <button onClick={fetch} disabled={status === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-all disabled:opacity-50">
              <RefreshCw size={11} className={status === 'loading' ? 'animate-spin' : ''} />
              {status === 'loading' ? 'Detecting…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
          {SELECTABLE_REGIMES.map(r => (
            <RegimeCard key={r} regime={r} isSelected={regime === r}
              isDetected={confirmedRegime === r && detectedIsLive}
              onClick={() => applyRegime(r)} />
          ))}
        </div>
        {!analysis && (
          <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/30 rounded-lg px-4 py-2.5 mt-1">
            <p className="text-xs text-slate-500">Run regime detection to see framework overlays and synthesized positioning</p>
            <button onClick={fetch} disabled={status === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all disabled:opacity-50 flex-shrink-0">
              <RefreshCw size={11} className={status === 'loading' ? 'animate-spin' : ''} />
              {status === 'loading' ? 'Detecting…' : 'Detect Now'}
            </button>
          </div>
        )}
        {regime && (
          <div className="mt-3 bg-slate-900/40 rounded-lg px-4 py-2.5">
            <p className={`text-xs font-semibold mb-0.5 ${REGIME_META[regime].color}`}>{REGIME_META[regime].label} strategy</p>
            <p className="text-xs text-slate-400 leading-relaxed">{REGIME_META[regime].description}</p>
          </div>
        )}
      </div>

      {/* ── Framework overlay ── */}
      {analysis && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Framework Overlay</h3>
            <p className="text-xs text-slate-500">
              Four additional frameworks modify the base regime allocation. Each shows its current reading and implied positioning adjustment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {adjustments!.map(adj => <FrameworkAdjCard key={adj.framework} adj={adj} />)}
          </div>
        </div>
      )}

      {/* ── Synthesized positioning ── */}
      {regime && adjustments && baseAlloc && suggestedAlloc && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/40">
            <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Synthesized Positioning</h3>
            <p className="text-xs text-slate-500">
              Base allocation ({REGIME_META[regime].label}) adjusted by all framework signals.
            </p>
          </div>
          <div className="p-5 space-y-4">
            {/* Allocation bars */}
            <StaticBar values={baseAlloc} label={`Base — ${REGIME_META[regime].label}`} dim />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700/50" />
              <div className="flex flex-wrap gap-1 max-w-lg">
                {Object.entries(netDeltas)
                  .filter(([, d]) => d !== 0)
                  .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                  .map(([cls, d]) => <DeltaChip key={cls} cls={cls} delta={d} />)
                }
                {Object.keys(netDeltas).length === 0 && (
                  <span className="text-xs text-slate-600 italic">No net adjustments — frameworks confirm base</span>
                )}
              </div>
              <div className="h-px flex-1 bg-slate-700/50" />
            </div>
            <StaticBar values={suggestedAlloc} label="Suggested — all frameworks combined" />

            {/* Delta table */}
            <div className="overflow-x-auto rounded-lg border border-slate-700/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/40 bg-slate-900/30">
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Framework</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Reading</th>
                    {['stock', 'bond', 'cash', 'commodity', 'real_estate'].map(cls => (
                      <th key={cls} className="px-2 py-2 text-center font-medium text-slate-500">{ASSET_LABEL[cls]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/20">
                  {/* Base row */}
                  <tr className="bg-slate-900/20">
                    <td className="px-3 py-2 text-slate-400 font-semibold">Base</td>
                    <td className="px-3 py-2 text-slate-500">{REGIME_META[regime].label}</td>
                    {['stock', 'bond', 'cash', 'commodity', 'real_estate'].map(cls => (
                      <td key={cls} className="px-2 py-2 text-center text-slate-400 tabular-nums">
                        {(baseAlloc[cls] ?? 0) > 0 ? `${baseAlloc[cls]}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  {/* Framework rows */}
                  {adjustments.map(adj => {
                    const hasAny = adj.deltas.length > 0;
                    const deltaMap = Object.fromEntries(adj.deltas.map(d => [d.cls, d.delta]));
                    return (
                      <tr key={adj.framework} className="hover:bg-slate-700/10">
                        <td className="px-3 py-2">
                          <span className={`font-medium ${adj.color}`}>{adj.framework}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{adj.reading}</td>
                        {['stock', 'bond', 'cash', 'commodity', 'real_estate'].map(cls => {
                          const d = deltaMap[cls];
                          return (
                            <td key={cls} className="px-2 py-2 text-center tabular-nums">
                              {d !== undefined ? (
                                <span className={d > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                  {d > 0 ? '+' : ''}{d}%
                                </span>
                              ) : hasAny ? (
                                <span className="text-slate-700">—</span>
                              ) : (
                                <span className="text-slate-700 italic text-[10px]">~</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Net row */}
                  <tr className="bg-slate-900/30 border-t border-slate-700/40 font-semibold">
                    <td className="px-3 py-2 text-slate-300" colSpan={2}>Suggested</td>
                    {['stock', 'bond', 'cash', 'commodity', 'real_estate'].map(cls => (
                      <td key={cls} className="px-2 py-2 text-center text-slate-200 tabular-nums">
                        {(suggestedAlloc[cls] ?? 0) > 0 ? `${suggestedAlloc[cls]}%` : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Apply button */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-600">
                Applying will overwrite your current target allocation. Fine-tune with sliders below.
              </p>
              <button
                onClick={() => applyAllocation(suggestedAlloc)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex-shrink-0"
              >
                Apply Suggested <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detected regime mismatch nudge ── */}
      {detectedMismatch && (
        <div className="flex items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-0.5">Detected regime differs from selected</p>
            <p className="text-xs text-slate-500">
              Live detection: <span className={`font-semibold ${REGIME_META[confirmedRegime].color}`}>{REGIME_META[confirmedRegime].label}</span>
              {regime && <> · Selected: <span className={`font-semibold ${REGIME_META[regime].color}`}>{REGIME_META[regime].label}</span></>}
            </p>
          </div>
          <button onClick={() => applyRegime(confirmedRegime)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors">
            Switch to {REGIME_META[confirmedRegime].label}
          </button>
        </div>
      )}

      {/* ── Current vs target comparison ── */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Allocation Comparison</h3>
        <StaticBar values={currentPct} label="Your Current Allocation" />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500">Target{regime ? ` — ${REGIME_META[regime].label}` : ''}</p>
            {Math.abs(totalTarget - 100) > 1 && (
              <span className="text-xs text-amber-400">Total: {totalTarget}% — adjust to 100%</span>
            )}
          </div>
          <DraggableBar classes={relevantClasses} values={targets} onUpdate={setTarget} />
          <p className="mt-1.5 text-xs text-slate-600">Drag dividers to rebalance between adjacent classes.</p>
        </div>
      </div>

      {/* ── Per-class sliders ── */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <p className="text-sm font-semibold text-slate-300">Fine-Tune Target Allocation</p>
          <p className="text-xs text-slate-500 mt-0.5">Drag sliders to adjust each class individually.</p>
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
                <input type="range" min={0} max={100} step={1} value={tgt}
                  onChange={(e) => setTarget(cls, Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: ASSET_COLORS[cls] }} />
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

      {/* ── Rebalancing actions ── */}
      {relevantClasses.some(cls => Math.abs((currentPct[cls] ?? 0) - (targets[cls] ?? 0)) >= 3) && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Rebalancing Actions</h3>
          <div className="space-y-2">
            {relevantClasses
              .map(cls => ({ cls, gap: (currentPct[cls] ?? 0) - (targets[cls] ?? 0) }))
              .filter(({ gap }) => Math.abs(gap) >= 3)
              .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
              .map(({ cls, gap }) => (
                <div key={cls} className="flex items-center gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[cls] }} />
                  <span className="text-slate-300">
                    <span className={gap > 0
                      ? (neutralMode ? 'text-amber-400' : 'text-red-400')
                      : (neutralMode ? 'text-blue-400' : 'text-emerald-400')}>
                      {gap > 0 ? 'Reduce' : 'Increase'}
                    </span>
                    {' '}{ASSET_LABEL[cls]} by ~{Math.abs(gap).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-500">(~{fmt(Math.abs(gap / 100) * totalValue)})</span>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  );
}
