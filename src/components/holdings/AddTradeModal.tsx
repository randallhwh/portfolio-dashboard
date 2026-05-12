import { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { usePortfolioStore, fmtBase, toBase } from '../../store/portfolioStore';
import type { AssetClass, Currency } from '../../types/portfolio';

interface Props {
  onClose: () => void;
  defaultTicker?: string;
  defaultSide?: 'buy' | 'sell';
  defaultAssetClass?: AssetClass;
  defaultAccount?: string;
}

const ASSET_CLASSES: AssetClass[] = ['stock', 'etf', 'bond', 'cash', 'real_estate', 'crypto', 'commodity', 'other'];
const CURRENCIES: Currency[] = ['USD', 'SGD', 'JPY', 'HKD', 'CNY', 'CAD', 'EUR', 'GBP', 'AUD'];

const today = new Date().toISOString().split('T')[0];

export function AddTradeModal({ onClose, defaultTicker, defaultSide = 'buy', defaultAssetClass = 'stock', defaultAccount }: Props) {
  const { holdings, settings, exchangeRates, recordTrade } = usePortfolioStore();
  const base = settings.baseCurrency;
  const initialHolding = defaultTicker
    ? holdings.find((h) => h.ticker.toLowerCase() === defaultTicker.trim().toLowerCase())
    : undefined;

  const [side, setSide] = useState<'buy' | 'sell'>(defaultSide);
  const [ticker, setTicker] = useState(defaultTicker ?? '');
  const [name, setName] = useState(initialHolding?.name ?? '');
  const [assetClass, setAssetClass] = useState<AssetClass>(initialHolding?.assetClass ?? defaultAssetClass);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(initialHolding && defaultSide === 'sell' ? initialHolding.currentPrice.toString() : '');
  const [commission, setCommission] = useState('0');
  const [date, setDate] = useState(today);
  const [currency, setCurrency] = useState<Currency>(initialHolding?.currency ?? (base === 'SGD' ? 'SGD' : 'USD'));
  const [account, setAccount] = useState(initialHolding?.account ?? defaultAccount ?? '');
  const [sector, setSector] = useState(initialHolding?.sector ?? '');
  const [country, setCountry] = useState(initialHolding?.country ?? '');
  const [notes, setNotes] = useState('');
  const [annualYieldPct, setAnnualYieldPct] = useState('');
  const [cashHoldingId, setCashHoldingId] = useState('');
  const [error, setError] = useState('');

  const existingAccounts = useMemo(() => [...new Set(holdings.map((h) => h.account))], [holdings]);

  // Positions that match the current ticker (may span multiple accounts)
  const matchingPositions = holdings.filter(
    (h) => h.ticker.toLowerCase() === ticker.trim().toLowerCase()
  );

  // For sell side: pick which account to sell from
  const sellPosition = matchingPositions.find((h) => h.account === account) ?? matchingPositions[0];

  // Auto-populate fields when ticker matches an existing holding
  const knownHolding = matchingPositions.find((h) => h.account === account) ?? matchingPositions[0];
  const isNewPosition = side === 'buy' && matchingPositions.length === 0;

  // When switching to sell, auto-fill currency/account from the position
  const handleSideSwitch = (s: 'buy' | 'sell') => {
    setSide(s);
    setError('');
    if (s === 'sell' && matchingPositions.length > 0) {
      const pos = matchingPositions[0];
      setCurrency(pos.currency);
      setAccount(pos.account);
      setPrice(pos.currentPrice.toString());
    }
  };

  const handleTickerChange = (t: string) => {
    setTicker(t);
    setError('');
    const matched = holdings.find((h) => h.ticker.toLowerCase() === t.trim().toLowerCase());
    if (matched) {
      setName(matched.name);
      setAssetClass(matched.assetClass);
      setCurrency(matched.currency);
      setAccount(matched.account);
      setSector(matched.sector ?? '');
      setCountry(matched.country ?? '');
      if (side === 'sell') setPrice(matched.currentPrice.toString());
    }
  };

  const cashHoldings = holdings.filter((h) => h.assetClass === 'cash' && h.currency === currency);

  const isCash = assetClass === 'cash';

  // Preview computation
  const qtyNum = parseFloat(qty) || 0;
  const priceNum = isCash ? 1 : (parseFloat(price) || 0);
  const commNum = parseFloat(commission) || 0;
  const tradeValue = qtyNum * priceNum;
  const tradeValueBase = toBase(tradeValue, currency, exchangeRates, base);

  const preview = useMemo(() => {
    if (!qtyNum || !priceNum) return null;
    if (side === 'buy') {
      if (knownHolding) {
        const oldCost = knownHolding.quantity * knownHolding.avgCostPerShare;
        const newCost = qtyNum * priceNum + commNum;
        const newQty = knownHolding.quantity + qtyNum;
        const newAvg = (oldCost + newCost) / newQty;
        return {
          newQty,
          newAvg,
          prevQty: knownHolding.quantity,
          prevAvg: knownHolding.avgCostPerShare,
        };
      }
      return {
        newQty: qtyNum,
        newAvg: (qtyNum * priceNum + commNum) / qtyNum,
        prevQty: 0,
        prevAvg: 0,
      };
    }
    if (side === 'sell' && sellPosition) {
      const newQty = sellPosition.quantity - qtyNum;
      const realizedPnL = (priceNum - sellPosition.avgCostPerShare) * qtyNum - commNum;
      return {
        newQty: Math.max(newQty, 0),
        prevQty: sellPosition.quantity,
        prevAvg: sellPosition.avgCostPerShare,
        realizedPnL,
        closed: newQty <= 0,
      };
    }
    return null;
  }, [side, qtyNum, priceNum, commNum, knownHolding, sellPosition]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const yieldNum = parseFloat(annualYieldPct);
    const result = recordTrade({
      type: side,
      ticker: ticker.trim().toUpperCase(),
      name: name.trim(),
      assetClass,
      quantity: qtyNum,
      pricePerShare: isCash ? 1 : priceNum,
      commission: isCash ? 0 : commNum,
      currency,
      account: account.trim(),
      date,
      sector: sector || undefined,
      country: country || undefined,
      notes: notes || undefined,
      annualYieldPct: !isNaN(yieldNum) && yieldNum >= 0 ? yieldNum : undefined,
      cashHoldingId: !isCash && cashHoldingId ? cashHoldingId : undefined,
    });
    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? 'Trade failed');
    }
  };

  const inputCls = 'w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';
  const isBuy = side === 'buy';
  const gainColor = (n: number) => {
    if (settings.neutralColorMode) return n >= 0 ? 'text-blue-400' : 'text-amber-400';
    return n >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header with BUY / SELL toggle */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleSideSwitch('buy')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isBuy ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp size={14} />
              Buy
            </button>
            <button
              type="button"
              onClick={() => handleSideSwitch('sell')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !isBuy ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown size={14} />
              Sell
            </button>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Ticker */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ticker / Symbol *</label>
              {side === 'sell' && matchingPositions.length === 0 && ticker.length > 1 ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-300">No open position for {ticker.toUpperCase()}</span>
                </div>
              ) : null}
              <input
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                required
                placeholder="AAPL"
                className={inputCls}
                list="ticker-list"
              />
              {side === 'sell' && (
                <datalist id="ticker-list">
                  {holdings.map((h) => (
                    <option key={h.id} value={h.ticker} />
                  ))}
                </datalist>
              )}
            </div>
            <div>
              <label className={labelCls}>Asset Class *</label>
              <select
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                disabled={!isNewPosition}
                className={`${inputCls} ${!isNewPosition ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Name — only editable for new positions */}
          <div>
            <label className={labelCls}>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Apple Inc."
              disabled={!isNewPosition && !!knownHolding}
              className={`${inputCls} ${!isNewPosition && knownHolding ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Existing position context banner */}
          {knownHolding && (
            <div className="bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 py-3">
              <p className="text-xs text-slate-500 font-medium mb-2">Current position · {knownHolding.account}</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-slate-500">Shares held</p>
                  <p className="text-sm font-semibold text-slate-200">{knownHolding.quantity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avg cost</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {knownHolding.currency} {knownHolding.avgCostPerShare.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last price</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {knownHolding.currency} {knownHolding.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quantity / Balance, Price, Commission */}
          {isCash ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isBuy ? 'Deposit Amount *' : 'Withdraw Amount *'}</label>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="10000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Interest Rate (% p.a.)</label>
                <input
                  value={annualYieldPct}
                  onChange={(e) => setAnnualYieldPct(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="3.50"
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Shares *</label>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder="100"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Price / Share *</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Commission</label>
                <input
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Date, Currency, Account */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Trade Date *</label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                type="date"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                disabled={!!knownHolding}
                className={`${inputCls} ${knownHolding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Account *</label>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                placeholder="Stocks / Funds"
                list="account-list"
                className={inputCls}
              />
              <datalist id="account-list">
                {existingAccounts.map((a) => <option key={a} value={a} />)}
              </datalist>
            </div>
          </div>

          {/* New position extra fields */}
          {isNewPosition && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Sector</label>
                <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Technology" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" className={inputCls} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>

          {/* Cash balance update */}
          {!isCash && cashHoldings.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-slate-400">
                Update cash balance <span className="text-slate-600 font-normal">(optional)</span>
              </p>
              <select
                value={cashHoldingId}
                onChange={(e) => setCashHoldingId(e.target.value)}
                className={inputCls}
              >
                <option value="">— no cash update —</option>
                {cashHoldings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} · {currency} {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
              {cashHoldingId && qtyNum > 0 && priceNum > 0 && (() => {
                const ch = cashHoldings.find((h) => h.id === cashHoldingId)!;
                const delta = side === 'buy'
                  ? -(qtyNum * priceNum + commNum)
                  : qtyNum * priceNum - commNum;
                const after = ch.quantity + delta;
                return (
                  <p className="text-xs text-slate-400">
                    {ch.name}: {currency} {ch.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {' → '}
                    <span className={after < 0 ? 'text-red-400 font-semibold' : 'text-slate-200 font-semibold'}>
                      {currency} {after.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    {after < 0 && <span className="text-red-400 ml-1">(insufficient funds)</span>}
                  </p>
                );
              })()}
            </div>
          )}

          {/* Trade preview */}
          {preview && qtyNum > 0 && priceNum > 0 && (
            <div className={`rounded-xl border px-4 py-3 ${isBuy ? 'border-blue-500/30 bg-blue-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trade Preview</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Trade value</p>
                  <p className="font-semibold text-slate-200">
                    {currency} {tradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {currency !== base && (
                      <span className="text-xs text-slate-500 ml-1">≈ {fmtBase(tradeValueBase, base)}</span>
                    )}
                  </p>
                </div>
                {isBuy && (
                  <div>
                    <p className="text-xs text-slate-500">New avg cost</p>
                    <p className="font-semibold text-slate-200">
                      {currency} {(preview.newAvg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      {preview.prevQty > 0 && (
                        <span className="text-xs text-slate-500 ml-1">
                          (was {preview.prevAvg.toLocaleString(undefined, { maximumFractionDigits: 4 })})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">{isCash ? 'Balance after' : 'Shares after'}</p>
                  <p className="font-semibold text-slate-200">
                    {isCash
                      ? preview.newQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : preview.newQty.toLocaleString()}
                    {preview.closed && <span className="text-xs text-red-400 ml-1">(position closed)</span>}
                  </p>
                </div>
                {'realizedPnL' in preview && preview.realizedPnL !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500">Realized P&L</p>
                    <p className={`font-semibold ${gainColor(preview.realizedPnL)}`}>
                      {currency} {preview.realizedPnL >= 0 ? '+' : ''}{preview.realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-medium hover:text-slate-100 hover:border-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all ${
                isBuy ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {isCash ? (isBuy ? 'Record Deposit' : 'Record Withdrawal') : (isBuy ? 'Record Buy' : 'Record Sell')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
