import type { Holding } from '../../types/portfolio';
import type { ExchangeRates, Currency } from '../../types/portfolio';
import { toBase, fmtBase } from '../../store/portfolioStore';

interface Props {
  holdings: Holding[];
  showCostBasis: boolean;
  neutralMode: boolean;
  exchangeRates: ExchangeRates;
  baseCurrency: Currency;
}

export function TopHoldings({ holdings, showCostBasis, neutralMode, exchangeRates, baseCurrency }: Props) {
  const conv = (amount: number, ccy: Currency) => toBase(amount, ccy, exchangeRates, baseCurrency);
  const totalValue = holdings.reduce((sum, h) => sum + conv(h.quantity * h.currentPrice, h.currency), 0);

  const sorted = [...holdings]
    .sort((a, b) =>
      conv(b.quantity * b.currentPrice, b.currency) - conv(a.quantity * a.currentPrice, a.currency)
    )
    .slice(0, 6);

  const gainColor = (pct: number) => {
    if (neutralMode) return pct >= 0 ? 'text-blue-400' : 'text-amber-400';
    return pct >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Holdings</h3>
      <div className="space-y-3">
        {sorted.map((h) => {
          const valueBase = conv(h.quantity * h.currentPrice, h.currency);
          const gainPct = ((h.currentPrice - h.avgCostPerShare) / h.avgCostPerShare) * 100;
          const gainAbsBase = conv((h.currentPrice - h.avgCostPerShare) * h.quantity, h.currency);
          const portfolioPct = totalValue > 0 ? (valueBase / totalValue) * 100 : 0;

          return (
            <div key={h.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-300">{h.ticker.slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-slate-200 truncate">{h.name || h.ticker}</span>
                    {h.currency !== baseCurrency && (
                      <span className="text-xs text-slate-600 flex-shrink-0">{h.currency}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-100 tabular-nums ml-2">
                    {fmtBase(valueBase, baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs text-slate-600 mr-2 flex-shrink-0">{h.ticker}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-1 mr-3">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${Math.min(portfolioPct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500">{portfolioPct.toFixed(1)}%</span>
                    {showCostBasis && (
                      <span className={`text-xs font-medium ${gainColor(gainPct)}`}>
                        {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                        {' '}({gainAbsBase >= 0 ? '+' : ''}{fmtBase(gainAbsBase, baseCurrency)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
