import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { Currency } from '../../types/portfolio';

const CURRENCY_LABELS: Partial<Record<Currency, string>> = {
  USD: 'US Dollar',
  SGD: 'Singapore Dollar',
  JPY: 'Japanese Yen',
  HKD: 'Hong Kong Dollar',
  CNY: 'Chinese Yuan',
  EUR: 'Euro',
  GBP: 'British Pound',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
};

export function FxRatesPanel() {
  const { holdings, exchangeRates, settings, updateExchangeRate } = usePortfolioStore();
  const [editingCcy, setEditingCcy] = useState<Currency | null>(null);
  const [inputVal, setInputVal] = useState('');

  // Only show currencies actually used in holdings
  const usedCurrencies = [...new Set(holdings.map((h) => h.currency))].filter(
    (c) => c !== settings.baseCurrency
  ) as Currency[];

  const handleSave = (ccy: Currency) => {
    const r = parseFloat(inputVal);
    if (!isNaN(r) && r > 0) updateExchangeRate(ccy, r);
    setEditingCcy(null);
  };

  if (usedCurrencies.length === 0) return null;

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">FX Rates</h3>
        <span className="text-xs text-slate-500">
          1 {settings.baseCurrency} = … · click a rate to edit
        </span>
      </div>
      <div className="space-y-2">
        {usedCurrencies.map((ccy) => {
          const rateFrom = exchangeRates[ccy] ?? 1;
          const rateBase = exchangeRates[settings.baseCurrency] ?? 1;
          // How many units of `ccy` does 1 unit of base buy?
          const displayRate = rateBase / rateFrom;

          return (
            <div key={ccy} className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-200">{ccy}</span>
                <span className="text-xs text-slate-500 ml-2">{CURRENCY_LABELS[ccy]}</span>
              </div>
              {editingCcy === ccy ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">1 {settings.baseCurrency} =</span>
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onBlur={() => handleSave(ccy)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(ccy);
                      if (e.key === 'Escape') setEditingCcy(null);
                    }}
                    className="w-24 bg-slate-700 border border-blue-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none text-right"
                  />
                  <span className="text-xs text-slate-500">{ccy}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingCcy(ccy);
                    setInputVal(displayRate.toFixed(ccy === 'JPY' ? 2 : 4));
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                  title="Click to update exchange rate"
                >
                  <RefreshCw size={11} />
                  <span className="tabular-nums">
                    1 {settings.baseCurrency} = {displayRate.toFixed(ccy === 'JPY' ? 2 : 4)} {ccy}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 mt-3">
        Rates are approximate and stored locally. Update them to get accurate base-currency totals.
      </p>
    </div>
  );
}
