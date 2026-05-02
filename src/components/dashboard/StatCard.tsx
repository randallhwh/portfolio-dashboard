import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  neutralMode?: boolean;
  highlight?: boolean;
}

export function StatCard({ label, value, subValue, trend, icon, neutralMode, highlight }: StatCardProps) {
  const trendColor = neutralMode
    ? trend === 'up' ? 'text-blue-400' : trend === 'down' ? 'text-amber-400' : 'text-slate-400'
    : trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className={`bg-slate-800/60 rounded-xl p-4 border ${highlight ? 'border-blue-500/30' : 'border-slate-700/50'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-slate-600">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
      {subValue && (
        <p className={`text-sm mt-1 font-medium ${trendColor}`}>{subValue}</p>
      )}
    </div>
  );
}
