import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Info, ArrowRight, Activity,
  Zap, Droplets, CreditCard, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useRegimeStore } from '../store/regimeStore';
import { usePortfolioStore, toBase, filterByPortfolio } from '../store/portfolioStore';
import {
  REGIME_META, BUSINESS_CYCLE_META, VOLATILITY_META, LIQUIDITY_META,
  CREDIT_CYCLE_META, TRANSITION_RISK_META,
  type RegimeName, type SignalDetail, type LeadingSignal,
  type BusinessCycleName, type VolatilityLevel, type LiquidityLevel,
  type CreditCyclePhase, type TransitionRiskLevel,
} from '../services/regimeDetection';
import type { AssetClass } from '../types/portfolio';

// ── Quadrant chart ─────────────────────────────────────────────────────────────
function QuadrantChart({ growthScore, inflationScore }: { growthScore: number; inflationScore: number }) {
  const W = 280, H = 280;
  const CX = W / 2, CY = H / 2;
  const scaleX = (CX - 20) / 4;
  const scaleY = (CY - 20) / 3;
  const dotX = CX + growthScore * scaleX;
  const dotY = CY - inflationScore * scaleY;

  const labels: { x: number; y: number; text: string; regime: RegimeName }[] = [
    { x: CX + CX / 2, y: CY - CY / 2, text: 'REFLATION',   regime: 'REFLATION'   },
    { x: CX + CX / 2, y: CY + CY / 2, text: 'GOLDILOCKS',  regime: 'GOLDILOCKS'  },
    { x: CX - CX / 2, y: CY - CY / 2, text: 'STAGFLATION', regime: 'STAGFLATION' },
    { x: CX - CX / 2, y: CY + CY / 2, text: 'RECESSION',   regime: 'RECESSION'   },
  ];

  const quadrantColors: Record<RegimeName, string> = {
    REFLATION: '#f59e0b22', GOLDILOCKS: '#10b98122',
    STAGFLATION: '#ef444422', RECESSION: '#3b82f622',
    RISK_OFF_SPIKE: '#8b5cf622', UNKNOWN: '#64748b22',
  };
  const labelColors: Record<RegimeName, string> = {
    REFLATION: '#fbbf24', GOLDILOCKS: '#34d399',
    STAGFLATION: '#f87171', RECESSION: '#60a5fa',
    RISK_OFF_SPIKE: '#c084fc', UNKNOWN: '#94a3b8',
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs mx-auto">
      <rect x={CX} y={0}  width={CX} height={CY} fill={quadrantColors.REFLATION}   />
      <rect x={CX} y={CY} width={CX} height={CY} fill={quadrantColors.GOLDILOCKS}  />
      <rect x={0}  y={0}  width={CX} height={CY} fill={quadrantColors.STAGFLATION} />
      <rect x={0}  y={CY} width={CX} height={CY} fill={quadrantColors.RECESSION}   />
      {[-3,-2,-1,1,2,3].map(v => (
        <line key={`gx${v}`} x1={CX + v * scaleX} y1={0} x2={CX + v * scaleX} y2={H} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      {[-2,-1,1,2].map(v => (
        <line key={`gy${v}`} x1={0} y1={CY - v * scaleY} x2={W} y2={CY - v * scaleY} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      <line x1={0} y1={CY} x2={W} y2={CY} stroke="#334155" strokeWidth={1.5} />
      <line x1={CX} y1={0} x2={CX} y2={H} stroke="#334155" strokeWidth={1.5} />
      <text x={W - 4} y={CY - 6} fill="#475569" fontSize="9" textAnchor="end">Growth →</text>
      <text x={CX + 4} y={12}    fill="#475569" fontSize="9">Inflation ↑</text>
      {labels.map(l => (
        <text key={l.text} x={l.x} y={l.y} fill={labelColors[l.regime]}
          fontSize="9.5" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
          {l.text}
        </text>
      ))}
      <line x1={dotX} y1={CY}   x2={dotX} y2={dotY} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <line x1={CX}   y1={dotY} x2={dotX} y2={dotY} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <circle cx={dotX} cy={dotY} r={10} fill="white" fillOpacity={0.08} />
      <circle cx={dotX} cy={dotY} r={6}  fill="white" stroke="#1e293b" strokeWidth={1.5} />
      <circle cx={dotX} cy={dotY} r={3}  fill="#3b82f6" />
    </svg>
  );
}

// ── Signal row (Bridgewater signals table) ────────────────────────────────────
function SignalRow({ s }: { s: SignalDetail }) {
  const icon =
    s.direction === 'positive' ? <TrendingUp  size={12} className="text-emerald-400" /> :
    s.direction === 'negative' ? <TrendingDown size={12} className="text-red-400"     /> :
                                 <Minus        size={12} className="text-slate-500"    />;
  const axisColor =
    s.axis === 'growth'    ? 'bg-blue-500/20 text-blue-400'   :
    s.axis === 'inflation' ? 'bg-amber-500/20 text-amber-400' :
                             'bg-violet-500/20 text-violet-400';
  return (
    <tr className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
      <td className="px-4 py-2.5">
        <p className="text-sm font-medium text-slate-200">{s.name}</p>
        <p className="text-xs text-slate-600">{s.ticker}</p>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${axisColor}`}>{s.axis}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">{icon}<span className="text-xs text-slate-300 tabular-nums">{s.value}</span></div>
      </td>
      <td className="px-4 py-2.5"><p className="text-xs text-slate-500 leading-relaxed">{s.description}</p></td>
    </tr>
  );
}

// ── Leading signal row ────────────────────────────────────────────────────────
function LeadingSignalRow({ s }: { s: LeadingSignal }) {
  const sigColor =
    s.signal === 'bullish' ? 'text-emerald-400' :
    s.signal === 'bearish' ? 'text-red-400'     : 'text-slate-500';
  const sigIcon  =
    s.signal === 'bullish' ? <TrendingUp  size={12} className="text-emerald-400" /> :
    s.signal === 'bearish' ? <TrendingDown size={12} className="text-red-400"     /> :
                             <Minus        size={12} className="text-slate-500"    />;
  const strBadge =
    s.strength === 'strong'   ? 'bg-slate-700 text-slate-300' :
    s.strength === 'moderate' ? 'bg-slate-700/60 text-slate-400' :
                                'bg-slate-800 text-slate-600';
  const horizonColor =
    s.timeHorizon === '1-4 weeks' ? 'text-violet-400' :
    s.timeHorizon === '1-3 months' ? 'text-blue-400'  : 'text-slate-500';

  return (
    <tr className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
      <td className="px-4 py-2.5">
        <p className="text-sm font-medium text-slate-200">{s.name}</p>
        <p className="text-xs text-slate-600">{s.tickers}</p>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">{sigIcon}<span className={`text-xs font-medium ${sigColor}`}>{s.signal}</span></div>
        <span className={`text-xs px-1 py-0.5 rounded mt-0.5 inline-block ${strBadge}`}>{s.strength}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-300 tabular-nums">{s.value}</td>
      <td className="px-4 py-2.5"><p className="text-xs text-slate-500 leading-relaxed">{s.implication}</p></td>
      <td className="px-4 py-2.5 text-right"><span className={`text-xs ${horizonColor}`}>{s.timeHorizon}</span></td>
    </tr>
  );
}

// ── Framework mini-card ───────────────────────────────────────────────────────
function FrameworkCard({
  icon, title, level, levelColor, levelBg, levelBorder, subtitle, detail,
}: {
  icon: React.ReactNode;
  title: string;
  level: string;
  levelColor: string;
  levelBg: string;
  levelBorder: string;
  subtitle?: string;
  detail?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${levelBg} ${levelBorder}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-500">{icon}</span>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
      </div>
      <p className={`text-xl font-bold ${levelColor}`}>{level}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      {detail   && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{detail}</p>}
    </div>
  );
}

// ── Allocation bar ─────────────────────────────────────────────────────────────
const ALLOC_COLORS: Record<string, string> = {
  stock: '#3b82f6', bond: '#06b6d4', cash: '#10b981',
  real_estate: '#f59e0b', commodity: '#f97316', other: '#64748b',
};
const ALLOC_LABELS: Record<string, string> = {
  stock: 'Stocks', bond: 'Bonds', cash: 'Cash',
  real_estate: 'Real Estate', commodity: 'Commodities', other: 'Other',
};

function AllocationBar({ alloc, label }: { alloc: Record<string, number>; label: string }) {
  const entries = Object.entries(alloc).filter(([, v]) => v > 0);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      <div className="flex h-7 rounded-lg overflow-hidden">
        {entries.map(([k, v]) => (
          <div
            key={k}
            style={{ width: `${total > 0 ? v / total * 100 : 0}%`, backgroundColor: ALLOC_COLORS[k] ?? '#64748b' }}
            className="relative flex items-center justify-center"
            title={`${ALLOC_LABELS[k] ?? k}: ${v}%`}
          >
            {(total > 0 ? v / total * 100 : 0) >= 10 && (
              <span className="text-xs font-semibold text-white/80 px-1 truncate">{Math.round(v)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Transition risk score gauge ────────────────────────────────────────────────
function RiskGauge({ score, level }: { score: number; level: TransitionRiskLevel }) {
  const meta  = TRANSITION_RISK_META[level];
  const W = 160, H = 90, cx = W / 2, cy = H - 8, r = 68;

  // Arc from 180° to (180 - score*1.8)°
  const startAngle = Math.PI;
  const endAngle   = Math.PI - (score / 100) * Math.PI;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = score > 50 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-36">
        {/* Background arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1e293b" strokeWidth={10} strokeLinecap="round" />
        {/* Filled arc */}
        {score > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
            fill="none" stroke={meta.barColor} strokeWidth={10} strokeLinecap="round" />
        )}
        {/* Score label */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize="22" fontWeight="700">{score}</text>
        <text x={cx} y={cy + 6}  textAnchor="middle" fill="#64748b" fontSize="9">/ 100</text>
        {/* Scale labels */}
        <text x={cx - r - 2} y={cy + 14} fill="#475569" fontSize="8" textAnchor="middle">0</text>
        <text x={cx + r + 2} y={cy + 14} fill="#475569" fontSize="8" textAnchor="middle">100</text>
      </svg>
      <p className={`text-lg font-bold -mt-1 ${meta.color}`}>{meta.label} Risk</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function Regime() {
  const { analysis, confirmedRegime, status, errorDetail, lastUpdated, fetch } = useRegimeStore();
  const { holdings: allHoldings, settings, exchangeRates, activePortfolio } = usePortfolioStore();

  const holdings    = filterByPortfolio(allHoldings, activePortfolio);
  const base        = settings.baseCurrency;
  const neutralMode = settings.neutralColorMode;

  const totalValue = holdings.reduce(
    (s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0
  );

  const currentAlloc = holdings.reduce<Record<string, number>>((acc, h) => {
    const key = ['stock', 'bond', 'cash', 'real_estate', 'commodity', 'etf'].includes(h.assetClass)
      ? h.assetClass : 'other';
    acc[key] = (acc[key] ?? 0) + (totalValue > 0
      ? toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base) / totalValue * 100 : 0);
    return acc;
  }, {});

  const currentAllocRounded = Object.fromEntries(
    Object.entries(currentAlloc).map(([k, v]) => [k, Math.round(v)])
  );

  // Convenience aliases
  const bw           = analysis?.bridgewater;
  const bc           = analysis?.businessCycle;
  const vol          = analysis?.volatility;
  const liq          = analysis?.liquidity;
  const credit       = analysis?.creditCycle;
  const transition   = analysis?.transitionRisk;
  const consensus    = analysis?.consensus;

  const activeRegime: RegimeName = bw?.regime ?? 'UNKNOWN';
  const meta     = REGIME_META[activeRegime];
  const bcMeta   = bc  ? BUSINESS_CYCLE_META[bc.phase]  : null;
  const volMeta  = vol ? VOLATILITY_META[vol.level]     : null;
  const liqMeta  = liq ? LIQUIDITY_META[liq.level]      : null;
  const credMeta = credit ? CREDIT_CYCLE_META[credit.phase] : null;
  const trMeta   = transition ? TRANSITION_RISK_META[transition.level] : null;

  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const targets     = meta.targets as Record<string, number>;
  const allClasses  = [...new Set([...Object.keys(currentAllocRounded), ...Object.keys(targets)])];
  const gapItems    = allClasses
    .map(cls => ({
      cls,
      current: currentAllocRounded[cls] ?? 0,
      target:  targets[cls]             ?? 0,
      gap:     (currentAllocRounded[cls] ?? 0) - (targets[cls] ?? 0),
    }))
    .filter(d => d.current > 0 || d.target > 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const gainColor = (v: number) => {
    if (Math.abs(v) < 2) return 'text-slate-500';
    if (neutralMode) return v > 0 ? 'text-amber-400' : 'text-blue-400';
    return v > 0 ? 'text-red-400' : 'text-emerald-400';
  };

  const growthScore    = bw?.growthScore    ?? 0;
  const inflationScore = bw?.inflationScore ?? 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Market Regime Detection</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            5 frameworks · 10 leading indicators · cross-asset regime classification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdatedStr && <span className="text-xs text-slate-600">Last run: {lastUpdatedStr}</span>}
          <button
            onClick={fetch}
            disabled={status === 'loading'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
            {status === 'loading' ? 'Detecting…' : 'Detect Regime'}
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="flex flex-col gap-1 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">Failed to fetch indicator data. Check your internet connection and try again.</p>
          </div>
          {errorDetail && (
            <p className="text-xs text-red-400/70 font-mono pl-5">{errorDetail}</p>
          )}
        </div>
      )}

      {/* Consensus banner */}
      {consensus && (
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 flex-wrap
          ${consensus.riskBias === 'risk-on'  ? 'bg-emerald-500/10 border-emerald-500/30' :
            consensus.riskBias === 'risk-off' ? 'bg-red-500/10 border-red-500/30'        :
                                                'bg-blue-500/10 border-blue-500/30'}`}>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Cross-Framework Consensus</p>
            <p className={`text-2xl font-bold ${
              consensus.riskBias === 'risk-on'  ? 'text-emerald-400' :
              consensus.riskBias === 'risk-off' ? 'text-red-400'     : 'text-blue-400'
            }`}>
              {consensus.riskBias === 'risk-on' ? 'Risk-On' : consensus.riskBias === 'risk-off' ? 'Risk-Off' : 'Balanced'}
            </p>
            <p className="text-xs text-slate-500 mt-1">{consensus.summary}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Conviction</p>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${consensus.conviction * 100}%`,
                  backgroundColor: consensus.riskBias === 'risk-on' ? '#10b981' :
                                   consensus.riskBias === 'risk-off' ? '#ef4444' : '#3b82f6',
                }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{(consensus.conviction * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}

      {/* 4 additional framework cards */}
      {analysis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {bc && bcMeta && (
            <FrameworkCard
              icon={<Activity size={13} />}
              title="Business Cycle"
              level={bcMeta.label}
              levelColor={bcMeta.color}
              levelBg={bcMeta.bgColor}
              levelBorder={bcMeta.borderColor}
              subtitle={
                bc.growthMomentum > 0.02
                  ? `Growth ↑ accel`
                  : bc.growthMomentum < -0.02
                  ? `Growth ↓ decel`
                  : 'Growth flat'
              }
              detail={bcMeta.recommendation}
            />
          )}
          {vol && volMeta && (
            <FrameworkCard
              icon={<Zap size={13} />}
              title="Volatility"
              level={volMeta.label}
              levelColor={volMeta.color}
              levelBg={volMeta.bgColor}
              levelBorder={volMeta.borderColor}
              subtitle={`VIX ${vol.vix.toFixed(1)} · ${vol.vixTrend === 'rising' ? '↑ rising' : vol.vixTrend === 'falling' ? '↓ falling' : '→ stable'}`}
              detail={`Bond vol: ${vol.bondVolProxy.toFixed(1)}% ann.`}
            />
          )}
          {liq && liqMeta && (
            <FrameworkCard
              icon={<Droplets size={13} />}
              title="Liquidity"
              level={liqMeta.label}
              levelColor={liqMeta.color}
              levelBg={liqMeta.bgColor}
              levelBorder={liqMeta.borderColor}
              subtitle={`Score: ${liq.score > 0 ? '+' : ''}${liq.score} / ±3`}
              detail={liq.signals[0]}
            />
          )}
          {credit && credMeta && (
            <FrameworkCard
              icon={<CreditCard size={13} />}
              title="Credit Cycle"
              level={credMeta.label}
              levelColor={credMeta.color}
              levelBg={credMeta.bgColor}
              levelBorder={credMeta.borderColor}
              subtitle={`HY/IG spread: ${credit.spreadTrend}`}
              detail={credit.qualitySpread1M >= 0
                ? `HYG +${(credit.qualitySpread1M * 100).toFixed(1)}% vs LQD (1M)`
                : `HYG ${(credit.qualitySpread1M * 100).toFixed(1)}% vs LQD (1M)`}
            />
          )}
        </div>
      )}

      {/* Framework 1: Bridgewater card + quadrant chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Regime card */}
        <div className={`rounded-xl border p-6 ${meta.bgColor} ${meta.borderColor}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Bridgewater Quadrant
              </p>
              <p className={`text-3xl font-bold ${meta.color}`}>{meta.label}</p>
              <p className="text-sm text-slate-400 mt-1">{meta.tagline}</p>
            </div>
            {confirmedRegime !== activeRegime && bw && (
              <div className="text-right">
                <p className="text-xs text-slate-600">Pending confirmation</p>
                <p className="text-xs text-slate-500">Confirmed: {REGIME_META[confirmedRegime].label}</p>
              </div>
            )}
          </div>

          {bw && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Signal confidence</span>
                <span className={`font-semibold ${meta.color}`}>{(bw.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${bw.confidence * 100}%`,
                    backgroundColor: meta.color.includes('emerald') ? '#10b981'
                      : meta.color.includes('amber') ? '#f59e0b'
                      : meta.color.includes('red')   ? '#ef4444'
                      : meta.color.includes('blue')  ? '#3b82f6' : '#8b5cf6',
                  }}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">{meta.description}</p>

          {bw && activeRegime !== 'RISK_OFF_SPIKE' && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Growth</p>
                <p className={`text-lg font-bold tabular-nums ${growthScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {growthScore >= 0 ? '+' : ''}{growthScore}
                </p>
                <p className="text-xs text-slate-600">/ ±4</p>
              </div>
              <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Inflation</p>
                <p className={`text-lg font-bold tabular-nums ${inflationScore >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                  {inflationScore >= 0 ? '+' : ''}{inflationScore}
                </p>
                <p className="text-xs text-slate-600">/ ±3</p>
              </div>
              <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500 mb-0.5">VIX</p>
                <p className={`text-lg font-bold tabular-nums ${(bw.vixLevel) < 20 ? 'text-emerald-400' : bw.vixLevel < 30 ? 'text-amber-400' : 'text-red-400'}`}>
                  {bw.vixLevel.toFixed(1)}
                </p>
                <p className="text-xs text-slate-600">
                  {bw.vixLevel < 15 ? 'calm' : bw.vixLevel < 20 ? 'normal' : bw.vixLevel < 30 ? 'elevated' : 'crisis'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quadrant chart */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-semibold text-slate-300">Regime Quadrant</p>
            <span title="X = Growth score (±4), Y = Inflation score (±3). Blue dot = current position.">
              <Info size={12} className="text-slate-600 cursor-help" />
            </span>
          </div>
          {bw && activeRegime !== 'UNKNOWN' ? (
            <QuadrantChart growthScore={growthScore} inflationScore={inflationScore} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              Run detection to see quadrant position
            </div>
          )}
        </div>
      </div>

      {/* Business cycle detail */}
      {bc && bcMeta && (
        <div className={`rounded-xl border p-5 ${bcMeta.bgColor} ${bcMeta.borderColor}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Business Cycle Clock</p>
              <p className={`text-xl font-bold ${bcMeta.color}`}>{bcMeta.label} Phase</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Growth Mom.</p>
                <div className="flex items-center justify-center gap-1">
                  {bc.growthMomentum > 0.02 ? <ChevronUp size={14} className="text-emerald-400" /> :
                   bc.growthMomentum < -0.02 ? <ChevronDown size={14} className="text-red-400" /> :
                   <Minus size={14} className="text-slate-500" />}
                  <span className={`text-sm font-semibold tabular-nums ${bc.growthMomentum > 0.02 ? 'text-emerald-400' : bc.growthMomentum < -0.02 ? 'text-red-400' : 'text-slate-500'}`}>
                    {bc.growthMomentum >= 0 ? '+' : ''}{(bc.growthMomentum * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-slate-600">ann. diff</p>
              </div>
              <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Infl. Mom.</p>
                <div className="flex items-center justify-center gap-1">
                  {bc.inflationMomentum > 0.02 ? <ChevronUp size={14} className="text-amber-400" /> :
                   bc.inflationMomentum < -0.02 ? <ChevronDown size={14} className="text-blue-400" /> :
                   <Minus size={14} className="text-slate-500" />}
                  <span className={`text-sm font-semibold tabular-nums ${bc.inflationMomentum > 0.02 ? 'text-amber-400' : bc.inflationMomentum < -0.02 ? 'text-blue-400' : 'text-slate-500'}`}>
                    {bc.inflationMomentum >= 0 ? '+' : ''}{(bc.inflationMomentum * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-slate-600">ann. diff</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-2">{bc.description}</p>
          <div className="flex items-center gap-2 bg-slate-900/30 rounded-lg px-3 py-2">
            <ArrowRight size={12} className={bcMeta.color} />
            <p className={`text-xs font-medium ${bcMeta.color}`}>{bc.recommendation}</p>
          </div>
        </div>
      )}

      {/* Liquidity + volatility detail row */}
      {(vol || liq) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {vol && volMeta && (
            <div className={`rounded-xl border p-5 ${volMeta.bgColor} ${volMeta.borderColor}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Volatility Regime</p>
              <p className={`text-xl font-bold mb-1 ${volMeta.color}`}>{volMeta.label}</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{vol.description}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/40 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">VIX</p>
                  <p className={`text-lg font-bold ${volMeta.color}`}>{vol.vix.toFixed(1)}</p>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">20d Avg</p>
                  <p className="text-lg font-bold text-slate-300">{vol.vix20dAvg.toFixed(1)}</p>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Bond Vol</p>
                  <p className="text-lg font-bold text-slate-300">{vol.bondVolProxy.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}
          {liq && liqMeta && (
            <div className={`rounded-xl border p-5 ${liqMeta.bgColor} ${liqMeta.borderColor}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Liquidity Regime</p>
              <p className={`text-xl font-bold mb-1 ${liqMeta.color}`}>{liqMeta.label}</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{liq.description}</p>
              <div className="space-y-1.5">
                {liq.signals.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                    <p className="text-xs text-slate-500">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bridgewater signal breakdown */}
      {bw && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bridgewater Signal Breakdown
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              10 cross-asset indicators · Growth axis (±4) and Inflation axis (±3)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Indicator</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Axis</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Reading</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Interpretation</th>
                </tr>
              </thead>
              <tbody>{bw.signals.map((s, i) => <SignalRow key={i} s={s} />)}</tbody>
            </table>
          </div>
          {bw.dataAge === 'stale' && (
            <div className="px-4 py-2 border-t border-slate-700/30 flex items-center gap-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-xs text-amber-400">Limited price history — signals may be less reliable (60+ days required).</p>
            </div>
          )}
        </div>
      )}

      {/* Transition Risk + Leading Indicators */}
      {transition && trMeta && (
        <div className={`rounded-xl border overflow-hidden ${trMeta.bgColor} ${trMeta.borderColor}`}>
          <div className="px-5 py-4 border-b border-slate-700/30">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
              Regime Transition Risk
            </p>
            <p className="text-xs text-slate-600">
              10 leading indicators measuring probability of near-term regime shift
            </p>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap gap-6 items-start mb-5">
              {/* Gauge */}
              <RiskGauge score={transition.score} level={transition.level} />

              {/* Description + next regime */}
              <div className="flex-1 min-w-48">
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{transition.description}</p>
                {transition.mostLikelyNextRegime && (
                  <div className="bg-slate-900/40 rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-500 mb-1.5">Most Likely Next Regime</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${REGIME_META[activeRegime].color}`}>{REGIME_META[activeRegime].label}</p>
                      <ArrowRight size={14} className="text-slate-600" />
                      <p className={`text-sm font-bold ${REGIME_META[transition.mostLikelyNextRegime].color}`}>
                        {REGIME_META[transition.mostLikelyNextRegime].label}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Based on business cycle momentum direction
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Leading signals table */}
            <div className="overflow-x-auto rounded-lg border border-slate-700/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/30 bg-slate-900/30">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Leading Indicator</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Signal</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Reading</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Implication</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Horizon</th>
                  </tr>
                </thead>
                <tbody>
                  {transition.signals.map((s, i) => <LeadingSignalRow key={i} s={s} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio alignment */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Portfolio Alignment</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Your current allocation vs. suggested weights for{' '}
            <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <AllocationBar alloc={currentAllocRounded} label="Your Current Allocation" />
          <AllocationBar alloc={targets} label={`${meta.label} Target Allocation`} />
          <div className="flex flex-wrap gap-3">
            {Object.entries(ALLOC_LABELS).filter(([k]) =>
              (currentAllocRounded[k] ?? 0) > 0 || (targets[k] ?? 0) > 0
            ).map(([k, label]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALLOC_COLORS[k] }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-700/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30 bg-slate-900/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Asset Class</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Current</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Target</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Gap</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {gapItems.map(({ cls, current, target, gap }) => (
                  <tr key={cls} className="hover:bg-slate-700/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALLOC_COLORS[cls] ?? '#64748b' }} />
                        <span className="text-sm text-slate-300">{ALLOC_LABELS[cls] ?? cls}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{current}%</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{target}%</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${gainColor(gap)}`}>
                      {Math.abs(gap) < 2 ? '✓' : `${gap > 0 ? '+' : ''}${gap}%`}
                    </td>
                    <td className="px-4 py-2.5">
                      {Math.abs(gap) >= 5 ? (
                        <span className={`text-xs font-medium ${gap > 0
                          ? (neutralMode ? 'text-amber-400' : 'text-red-400')
                          : (neutralMode ? 'text-blue-400'  : 'text-emerald-400')}`}>
                          {gap > 0 ? `Reduce by ${gap}%` : `Increase by ${Math.abs(gap)}%`}
                        </span>
                      ) : Math.abs(gap) >= 2 ? (
                        <span className="text-xs text-slate-500">Minor drift</span>
                      ) : (
                        <span className="text-xs text-slate-600">On target</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Regime guide */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          All-Regime Asset Class Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {(['GOLDILOCKS', 'REFLATION', 'STAGFLATION', 'RECESSION'] as RegimeName[]).map(r => {
            const m = REGIME_META[r];
            const isActive = r === activeRegime;
            return (
              <div key={r} className={`rounded-lg border p-3 transition-all
                ${isActive ? `${m.bgColor} ${m.borderColor}` : 'bg-slate-800/40 border-slate-700/30'}`}>
                <p className={`text-xs font-bold mb-0.5 ${isActive ? m.color : 'text-slate-400'}`}>{m.label}</p>
                <p className="text-xs text-slate-600 mb-2">{m.tagline}</p>
                {Object.entries(m.targets)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-500">{ALLOC_LABELS[k] ?? k}</span>
                      <span className={isActive ? 'text-slate-300 font-medium' : 'text-slate-600'}>{v}%</span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
