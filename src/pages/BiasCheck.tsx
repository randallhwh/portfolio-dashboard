import { AlertTriangle, Brain, CheckCircle, Info, TrendingDown, Repeat, Layers, ShieldAlert, Scale } from 'lucide-react';
import { usePortfolioStore } from '../store/portfolioStore';
import type { BiasAlert } from '../types/portfolio';

const BIAS_META: Record<BiasAlert['type'], { label: string; icon: typeof Brain; description: string; color: string }> = {
  sunk_cost: {
    label: 'Sunk Cost Fallacy',
    icon: TrendingDown,
    description: 'Continuing to hold or invest because of past losses, rather than future prospects.',
    color: 'amber',
  },
  disposition: {
    label: 'Disposition Effect',
    icon: Scale,
    description: 'Tendency to sell winners too early and hold losers too long.',
    color: 'red',
  },
  loss_aversion: {
    label: 'Loss Aversion',
    icon: ShieldAlert,
    description: 'Disproportionate fear of losses leading to overly defensive positioning.',
    color: 'orange',
  },
  concentration: {
    label: 'Concentration Risk',
    icon: Layers,
    description: 'Overconfidence leading to under-diversification in single positions.',
    color: 'red',
  },
  recency: {
    label: 'Recency Bias',
    icon: Repeat,
    description: 'Over-weighting recent events when making investment decisions.',
    color: 'blue',
  },
  mental_accounting: {
    label: 'Mental Accounting',
    icon: Brain,
    description: 'Treating money differently based on its source or account label rather than total wealth.',
    color: 'violet',
  },
  overconfidence: {
    label: 'Overconfidence',
    icon: AlertTriangle,
    description: 'Overestimating ability to predict markets or pick winners.',
    color: 'amber',
  },
};

const SEVERITY_STYLE = {
  high: 'border-red-500/40 bg-red-500/5',
  medium: 'border-amber-500/40 bg-amber-500/5',
  low: 'border-blue-500/40 bg-blue-500/5',
};

const SEVERITY_BADGE = {
  high: 'bg-red-500/20 text-red-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-blue-500/20 text-blue-300',
};

const COLOR_ICON: Record<string, string> = {
  red: 'text-red-400',
  amber: 'text-amber-400',
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  violet: 'text-violet-400',
};

function AlertCard({ alert }: { alert: BiasAlert }) {
  const meta = BIAS_META[alert.type];
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_STYLE[alert.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={18} className={COLOR_ICON[meta.color] || 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SEVERITY_BADGE[alert.severity]}`}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 font-medium">{meta.label}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">{alert.title}</h3>
          <p className="text-sm text-slate-400 mb-3">{alert.description}</p>
          <div className="flex items-start gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
            <Info size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300 font-medium">{alert.actionPrompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BiasSummaryCard({
  type,
  count,
  active,
}: {
  type: BiasAlert['type'];
  count: number;
  active: boolean;
}) {
  const meta = BIAS_META[type];
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border p-3.5 transition-all ${active ? 'border-slate-600 bg-slate-800/80' : 'border-slate-700/40 bg-slate-800/20 opacity-50'}`}>
      <div className="flex items-center gap-2.5 mb-1.5">
        <Icon size={15} className={active ? COLOR_ICON[meta.color] : 'text-slate-600'} />
        <span className="text-xs font-semibold text-slate-300">{meta.label}</span>
        {active && (
          <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">{count}</span>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{meta.description}</p>
    </div>
  );
}

const BIAS_EDUCATION = [
  {
    bias: 'Sunk Cost Fallacy',
    question: 'Would I buy this position today at the current price, with fresh capital?',
    why: 'Past losses are gone regardless of your decision. Only future prospects matter.',
  },
  {
    bias: 'Disposition Effect',
    question: 'Am I treating gains and losses symmetrically in my decision-making?',
    why: 'Research shows investors sell winners ~1.5× faster than losers, reducing returns.',
  },
  {
    bias: 'Loss Aversion',
    question: 'Is my defensive positioning based on analysis, or emotional discomfort?',
    why: 'Losses feel ~2× worse than equivalent gains feel good. This distorts rational allocation.',
  },
  {
    bias: 'Mental Accounting',
    question: 'Am I evaluating my total portfolio wealth, not individual account buckets?',
    why: 'Money is fungible. A dollar in a TFSA and a dollar in a brokerage are equal.',
  },
  {
    bias: 'Recency Bias',
    question: 'Am I making decisions based on the last 30 days, or a long-term thesis?',
    why: 'Short-term market moves are mostly noise. Long-term fundamentals drive returns.',
  },
  {
    bias: 'Overconfidence',
    question: 'Have I stress-tested my portfolio against my worst-case scenario?',
    why: 'Investors systematically overestimate their predictive ability and under-diversify.',
  },
];

export function BiasCheck() {
  const { getBiasAlerts } = usePortfolioStore();
  const alerts = getBiasAlerts();

  const byType = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const medCount = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className={`rounded-xl border p-4 ${alerts.length === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : highCount > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <div className="flex items-center gap-3">
          {alerts.length === 0 ? (
            <CheckCircle size={20} className="text-emerald-400" />
          ) : (
            <AlertTriangle size={20} className={highCount > 0 ? 'text-red-400' : 'text-amber-400'} />
          )}
          <div>
            {alerts.length === 0 ? (
              <p className="text-sm font-semibold text-emerald-300">No behavioral bias alerts detected.</p>
            ) : (
              <p className="text-sm font-semibold text-slate-200">
                {alerts.length} alert{alerts.length !== 1 ? 's' : ''} detected:
                {highCount > 0 && <span className="text-red-400"> {highCount} high</span>}
                {medCount > 0 && <span className="text-amber-400"> {medCount} medium</span>}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              These are observations to prompt reflection — not trading advice. Always apply your own analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Bias type overview grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Bias Status Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(Object.keys(BIAS_META) as BiasAlert['type'][]).map((type) => (
            <BiasSummaryCard
              key={type}
              type={type}
              count={byType[type] || 0}
              active={(byType[type] || 0) > 0}
            />
          ))}
        </div>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Active Alerts</h2>
          <div className="space-y-3">
            {[...alerts]
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.severity] - order[b.severity];
              })
              .map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
          </div>
        </div>
      )}

      {/* Decision questions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Pre-Decision Checklist</h2>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
          {BIAS_EDUCATION.map(({ bias, question, why }) => (
            <div key={bias} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-0.5 rounded border border-slate-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{bias}</p>
                  <p className="text-sm text-slate-200 font-medium mb-1">{question}</p>
                  <p className="text-xs text-slate-500">{why}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
