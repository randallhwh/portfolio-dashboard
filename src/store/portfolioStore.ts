import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Holding, Transaction, TradeInput, PortfolioSettings, PortfolioSnapshot, BiasAlert, Currency, ExchangeRates } from '../types/portfolio';
import { fetchQuotes, FX_SYMBOLS } from '../services/yahooFinance';

// Converts amount in `currency` to the base currency.
// Rates map: how many base-currency units does 1 unit of `currency` equal.
export function toBase(amount: number, currency: Currency, rates: ExchangeRates, base: Currency): number {
  if (currency === base) return amount;
  const rateFrom = rates[currency] ?? 1; // local → USD
  const rateBase = rates[base] ?? 1;     // base  → USD
  return amount * (rateFrom / rateBase);
}

// Accounts that belong to the liquid portfolio (everything except SRS)
const LIQUID_ACCOUNTS = ['Stocks', 'Bonds', 'Cash'];

export function filterByPortfolio(holdings: Holding[], portfolio: string): Holding[] {
  if (portfolio === 'all') return holdings;
  if (portfolio === 'Liquid') return holdings.filter((h) => LIQUID_ACCOUNTS.includes(h.account));
  return holdings.filter((h) => h.account === portfolio);
}

export function fmtBase(amount: number, base: Currency): string {
  const symbol: Partial<Record<Currency, string>> = {
    USD: '$', SGD: 'S$', JPY: '¥', HKD: 'HK$', CNY: '¥', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
  };
  const s = symbol[base] ?? '';
  if (base === 'JPY') return `${s}${Math.round(amount).toLocaleString()}`;
  return `${s}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface PortfolioState {
  holdings: Holding[];
  transactions: Transaction[];
  snapshots: PortfolioSnapshot[];
  settings: PortfolioSettings;
  // All rates expressed as "how many USD does 1 unit of this currency equal"
  // e.g. SGD: 0.746 means 1 SGD = 0.746 USD
  exchangeRates: ExchangeRates;
  activeView: 'dashboard' | 'holdings' | 'bias' | 'analytics' | 'returns' | 'regime';
  activePortfolio: string; // 'all' or an account name
  priceHistory: Record<string, { prev1d?: number; prev7d?: number; prev30d?: number; prevYtd?: number }>;
  priceStatus: 'idle' | 'loading' | 'success' | 'error';
  lastUpdated: string | null; // ISO timestamp

  setActiveView: (view: PortfolioState['activeView']) => void;
  setActivePortfolio: (portfolio: string) => void;
  addHolding: (holding: Holding) => void;
  updateHolding: (id: string, updates: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;
  addTransaction: (tx: Transaction) => void;
  recordTrade: (trade: TradeInput) => { success: boolean; error?: string };
  updateSettings: (updates: Partial<PortfolioSettings>) => void;
  updateCurrentPrice: (id: string, price: number) => void;
  updateYield: (id: string, annualYieldPct: number | undefined) => void;
  updateExchangeRate: (currency: Currency, rate: number) => void;
  fetchLivePrices: () => Promise<void>;
  saveSnapshot: () => void;

  getBiasAlerts: () => BiasAlert[];
  getTotalValue: () => number;
  getTotalCost: () => number;
  getTotalGainLoss: () => number;
  getHoldingById: (id: string) => Holding | undefined;
  toBaseAmount: (amount: number, currency: Currency) => number;
}

// Open positions only. currentPrice = avgCostPerShare placeholder — update via Holdings page.
const INITIAL_HOLDINGS: Holding[] = [
  // --- Stocks portfolio ---
  {
    id: 'bp',
    ticker: 'BP',
    name: 'BP p.l.c.',
    assetClass: 'stock',
    quantity: 30,
    avgCostPerShare: 32.62,
    currentPrice: 32.62,
    currency: 'USD',
    purchaseDate: '2022-05-28',
    account: 'Stocks',
    annualYieldPct: 4.3,
    sector: 'Energy',
    country: 'UK',
  },
  {
    id: 'byddy',
    ticker: 'BYDDY',
    name: 'BYD Co., Ltd.',
    assetClass: 'stock',
    // 150 @ 9.167 (2023-11-30) + 90 @ 17.05 (2025-05-29) = 240 shares; avg = 12.12
    quantity: 240,
    avgCostPerShare: 12.12,
    currentPrice: 12.12,
    currency: 'USD',
    purchaseDate: '2023-11-30',
    account: 'Stocks',
    annualYieldPct: 1.3,
    sector: 'Consumer Discretionary',
    country: 'China',
    notes: '150 @ 9.167 (2023-11-30) + 90 @ 17.05 (2025-05-29)',
  },
  {
    id: 'nke',
    ticker: 'NKE',
    name: 'Nike, Inc.',
    assetClass: 'stock',
    quantity: 12,
    avgCostPerShare: 101.63,
    currentPrice: 101.63,
    currency: 'USD',
    purchaseDate: '2023-09-05',
    account: 'Stocks',
    annualYieldPct: 3.7,
    sector: 'Consumer Discretionary',
    country: 'US',
  },
  {
    id: 'se',
    ticker: 'SE',
    name: 'Sea Limited',
    assetClass: 'stock',
    quantity: 9,
    avgCostPerShare: 115.04,
    currentPrice: 115.04,
    currency: 'USD',
    purchaseDate: '2022-04-08',
    account: 'Stocks',
    sector: 'Technology',
    country: 'Singapore',
  },
  {
    id: 'j69u-stocks',
    ticker: 'J69U.SI',
    name: 'Frasers Centrepoint Trust',
    assetClass: 'real_estate',
    quantity: 100,
    avgCostPerShare: 2.08,
    currentPrice: 2.08,
    currency: 'SGD',
    purchaseDate: '2025-03-11',
    account: 'Stocks',
    annualYieldPct: 5.5,
    sector: 'Real Estate',
    country: 'Singapore',
  },
  {
    id: 'cha',
    ticker: 'CHA',
    name: 'Chagee Holdings Limited',
    assetClass: 'stock',
    // 80 @ 28 (2025-06-02) + 40 @ 29.45 (2025-06-17) + 110 @ 23.45 (2025-07-29) = 230 shares; avg = 26.08
    quantity: 230,
    avgCostPerShare: 26.08,
    currentPrice: 26.08,
    currency: 'USD',
    purchaseDate: '2025-06-02',
    account: 'Stocks',
    sector: 'Consumer Staples',
    country: 'China',
    notes: '80 @ 28 (2025-06-02) + 40 @ 29.45 (2025-06-17) + 110 @ 23.45 (2025-07-29)',
  },
  {
    id: '9984t',
    ticker: '9984.T',
    name: 'SoftBank Group Corp.',
    assetClass: 'stock',
    quantity: 100,
    avgCostPerShare: 3575,
    currentPrice: 3575,
    currency: 'JPY',
    purchaseDate: '2026-03-13',
    account: 'Stocks',
    annualYieldPct: 0.2,
    sector: 'Technology',
    country: 'Japan',
  },

  // --- Bonds (liquid) ---
  {
    id: 'sgs-bonds',
    ticker: 'SGS',
    name: 'SGS Bonds',
    assetClass: 'bond',
    quantity: 30000,
    avgCostPerShare: 1,
    currentPrice: 1,
    currency: 'SGD',
    purchaseDate: '2020-01-01',
    account: 'Bonds',
    annualYieldPct: 3,
    sector: 'Fixed Income',
    country: 'Singapore',
  },

  // --- SRS (Supplementary Retirement Scheme) portfolio ---
  {
    id: '0p00006hys',
    ticker: '0P00006HYS.SI',
    name: 'United SGD Fund',
    assetClass: 'bond',
    quantity: 12872,
    avgCostPerShare: 1.9422,
    currentPrice: 1.9422,
    currency: 'SGD',
    purchaseDate: '2022-04-04',
    account: 'Bonds',
    sector: 'Fixed Income',
    country: 'Singapore',
  },
  {
    id: '0p0001k7zy',
    ticker: '0P0001K7ZY.SI',
    name: 'PIMCO GIS Income Instl SGD H Acc',
    assetClass: 'bond',
    quantity: 445.633,
    avgCostPerShare: 11.22,
    currentPrice: 11.22,
    currency: 'SGD',
    purchaseDate: '2024-12-24',
    account: 'SRS',
    sector: 'Fixed Income',
    country: 'Global',
  },
  {
    id: 'j69u-funds',
    ticker: 'J69U.SI',
    name: 'Frasers Centrepoint Trust',
    assetClass: 'real_estate',
    quantity: 2300,
    avgCostPerShare: 2.08,
    currentPrice: 2.08,
    currency: 'SGD',
    purchaseDate: '2025-03-06',
    account: 'SRS',
    annualYieldPct: 5.5,
    sector: 'Real Estate',
    country: 'Singapore',
  },
  {
    id: 'd05-funds',
    ticker: 'D05.SI',
    name: 'DBS Group Holdings',
    assetClass: 'stock',
    quantity: 100,
    avgCostPerShare: 57.3,
    currentPrice: 57.3,
    currency: 'SGD',
    purchaseDate: '2026-04-17',
    account: 'SRS',
    annualYieldPct: 4.6,
    sector: 'Financials',
    country: 'Singapore',
  },

  // --- Cash positions (quantity = balance, price = 1, annualYieldPct = interest rate %) ---
  {
    id: 'cash-uob-one',
    ticker: 'UOB-ONE',
    name: 'UOB One',
    assetClass: 'cash',
    quantity: 150000,
    avgCostPerShare: 1,
    currentPrice: 1,
    currency: 'SGD',
    purchaseDate: '2024-01-01',
    account: 'Cash',
    annualYieldPct: 1.9,
  },
  {
    id: 'cash-uob-stash',
    ticker: 'UOB-STASH',
    name: 'UOB Stash',
    assetClass: 'cash',
    quantity: 68000,
    avgCostPerShare: 1,
    currentPrice: 1,
    currency: 'SGD',
    purchaseDate: '2024-01-01',
    account: 'Cash',
    annualYieldPct: 1.5,
  },
  {
    id: 'cash-ocbc-pd',
    ticker: 'OCBC-PD',
    name: 'OCBC Premier Dividend',
    assetClass: 'cash',
    quantity: 5000,
    avgCostPerShare: 1,
    currentPrice: 1,
    currency: 'SGD',
    purchaseDate: '2024-01-01',
    account: 'Cash',
    annualYieldPct: 1.3,
  },
  {
    id: 'cash-remaining',
    ticker: 'CASH-SGD',
    name: 'Remaining Cash (SGD)',
    assetClass: 'cash',
    quantity: 5000,
    avgCostPerShare: 1,
    currentPrice: 1,
    currency: 'SGD',
    purchaseDate: '2024-01-01',
    account: 'Cash',
  },
];

// Rates: how many USD = 1 unit of this currency (approximate, update as needed)
const DEFAULT_FX_RATES: ExchangeRates = {
  USD: 1,
  SGD: 0.746,   // 1 SGD ≈ 0.746 USD  (USD/SGD ≈ 1.34)
  JPY: 0.00676, // 1 JPY ≈ 0.00676 USD (USD/JPY ≈ 148)
  HKD: 0.128,
  CNY: 0.138,
  EUR: 1.08,
  GBP: 1.27,
  AUD: 0.64,
  CAD: 0.73,
};

const SAMPLE_SNAPSHOTS: PortfolioSnapshot[] = (() => {
  const snapshots: PortfolioSnapshot[] = [];
  const today = new Date();
  for (let i = 365; i >= 0; i -= 7) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const baseValue = 60000;
    const trend = (365 - i) / 365;
    const noise = (Math.sin(i * 0.3) * 2000) + (Math.cos(i * 0.7) * 1000);
    const value = baseValue + trend * 15000 + noise;
    snapshots.push({ date: date.toISOString().split('T')[0], totalValue: Math.round(value) });
  }
  return snapshots;
})();

function computeBiasAlerts(holdings: Holding[], settings: PortfolioSettings, rates: ExchangeRates): BiasAlert[] {
  const alerts: BiasAlert[] = [];
  const base = settings.baseCurrency;

  const totalValue = holdings.reduce(
    (sum, h) => sum + toBase(h.quantity * h.currentPrice, h.currency, rates, base), 0
  );

  holdings.forEach((h) => {
    const currentValueBase = toBase(h.quantity * h.currentPrice, h.currency, rates, base);
    const costBasisBase = toBase(h.quantity * h.avgCostPerShare, h.currency, rates, base);
    const gainPct = ((h.currentPrice - h.avgCostPerShare) / h.avgCostPerShare) * 100;
    const holdDays = Math.floor((Date.now() - new Date(h.purchaseDate).getTime()) / 86400000);
    const portfolioPct = totalValue > 0 ? (currentValueBase / totalValue) * 100 : 0;

    if (gainPct < -15 && holdDays > 180) {
      alerts.push({
        id: `disposition-${h.id}`,
        type: 'disposition',
        severity: gainPct < -30 ? 'high' : 'medium',
        title: `${h.ticker}: Holding a significant loser`,
        description: `Down ${Math.abs(gainPct).toFixed(1)}% over ${holdDays} days. Ask: if you had fresh cash today, would you buy ${h.ticker} at ${h.currentPrice} ${h.currency}?`,
        holdingId: h.id,
        actionPrompt: 'Evaluate on forward prospects only — ignore what you paid.',
      });
    }

    if (gainPct < -10 && costBasisBase > 3000) {
      alerts.push({
        id: `sunk-${h.id}`,
        type: 'sunk_cost',
        severity: 'medium',
        title: `${h.ticker}: Sunk cost risk`,
        description: `Position is down ${Math.abs(gainPct).toFixed(1)}%. Past losses are irrelevant to future decisions.`,
        holdingId: h.id,
        actionPrompt: 'Would you buy this position today with fresh capital? If not, consider why you still hold it.',
      });
    }

    if (portfolioPct > 20 && h.assetClass !== 'cash') {
      alerts.push({
        id: `concentration-${h.id}`,
        type: 'concentration',
        severity: portfolioPct > 30 ? 'high' : 'medium',
        title: `${h.ticker}: Over-concentration (${portfolioPct.toFixed(1)}% of portfolio)`,
        description: `A single position exceeding 20% creates asymmetric risk. A 50% drawdown here would reduce your total portfolio by ${(portfolioPct * 0.5).toFixed(1)}%.`,
        holdingId: h.id,
        actionPrompt: 'Consider whether the expected return justifies this concentration vs. diversifying.',
      });
    }
  });

  const accounts = [...new Set(holdings.map((h) => h.account))];
  if (accounts.length > 1) {
    const accountRisks: Record<string, number> = {};
    accounts.forEach((acc) => {
      const accHoldings = holdings.filter((h) => h.account === acc);
      const accTotal = accHoldings.reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, rates, base), 0);
      const accEquity = accHoldings
        .filter((h) => h.assetClass === 'stock' || h.assetClass === 'etf')
        .reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, rates, base), 0);
      accountRisks[acc] = accTotal > 0 ? (accEquity / accTotal) * 100 : 0;
    });
    const riskValues = Object.values(accountRisks).filter((v) => !isNaN(v));
    const maxRisk = Math.max(...riskValues);
    const minRisk = Math.min(...riskValues);
    if (maxRisk - minRisk > 40) {
      alerts.push({
        id: 'mental-accounting',
        type: 'mental_accounting',
        severity: 'low',
        title: 'Mental accounting: Large risk disparity across accounts',
        description: `Your accounts have very different risk profiles (${minRisk.toFixed(0)}%–${maxRisk.toFixed(0)}% equities). Your total portfolio allocation matters more than per-account allocation.`,
        actionPrompt: 'Evaluate your risk allocation at the total portfolio level, not per account.',
      });
    }
  }

  const cashBondBase = holdings
    .filter((h) => h.assetClass === 'cash' || h.assetClass === 'bond')
    .reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, rates, base), 0);
  const cashBondPct = totalValue > 0 ? (cashBondBase / totalValue) * 100 : 0;

  if (settings.riskTolerance === 'aggressive' && cashBondPct > 35) {
    alerts.push({
      id: 'loss-aversion',
      type: 'loss_aversion',
      severity: 'medium',
      title: `Loss aversion: High defensive allocation (${cashBondPct.toFixed(1)}%) for aggressive profile`,
      description: 'Your stated risk tolerance is aggressive, but your defensive allocation suggests loss aversion may be influencing your positioning.',
      actionPrompt: 'Review whether this reflects a deliberate strategy change or an emotional reaction to recent volatility.',
    });
  }

  return alerts;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: INITIAL_HOLDINGS,
      transactions: [],
      snapshots: SAMPLE_SNAPSHOTS,
      exchangeRates: DEFAULT_FX_RATES,
      settings: {
        baseCurrency: 'SGD',
        showCostBasis: true,
        neutralColorMode: false,
        benchmarkTicker: 'SPY',
        targetAllocations: {
          stock: 60,
          etf: 0,
          bond: 20,
          cash: 0,
          crypto: 0,
          real_estate: 20,
          commodity: 0,
          other: 0,
        },
        riskTolerance: 'moderate',
      },
      activeView: 'dashboard',
      activePortfolio: 'Liquid',
      priceHistory: {},
      priceStatus: 'idle' as const,
      lastUpdated: null,

      setActiveView: (view) => set({ activeView: view }),
      setActivePortfolio: (portfolio) => set({ activePortfolio: portfolio }),

      addHolding: (holding) =>
        set((state) => ({ holdings: [...state.holdings, holding] })),

      updateHolding: (id, updates) =>
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      deleteHolding: (id) =>
        set((state) => ({ holdings: state.holdings.filter((h) => h.id !== id) })),

      addTransaction: (tx) =>
        set((state) => ({ transactions: [...state.transactions, tx] })),

      recordTrade: (trade) => {
        const { holdings } = get();
        const existing = holdings.find(
          (h) => h.ticker === trade.ticker && h.account === trade.account
        );

        if (trade.type === 'buy') {
          const tx: Transaction = {
            id: crypto.randomUUID(),
            holdingId: existing?.id ?? '',
            ticker: trade.ticker,
            name: trade.name,
            type: 'buy',
            quantity: trade.quantity,
            pricePerShare: trade.pricePerShare,
            commission: trade.commission,
            currency: trade.currency,
            account: trade.account,
            date: trade.date,
            notes: trade.notes,
          };

          if (existing) {
            // Weighted-average cost basis update
            const oldTotalCost = existing.quantity * existing.avgCostPerShare;
            const newTradeCost = trade.quantity * trade.pricePerShare + trade.commission;
            const newQty = existing.quantity + trade.quantity;
            const newAvg = (oldTotalCost + newTradeCost) / newQty;
            tx.holdingId = existing.id;
            set((state) => ({
              holdings: state.holdings.map((h) =>
                h.id === existing.id
                  ? {
                      ...h,
                      quantity: newQty,
                      avgCostPerShare: newAvg,
                      currentPrice: trade.pricePerShare,
                      // Only overwrite yield if explicitly provided
                      ...(trade.annualYieldPct !== undefined ? { annualYieldPct: trade.annualYieldPct } : {}),
                    }
                  : h
              ),
              transactions: [...state.transactions, tx],
            }));
          } else {
            const holdingId = crypto.randomUUID();
            const avgCost = (trade.quantity * trade.pricePerShare + trade.commission) / trade.quantity;
            const newHolding: Holding = {
              id: holdingId,
              ticker: trade.ticker,
              name: trade.name,
              assetClass: trade.assetClass,
              quantity: trade.quantity,
              avgCostPerShare: avgCost,
              currentPrice: trade.pricePerShare,
              currency: trade.currency,
              purchaseDate: trade.date,
              account: trade.account,
              sector: trade.sector,
              country: trade.country,
              notes: trade.notes,
              annualYieldPct: trade.annualYieldPct,
            };
            tx.holdingId = holdingId;
            set((state) => ({
              holdings: [...state.holdings, newHolding],
              transactions: [...state.transactions, tx],
            }));
          }
          return { success: true };
        }

        if (trade.type === 'sell') {
          if (!existing) return { success: false, error: `No position found for ${trade.ticker} in ${trade.account}` };
          if (trade.quantity > existing.quantity)
            return { success: false, error: `Cannot sell ${trade.quantity} — only ${existing.quantity} held` };

          const newQty = existing.quantity - trade.quantity;
          const tx: Transaction = {
            id: crypto.randomUUID(),
            holdingId: existing.id,
            ticker: trade.ticker,
            name: existing.name,
            type: 'sell',
            quantity: trade.quantity,
            pricePerShare: trade.pricePerShare,
            commission: trade.commission,
            currency: trade.currency,
            account: trade.account,
            date: trade.date,
            notes: trade.notes,
          };

          set((state) => ({
            holdings: newQty === 0
              ? state.holdings.filter((h) => h.id !== existing.id)
              : state.holdings.map((h) =>
                  h.id === existing.id ? { ...h, quantity: newQty } : h
                ),
            transactions: [...state.transactions, tx],
          }));
          return { success: true };
        }

        return { success: false, error: 'Unknown trade type' };
      },

      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),

      updateCurrentPrice: (id, price) =>
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, currentPrice: price } : h)),
        })),

      updateYield: (id, annualYieldPct) =>
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, annualYieldPct } : h)),
        })),

      updateExchangeRate: (currency, rate) =>
        set((state) => ({
          exchangeRates: { ...state.exchangeRates, [currency]: rate },
        })),

      fetchLivePrices: async () => {
        const { holdings } = get();
        set({ priceStatus: 'loading' });

        try {
          // Collect all holding tickers + FX symbols for currencies in use
          const holdingTickers = [...new Set(holdings.map((h) => h.ticker))];
          const usedCurrencies = [...new Set(holdings.map((h) => h.currency))].filter(
            (c) => c !== 'USD'
          ) as Array<keyof typeof FX_SYMBOLS>;
          const fxTickers = usedCurrencies
            .map((c) => FX_SYMBOLS[c])
            .filter(Boolean);

          const allSymbols = [...holdingTickers, ...fxTickers];
          const results = await fetchQuotes(allSymbols);

          if (results.length === 0) {
            set({ priceStatus: 'error' });
            return;
          }

          // Build lookup maps
          const priceMap: Record<string, number> = {};
          const yieldMap: Record<string, number> = {};
          const historyMap: Record<string, { prev1d?: number; prev7d?: number; prev30d?: number }> = {};
          results.forEach((r) => {
            priceMap[r.symbol] = r.price;
            if (r.dividendYieldPct !== undefined) yieldMap[r.symbol] = r.dividendYieldPct;
            if (r.prev1d != null || r.prev7d != null || r.prev30d != null || r.prevYtd != null) {
              historyMap[r.symbol] = { prev1d: r.prev1d, prev7d: r.prev7d, prev30d: r.prev30d, prevYtd: r.prevYtd };
            }
          });

          set((state) => ({
            priceHistory: { ...state.priceHistory, ...historyMap },
            holdings: state.holdings.map((h) => {
              if (h.assetClass === 'cash') return h; // never overwrite cash price or yield
              const updates: Partial<Holding> = {};
              if (priceMap[h.ticker] != null) updates.currentPrice = priceMap[h.ticker];
              // Only overwrite yield when YF explicitly returns one; preserves manual yields (e.g. SGS bonds)
              if (yieldMap[h.ticker] != null) updates.annualYieldPct = yieldMap[h.ticker];
              return Object.keys(updates).length > 0 ? { ...h, ...updates } : h;
            }),
            // Update FX rates from live data
            exchangeRates: {
              ...state.exchangeRates,
              ...Object.fromEntries(
                usedCurrencies
                  .map((ccy) => {
                    const fxSym = FX_SYMBOLS[ccy];
                    const rate = fxSym ? priceMap[fxSym] : undefined;
                    return rate != null ? [ccy, rate] : null;
                  })
                  .filter(Boolean) as [string, number][]
              ),
            },
            priceStatus: 'success',
            lastUpdated: new Date().toISOString(),
          }));
        } catch {
          set({ priceStatus: 'error' });
        }
      },

      saveSnapshot: () => {
        const { holdings, snapshots, exchangeRates, settings } = get();
        const base = settings.baseCurrency;
        const totalValue = holdings.reduce(
          (sum, h) => sum + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0
        );
        const today = new Date().toISOString().split('T')[0];
        const updated = snapshots.filter((s) => s.date !== today);
        set({ snapshots: [...updated, { date: today, totalValue }] });
      },

      getBiasAlerts: () => {
        const { holdings, settings, exchangeRates, activePortfolio } = get();
        return computeBiasAlerts(filterByPortfolio(holdings, activePortfolio), settings, exchangeRates);
      },

      toBaseAmount: (amount, currency) => {
        const { exchangeRates, settings } = get();
        return toBase(amount, currency, exchangeRates, settings.baseCurrency);
      },

      getTotalValue: () => {
        const { holdings, exchangeRates, settings } = get();
        return holdings.reduce(
          (sum, h) => sum + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, settings.baseCurrency), 0
        );
      },

      getTotalCost: () => {
        const { holdings, exchangeRates, settings } = get();
        return holdings.reduce(
          (sum, h) => sum + toBase(h.quantity * h.avgCostPerShare, h.currency, exchangeRates, settings.baseCurrency), 0
        );
      },

      getTotalGainLoss: () => {
        const { holdings, exchangeRates, settings } = get();
        const base = settings.baseCurrency;
        const value = holdings.reduce((sum, h) => sum + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0);
        const cost = holdings.reduce((sum, h) => sum + toBase(h.quantity * h.avgCostPerShare, h.currency, exchangeRates, base), 0);
        return value - cost;
      },

      getHoldingById: (id) => get().holdings.find((h) => h.id === id),
    }),
    {
      name: 'portfolio-store',
      version: 13,
      migrate: () => ({
        holdings: INITIAL_HOLDINGS,
        transactions: [],
        snapshots: SAMPLE_SNAPSHOTS,
        exchangeRates: DEFAULT_FX_RATES,
        priceStatus: 'idle' as const,
        lastUpdated: null,
        settings: {
          baseCurrency: 'SGD' as const,
          showCostBasis: true,
          neutralColorMode: false,
          benchmarkTicker: 'SPY',
          targetAllocations: {
            stock: 60,
            etf: 0,
            bond: 20,
            cash: 0,
            crypto: 0,
            real_estate: 20,
            commodity: 0,
            other: 0,
          },
          riskTolerance: 'moderate' as const,
        },
        activeView: 'dashboard' as const,
        activePortfolio: 'Liquid',
        priceHistory: {},
      }),
    }
  )
);
