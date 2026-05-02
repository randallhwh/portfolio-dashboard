import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../../store/portfolioStore';
import type { Currency } from '../../types/portfolio';

const PALETTE = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6',
  '#f97316', '#ef4444', '#ec4899', '#84cc16', '#64748b',
];

const ASSET_LABEL: Record<string, string> = {
  stock: 'Stocks', bond: 'Bonds', cash: 'Cash', real_estate: 'Real Estate',
  etf: 'ETF', crypto: 'Crypto', commodity: 'Commodity', other: 'Other',
};

interface SliceTooltipProps { active?: boolean; payload?: Array<{ name: string; value: number; payload: { pct: number } }> }

function SliceTooltip({ active, payload }: SliceTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-300 font-medium">{d.name}</p>
      <p className="text-slate-400 text-xs">{d.payload.pct.toFixed(1)}%</p>
    </div>
  );
}

function DonutSection({
  title, data, colors,
}: {
  title: string;
  data: { name: string; value: number; pct: number }[];
  colors: string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="flex gap-4 items-center">
        {/* Donut */}
        <div className="w-36 h-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={66}
                dataKey="value"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<SliceTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend / table */}
        <div className="flex-1 space-y-1 min-w-0">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-xs text-slate-400 truncate flex-1">{d.name}</span>
              <span className="text-xs font-medium text-slate-300 tabular-nums">{d.pct.toFixed(1)}%</span>
            </div>
          ))}
          {total === 0 && <p className="text-xs text-slate-600 italic">No data</p>}
        </div>
      </div>
    </div>
  );
}

export function BreakdownTab() {
  const { holdings: allHoldings, settings, exchangeRates, activePortfolio } = usePortfolioStore();
  const holdings = filterByPortfolio(allHoldings, activePortfolio);
  const base = settings.baseCurrency;
  const fmt = (n: number) => fmtBase(n, base);
  const conv = (amount: number, ccy: Currency) => toBase(amount, ccy, exchangeRates, base);

  // Investment holdings only (exclude cash bank accounts for sector/region analysis)
  const investmentHoldings = holdings.filter(h => h.assetClass !== 'cash');

  const totalValue      = holdings.reduce((s, h) => s + conv(h.quantity * h.currentPrice, h.currency), 0);
  const investmentValue = investmentHoldings.reduce((s, h) => s + conv(h.quantity * h.currentPrice, h.currency), 0);

  const totalIncome = holdings.reduce((s, h) => {
    if (!h.annualYieldPct) return s;
    return s + conv(h.quantity * h.currentPrice * h.annualYieldPct / 100, h.currency);
  }, 0);
  const portfolioYieldPct = totalValue > 0 ? (totalIncome / totalValue) * 100 : 0;

  // Sector breakdown — investment holdings only, % of investment value
  const sectorMap = investmentHoldings.reduce<Record<string, number>>((acc, h) => {
    const key = h.sector ?? 'Other';
    acc[key] = (acc[key] || 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: investmentValue > 0 ? value / investmentValue * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // Region/Country breakdown — investment holdings only
  const regionMap = investmentHoldings.reduce<Record<string, number>>((acc, h) => {
    const key = h.country ?? 'Unknown';
    acc[key] = (acc[key] || 0) + conv(h.quantity * h.currentPrice, h.currency);
    return acc;
  }, {});
  const regionData = Object.entries(regionMap)
    .map(([name, value]) => ({ name, value, pct: investmentValue > 0 ? value / investmentValue * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // Income by asset class
  const incomeByClass = holdings.reduce<Record<string, { income: number; value: number }>>((acc, h) => {
    if (!acc[h.assetClass]) acc[h.assetClass] = { income: 0, value: 0 };
    acc[h.assetClass].value += conv(h.quantity * h.currentPrice, h.currency);
    if (h.annualYieldPct) {
      acc[h.assetClass].income += conv(h.quantity * h.currentPrice * h.annualYieldPct / 100, h.currency);
    }
    return acc;
  }, {});

  const incomeRows = Object.entries(incomeByClass)
    .map(([cls, { income, value }]) => ({
      label: ASSET_LABEL[cls] ?? cls,
      income,
      value,
      yieldPct: value > 0 ? (income / value) * 100 : 0,
      incomePct: totalIncome > 0 ? (income / totalIncome) * 100 : 0,
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.income - a.income);

  return (
    <div className="space-y-5">
      {/* Portfolio yield summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Portfolio Yield</p>
          <p className="text-lg font-semibold text-emerald-400 tabular-nums">{portfolioYieldPct.toFixed(2)}%</p>
          <p className="text-xs text-slate-600">annual income / total value</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Annual Income</p>
          <p className="text-lg font-semibold text-emerald-400 tabular-nums">+{fmt(totalIncome)}</p>
          <p className="text-xs text-slate-600">{fmt(totalIncome / 12)}/mo</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Holdings</p>
          <p className="text-lg font-semibold text-slate-200 tabular-nums">{holdings.length}</p>
          <p className="text-xs text-slate-600">
            {holdings.filter(h => h.annualYieldPct).length} yield-generating
          </p>
        </div>
      </div>

      {/* Sector & Region donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DonutSection title="Sector Allocation (Investments)" data={sectorData} colors={PALETTE} />
        <DonutSection title="Geographic Allocation (Investments)" data={regionData} colors={[...PALETTE].reverse()} />
      </div>

      {/* Income breakdown by asset class */}
      {incomeRows.some(r => r.income > 0) && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50">
            <p className="text-sm font-semibold text-slate-300">Income Breakdown by Asset Class</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500">Class</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Value</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Yield</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Annual Income</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500">% of Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {incomeRows.map((r) => (
                <tr key={r.label} className="hover:bg-slate-700/20">
                  <td className="px-5 py-3 font-medium text-slate-200">{r.label}</td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{fmt(r.value)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.yieldPct > 0 ? 'text-emerald-400 font-medium' : 'text-slate-600'}>
                      {r.yieldPct > 0 ? `${r.yieldPct.toFixed(2)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.income > 0 ? 'text-emerald-400 font-medium' : 'text-slate-600'}>
                      {r.income > 0 ? `+${fmt(r.income)}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(r.incomePct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums w-8 text-right">
                        {r.incomePct > 0 ? `${r.incomePct.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
