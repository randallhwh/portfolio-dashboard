import { useState } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, ChevronUp, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../store/portfolioStore';
import { AddTradeModal } from '../components/holdings/AddTradeModal';
import { EditHoldingModal } from '../components/holdings/EditHoldingModal';
import type { Holding } from '../types/portfolio';

type SortKey = 'ticker' | 'valueBase' | 'gainPct' | 'portfolioPct' | 'holdDays';
type SortDir = 'asc' | 'desc';

const ASSET_CLASS_BADGE: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-300',
  etf: 'bg-violet-500/20 text-violet-300',
  bond: 'bg-cyan-500/20 text-cyan-300',
  cash: 'bg-slate-500/20 text-slate-400',
  crypto: 'bg-amber-500/20 text-amber-300',
  real_estate: 'bg-emerald-500/20 text-emerald-300',
  commodity: 'bg-orange-500/20 text-orange-300',
  other: 'bg-gray-500/20 text-gray-400',
};

export function Holdings() {
  const { holdings: allHoldings, settings, exchangeRates, deleteHolding, updateCurrentPrice, updateYield, activePortfolio } = usePortfolioStore();
  const holdings = filterByPortfolio(allHoldings, activePortfolio);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeDefaultTicker, setTradeDefaultTicker] = useState<string | undefined>();
  const [editHolding, setEditHolding] = useState<Holding | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>('valueBase');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [editYieldId, setEditYieldId] = useState<string | null>(null);
  const [yieldInput, setYieldInput] = useState('');

  const base = settings.baseCurrency;
  const conv = (amount: number, ccy: typeof base) => toBase(amount, ccy, exchangeRates, base);
  const today = new Date();

  const totalValueBase = holdings.reduce((sum, h) => sum + conv(h.quantity * h.currentPrice, h.currency), 0);

  const withDerived = holdings.map((h) => ({
    ...h,
    valueLocal: h.quantity * h.currentPrice,
    valueBase: conv(h.quantity * h.currentPrice, h.currency),
    gainPct: ((h.currentPrice - h.avgCostPerShare) / h.avgCostPerShare) * 100,
    gainAbsBase: conv((h.currentPrice - h.avgCostPerShare) * h.quantity, h.currency),
    portfolioPct: totalValueBase > 0 ? conv(h.quantity * h.currentPrice, h.currency) / totalValueBase * 100 : 0,
    holdDays: Math.floor((today.getTime() - new Date(h.purchaseDate).getTime()) / 86400000),
  }));

  const sorted = [...withDerived].sort((a, b) => {
    const mult = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'ticker') return mult * a.ticker.localeCompare(b.ticker);
    return mult * (a[sortKey] - b[sortKey]);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="text-slate-600" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-400" />
      : <ChevronDown size={12} className="text-blue-400" />;
  };

  const gainColor = (pct: number) => {
    if (settings.neutralColorMode) return pct >= 0 ? 'text-blue-400' : 'text-amber-400';
    return pct >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  const handlePriceSave = (id: string) => {
    const p = parseFloat(priceInput);
    if (!isNaN(p) && p > 0) updateCurrentPrice(id, p);
    setEditPriceId(null);
  };

  const handleYieldSave = (id: string) => {
    const y = parseFloat(yieldInput);
    updateYield(id, !isNaN(y) && y >= 0 ? y : undefined);
    setEditYieldId(null);
  };

  const openBuyFor = (ticker: string) => {
    setTradeDefaultTicker(ticker);
    setShowTradeModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {holdings.length} positions · {fmtBase(totalValueBase, base)} total
        </p>
        <button
          onClick={() => { setTradeDefaultTicker(undefined); setShowTradeModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all"
        >
          <Plus size={15} />
          Add Trade
        </button>
      </div>

      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {[
                  { key: 'ticker' as SortKey, label: 'Asset' },
                  { key: 'valueBase' as SortKey, label: `Value (${base})` },
                  { key: 'gainPct' as SortKey, label: 'Return' },
                  { key: 'portfolioPct' as SortKey, label: '% Portfolio' },
                  { key: 'holdDays' as SortKey, label: 'Hold' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="flex items-center gap-1">{label} <SortIcon k={key} /></span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Yield</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sorted.map((h) => (
                <tr key={h.id} className="hover:bg-slate-700/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-300">{h.ticker.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 truncate max-w-[160px]">{h.name || h.ticker}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">{h.ticker}</span>
                          <span className={`text-xs px-1.5 py-0 rounded font-medium ${ASSET_CLASS_BADGE[h.assetClass] || 'bg-gray-500/20 text-gray-400'}`}>
                            {h.assetClass}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-100 tabular-nums">
                      {fmtBase(h.valueBase, base)}
                    </p>
                    {h.currency !== base && (
                      <p className="text-xs text-slate-500 tabular-nums">
                        {h.currency} {h.valueLocal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    )}
                    {settings.showCostBasis && (
                      <p className="text-xs text-slate-600 tabular-nums">
                        Cost {fmtBase(conv(h.quantity * h.avgCostPerShare, h.currency), base)}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {settings.showCostBasis ? (
                      <div>
                        <div className="flex items-center gap-1">
                          {h.gainPct >= 0
                            ? <TrendingUp size={13} className={gainColor(h.gainPct)} />
                            : <TrendingDown size={13} className={gainColor(h.gainPct)} />}
                          <span className={`font-semibold tabular-nums ${gainColor(h.gainPct)}`}>
                            {h.gainPct >= 0 ? '+' : ''}{h.gainPct.toFixed(1)}%
                          </span>
                        </div>
                        <p className={`text-xs tabular-nums ${gainColor(h.gainPct)}`}>
                          {h.gainAbsBase >= 0 ? '+' : ''}{fmtBase(h.gainAbsBase, base)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs italic">hidden</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(h.portfolioPct, 100)}%` }} />
                      </div>
                      <span className="text-slate-400 tabular-nums text-xs">{h.portfolioPct.toFixed(1)}%</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-500">
                      {h.holdDays >= 365 ? `${(h.holdDays / 365).toFixed(1)}y` : `${h.holdDays}d`}
                    </p>
                    <p className="text-xs text-slate-600">{h.quantity.toLocaleString()} shares</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600">{h.currency}</span>
                    {editPriceId === h.id ? (
                      <input
                        autoFocus
                        type="number"
                        step="any"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onBlur={() => handlePriceSave(h.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePriceSave(h.id);
                          if (e.key === 'Escape') setEditPriceId(null);
                        }}
                        className="block w-20 mt-0.5 bg-slate-700 border border-blue-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditPriceId(h.id); setPriceInput(h.currentPrice.toString()); }}
                        className="block text-slate-300 hover:text-blue-400 tabular-nums text-xs transition-colors mt-0.5 font-medium"
                        title="Click to override price"
                      >
                        {h.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </button>
                    )}
                    {settings.showCostBasis && (
                      <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        avg {h.avgCostPerShare.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500">{h.account}</td>

                  <td className="px-4 py-3">
                    {h.assetClass === 'cash' ? (
                      /* Cash: editable interest rate */
                      editYieldId === h.id ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={yieldInput}
                          onChange={(e) => setYieldInput(e.target.value)}
                          onBlur={() => handleYieldSave(h.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleYieldSave(h.id);
                            if (e.key === 'Escape') setEditYieldId(null);
                          }}
                          className="block w-16 bg-slate-700 border border-blue-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditYieldId(h.id); setYieldInput(h.annualYieldPct?.toString() ?? ''); }}
                          className="text-left transition-colors"
                          title="Click to set interest rate"
                        >
                          {h.annualYieldPct != null ? (
                            <>
                              <p className="text-xs text-emerald-400 tabular-nums font-medium hover:text-emerald-300">
                                {h.annualYieldPct.toFixed(2)}% p.a.
                              </p>
                              <p className="text-xs text-slate-600 tabular-nums">
                                +{fmtBase(conv(h.quantity * h.currentPrice * h.annualYieldPct / 100, h.currency), base)}/yr
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-slate-700 hover:text-slate-500 italic">set rate</span>
                          )}
                        </button>
                      )
                    ) : (
                      /* Stocks/bonds/ETFs: read-only, auto-fetched from Yahoo Finance */
                      h.annualYieldPct != null ? (
                        <>
                          <p className="text-xs text-emerald-400 tabular-nums font-medium">
                            {h.annualYieldPct.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 tabular-nums">
                            +{fmtBase(conv(h.quantity * h.currentPrice * h.annualYieldPct / 100, h.currency), base)}/yr
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-700">—</span>
                      )
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openBuyFor(h.ticker)}
                        className="p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-all"
                        title="Add trade for this position"
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                      <button
                        onClick={() => setEditHolding(h)}
                        className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all"
                        title="Edit metadata"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${h.name || h.ticker} from your portfolio?`)) deleteHolding(h.id);
                        }}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showTradeModal && (
        <AddTradeModal
          onClose={() => { setShowTradeModal(false); setTradeDefaultTicker(undefined); }}
          defaultTicker={tradeDefaultTicker}
        />
      )}
      {editHolding && (
        <EditHoldingModal holding={editHolding} onClose={() => setEditHolding(undefined)} />
      )}
    </div>
  );
}
