import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Holding, ExchangeRates, Currency } from '../../types/portfolio';
import { toBase, fmtBase } from '../../store/portfolioStore';

interface Props {
  holdings: Holding[];
  neutralMode: boolean;
  exchangeRates: ExchangeRates;
  baseCurrency: Currency;
}

const ASSET_COLORS: Record<string, string> = {
  stock: '#3b82f6',
  etf: '#8b5cf6',
  bond: '#06b6d4',
  cash: '#64748b',
  crypto: '#f59e0b',
  real_estate: '#10b981',
  commodity: '#f97316',
  other: '#6b7280',
};

const ASSET_LABELS: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  bond: 'Bonds',
  cash: 'Cash',
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  commodity: 'Commodities',
  other: 'Other',
};

export function AllocationChart({ holdings, neutralMode: _neutralMode, exchangeRates, baseCurrency }: Props) {
  const conv = (amount: number, ccy: Currency) => toBase(amount, ccy, exchangeRates, baseCurrency);
  const totalValue = holdings.reduce((sum, h) => sum + conv(h.quantity * h.currentPrice, h.currency), 0);

  const byAssetClass = holdings.reduce<Record<string, number>>((acc, h) => {
    const key = h.assetClass;
    acc[key] = (acc[key] || 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});

  const data = Object.entries(byAssetClass).map(([key, value]) => ({
    name: ASSET_LABELS[key] || key,
    value: Math.round(value),
    pct: ((value / totalValue) * 100).toFixed(1),
    color: ASSET_COLORS[key] || '#6b7280',
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof data[0] }> }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
          <p className="font-medium text-slate-100">{d.name}</p>
          <p className="text-slate-400">{fmtBase(d.value, baseCurrency)} — {d.pct}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Asset Allocation</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              iconSize={8}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
