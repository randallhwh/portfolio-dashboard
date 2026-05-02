import type { Holding, PortfolioSettings, ExchangeRates, Currency } from '../../types/portfolio';
import { toBase } from '../../store/portfolioStore';

interface Props {
  holdings: Holding[];
  settings: PortfolioSettings;
  exchangeRates: ExchangeRates;
}

const ASSET_COLORS: Record<string, string> = {
  stock: 'bg-blue-500',
  etf: 'bg-violet-500',
  bond: 'bg-cyan-500',
  cash: 'bg-slate-500',
  crypto: 'bg-amber-500',
  real_estate: 'bg-emerald-500',
  commodity: 'bg-orange-500',
  other: 'bg-gray-500',
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

export function TargetAllocationBar({ holdings, settings, exchangeRates }: Props) {
  const base = settings.baseCurrency;
  const conv = (amount: number, ccy: Currency) => toBase(amount, ccy, exchangeRates, base);
  const totalValue = holdings.reduce((sum, h) => sum + conv(h.quantity * h.currentPrice, h.currency), 0);

  const actualByClass = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] || 0) +
      conv(h.quantity * h.currentPrice, h.currency) / totalValue * 100;
    return acc;
  }, {});

  const assetClasses = Object.keys(settings.targetAllocations).filter(
    (k) => (settings.targetAllocations[k as keyof typeof settings.targetAllocations] > 0) ||
            (actualByClass[k] || 0) > 0
  );

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Allocation vs. Target</h3>
      <div className="space-y-3">
        {assetClasses.map((cls) => {
          const actual = actualByClass[cls] || 0;
          const target = settings.targetAllocations[cls as keyof typeof settings.targetAllocations] || 0;
          const diff = actual - target;
          const colorClass = ASSET_COLORS[cls] || 'bg-gray-500';
          const isOff = Math.abs(diff) > 3;

          return (
            <div key={cls}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">{ASSET_LABELS[cls] || cls}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Target {target}%</span>
                  <span className={`text-xs font-medium ${isOff ? (diff > 0 ? 'text-amber-400' : 'text-blue-400') : 'text-slate-400'}`}>
                    Actual {actual.toFixed(1)}%
                    {isOff && (diff > 0 ? ` (+${diff.toFixed(1)}%)` : ` (${diff.toFixed(1)}%)`)}
                  </span>
                </div>
              </div>
              <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colorClass} opacity-40`}
                  style={{ width: `${Math.min(target, 100)}%` }}
                />
                <div
                  className={`absolute top-0 h-full rounded-full ${colorClass}`}
                  style={{ width: `${Math.min(actual, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
