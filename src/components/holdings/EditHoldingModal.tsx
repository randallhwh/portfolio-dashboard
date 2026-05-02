import { useState } from 'react';
import { X } from 'lucide-react';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { AssetClass, Holding } from '../../types/portfolio';

interface Props {
  holding: Holding;
  onClose: () => void;
}

const ASSET_CLASSES: AssetClass[] = ['stock', 'etf', 'bond', 'cash', 'real_estate', 'crypto', 'commodity', 'other'];

export function EditHoldingModal({ holding, onClose }: Props) {
  const { updateHolding } = usePortfolioStore();
  const [name, setName] = useState(holding.name);
  const [assetClass, setAssetClass] = useState<AssetClass>(holding.assetClass);
  const [sector, setSector] = useState(holding.sector ?? '');
  const [country, setCountry] = useState(holding.country ?? '');
  const [notes, setNotes] = useState(holding.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateHolding(holding.id, { name, assetClass, sector: sector || undefined, country: country || undefined, notes: notes || undefined });
    onClose();
  };

  const inputCls = 'w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <p className="text-base font-semibold text-slate-100">Edit {holding.name || holding.ticker}</p>
            <p className="text-xs text-slate-500">Metadata only — use Add Trade to change position</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Asset Class</label>
            <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)} className={inputCls}>
              {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sector</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Technology" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-medium hover:text-slate-100 transition-all">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
