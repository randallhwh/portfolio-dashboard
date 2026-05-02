import { DollarSign, TrendingUp, TrendingDown, BarChart2, AlertTriangle, Landmark } from 'lucide-react';
import { usePortfolioStore, fmtBase, toBase, filterByPortfolio } from '../store/portfolioStore';
import { StatCard } from '../components/dashboard/StatCard';
import { AllocationChart } from '../components/dashboard/AllocationChart';
import { TopHoldings } from '../components/dashboard/TopHoldings';
import { TargetAllocationBar } from '../components/dashboard/TargetAllocationBar';
import { FxRatesPanel } from '../components/dashboard/FxRatesPanel';

export function Dashboard() {
  const {
    holdings: allHoldings, settings, exchangeRates,
    getBiasAlerts, setActiveView, activePortfolio,
  } = usePortfolioStore();

  const base = settings.baseCurrency;
  const holdings = filterByPortfolio(allHoldings, activePortfolio);
  const fmt = (n: number) => fmtBase(n, base);

  const totalValue = holdings.reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0);
  const totalCost  = holdings.reduce((s, h) => s + toBase(h.quantity * h.avgCostPerShare, h.currency, exchangeRates, base), 0);
  const totalGL    = totalValue - totalCost;
  const glPct      = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const trend      = totalGL >= 0 ? 'up' : 'down';

  const totalAnnualIncome = holdings.reduce((sum, h) => {
    if (!h.annualYieldPct) return sum;
    const incomeLocal = h.quantity * h.currentPrice * h.annualYieldPct / 100;
    return sum + toBase(incomeLocal, h.currency, exchangeRates, base);
  }, 0);

  // Bias alerts always run against all holdings (portfolio-wide risk view)
  const alerts = getBiasAlerts();
  const highAlerts = alerts.filter((a) => a.severity === 'high').length;

  return (
    <div className="space-y-6">
      {activePortfolio === 'SRS' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
          <span className="text-xs px-2 py-0.5 rounded font-bold bg-violet-500/20 text-violet-400">ILLIQUID</span>
          <span className="text-sm text-violet-300">SRS (Supplementary Retirement Scheme) — funds are locked until retirement age</span>
        </div>
      )}
      {activePortfolio !== 'all' && activePortfolio !== 'SRS' && activePortfolio !== 'Liquid' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg w-fit text-xs text-slate-400">
          Viewing: <span className="font-semibold text-slate-200">{activePortfolio}</span> account only
        </div>
      )}
      {alerts.length > 0 && (
        <button
          onClick={() => setActiveView('bias')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
            highAlerts > 0
              ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
              : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          <AlertTriangle size={16} className={highAlerts > 0 ? 'text-red-400' : 'text-amber-400'} />
          <span className={`text-sm font-medium ${highAlerts > 0 ? 'text-red-300' : 'text-amber-300'}`}>
            {alerts.length} behavioral bias {alerts.length === 1 ? 'alert' : 'alerts'} detected
            {highAlerts > 0 ? ` (${highAlerts} high severity)` : ''} — click to review
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={`Total Value (${base})`}
          value={fmt(totalValue)}
          icon={<DollarSign size={16} />}
          highlight
          neutralMode={settings.neutralColorMode}
        />
        {settings.showCostBasis && (
          <StatCard
            label={`Total Cost (${base})`}
            value={fmt(totalCost)}
            icon={<BarChart2 size={16} />}
            neutralMode={settings.neutralColorMode}
          />
        )}
        {settings.showCostBasis && (
          <StatCard
            label={`Gain / Loss (${base})`}
            value={fmt(totalGL)}
            subValue={`${glPct >= 0 ? '+' : ''}${glPct.toFixed(2)}% overall`}
            trend={trend}
            icon={totalGL >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            neutralMode={settings.neutralColorMode}
          />
        )}
        <StatCard
          label={`Annual Income (${base})`}
          value={`+${fmt(totalAnnualIncome)}`}
          subValue={totalAnnualIncome > 0 ? `${fmt(totalAnnualIncome / 12)}/mo · ${totalValue > 0 ? (totalAnnualIncome / totalValue * 100).toFixed(2) : '0.00'}% yield` : 'No yield data'}
          trend="up"
          icon={<Landmark size={16} />}
          neutralMode={settings.neutralColorMode}
        />
        <StatCard
          label="Positions"
          value={String(holdings.length)}
          subValue={`${[...new Set(holdings.map((h) => h.account))].length} accounts · ${[...new Set(holdings.map((h) => h.currency))].join(', ')}`}
          neutralMode={settings.neutralColorMode}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AllocationChart
          holdings={holdings}
          neutralMode={settings.neutralColorMode}
          exchangeRates={exchangeRates}
          baseCurrency={base}
        />
        <TargetAllocationBar holdings={holdings} settings={settings} exchangeRates={exchangeRates} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopHoldings
          holdings={holdings}
          showCostBasis={settings.showCostBasis}
          neutralMode={settings.neutralColorMode}
          exchangeRates={exchangeRates}
          baseCurrency={base}
        />
        <FxRatesPanel />
      </div>
    </div>
  );
}
