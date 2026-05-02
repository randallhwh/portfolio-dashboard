import { useState } from 'react';
import { X } from 'lucide-react';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { AssetClass, Currency, Holding } from '../../types/portfolio';

interface Props {
  onClose: () => void;
  editHolding?: Holding;
}

const ASSET_CLASSES: AssetClass[] = ['stock', 'etf', 'bond', 'cash', 'crypto', 'real_estate', 'commodity', 'other'];
const CURRENCIES: Currency[] = ['USD', 'SGD', 'JPY', 'HKD', 'CNY', 'CAD', 'EUR', 'GBP', 'AUD'];

export function AddHoldingModal({ onClose, editHolding }: Props) {
  const { addHolding, updateHolding } = usePortfolioStore();

  const [form, setForm] = useState({
    ticker: editHolding?.ticker ?? '',
    name: editHolding?.name ?? '',
    assetClass: editHolding?.assetClass ?? 'stock' as AssetClass,
    quantity: editHolding?.quantity.toString() ?? '',
    avgCostPerShare: editHolding?.avgCostPerShare.toString() ?? '',
    currentPrice: editHolding?.currentPrice.toString() ?? '',
    currency: editHolding?.currency ?? 'USD' as Currency,
    purchaseDate: editHolding?.purchaseDate ?? new Date().toISOString().split('T')[0],
    account: editHolding?.account ?? '',
    sector: editHolding?.sector ?? '',
    country: editHolding?.country ?? '',
    notes: editHolding?.notes ?? '',
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const holding: Holding = {
      id: editHolding?.id ?? crypto.randomUUID(),
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      assetClass: form.assetClass,
      quantity: parseFloat(form.quantity),
      avgCostPerShare: parseFloat(form.avgCostPerShare),
      currentPrice: parseFloat(form.currentPrice),
      currency: form.currency,
      purchaseDate: form.purchaseDate,
      account: form.account,
      sector: form.sector || undefined,
      country: form.country || undefined,
      notes: form.notes || undefined,
    };
    if (editHolding) {
      updateHolding(editHolding.id, holding);
    } else {
      addHolding(holding);
    }
    onClose();
  };

  const inputCls = 'w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            {editHolding ? 'Edit Holding' : 'Add Holding'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ticker / Symbol *</label>
              <input {...field('ticker')} required placeholder="AAPL" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Asset Class *</label>
              <select {...field('assetClass')} required className={inputCls}>
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Name *</label>
            <input {...field('name')} required placeholder="Apple Inc." className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Quantity *</label>
              <input {...field('quantity')} required type="number" step="any" placeholder="100" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Avg Cost / Share *</label>
              <input {...field('avgCostPerShare')} required type="number" step="any" placeholder="150.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Current Price *</label>
              <input {...field('currentPrice')} required type="number" step="any" placeholder="189.00" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Currency</label>
              <select {...field('currency')} className={inputCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Purchase Date *</label>
              <input {...field('purchaseDate')} required type="date" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Account *</label>
              <input {...field('account')} required placeholder="Brokerage / TFSA / RRSP" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sector</label>
              <input {...field('sector')} placeholder="Technology" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Country</label>
            <input {...field('country')} placeholder="US" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-medium hover:text-slate-100 hover:border-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all"
            >
              {editHolding ? 'Save Changes' : 'Add Holding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
