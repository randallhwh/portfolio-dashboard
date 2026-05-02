import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePortfolioStore, toBase, fmtBase, filterByPortfolio } from '../store/portfolioStore';
import { FX_SYMBOLS } from '../services/yahooFinance';
import type { Currency } from '../types/portfolio';

type Period = '1D' | '1W' | '1M' | 'YTD' | 'Total';
const PERIODS: Period[] = ['1D', '1W', '1M', 'YTD', 'Total'];

const YEAR_START_MS  = new Date(new Date().getFullYear(), 0, 1).getTime();
const NOW_MS         = Date.now();
const DAY_MS         = 86400 * 1000;

// For each period, what is the "start" timestamp?
const PERIOD_START_MS: Record<string, number> = {
  '1D':  NOW_MS - DAY_MS,
  '1W':  NOW_MS - 7  * DAY_MS,
  '1M':  NOW_MS - 30 * DAY_MS,
  'YTD': YEAR_START_MS,
};

interface PeriodReturn { pct: number | null; abs: number | null }

export function Returns() {
  const {
    holdings: allHoldings,
    settings,
    exchangeRates,
    priceHistory,
    activePortfolio,
    priceStatus,
    fetchLivePrices,
    lastUpdated,
  } = usePortfolioStore();

  const base = settings.baseCurrency;
  const fmt  = (n: number) => fmtBase(n, base);
  const holdings     = filterByPortfolio(allHoldings, activePortfolio);
  const equityHoldings = holdings.filter((h) => h.assetClass !== 'cash');
  const cashHoldings   = holdings.filter((h) => h.assetClass === 'cash');

  const hasHistory = Object.keys(priceHistory).length > 0;

  // Resolve the baseline price for a holding over a period.
  // If the holding didn't exist at the period's start, fall back to avgCostPerShare
  // so the result represents the actual holding-period return.
  function baselinePrice(h: typeof equityHoldings[0], period: Period): number | undefined {
    if (period === 'Total') return h.avgCostPerShare;

    const purchasedMs = new Date(h.purchaseDate).getTime();
    const periodStartMs = PERIOD_START_MS[period];
    const hist = priceHistory[h.ticker];

    // Holding didn't exist at period start → holding-period return
    if (purchasedMs >= periodStartMs) return h.avgCostPerShare;

    // Holding existed — use historical price if available
    if (!hist) return undefined; // no live data yet
    if (period === '1D')  return hist.prev1d;
    if (period === '1W')  return hist.prev7d;
    if (period === '1M')  return hist.prev30d;
    if (period === 'YTD') return hist.prevYtd;
  }

  function holdingReturn(h: typeof equityHoldings[0], period: Period): PeriodReturn {
    const prev = baselinePrice(h, period);
    if (prev == null || prev === 0) return { pct: null, abs: null };
    return {
      pct: ((h.currentPrice - prev) / prev) * 100,
      abs: h.currentPrice - prev,
    };
  }

  function portfolioReturn(period: Period): PeriodReturn {
    let currVal = 0, prevVal = 0, count = 0;
    for (const h of equityHoldings) {
      const prev = baselinePrice(h, period);
      if (prev == null || prev === 0) continue;
      currVal += toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base);
      prevVal += toBase(h.quantity * prev,           h.currency, exchangeRates, base);
      count++;
    }
    if (count === 0 || prevVal === 0) return { pct: null, abs: null };
    return { pct: (currVal - prevVal) / prevVal * 100, abs: currVal - prevVal };
  }

  const gainColor = (v: number | null) => {
    if (v === null) return 'text-slate-600';
    if (settings.neutralColorMode) return v >= 0 ? 'text-blue-400' : 'text-amber-400';
    return v >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  const fmtPct = (v: number | null) =>
    v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  const fmtAbsLocal = (abs: number | null, qty: number, ccy: string) => {
    if (abs === null) return '';
    const total = abs * qty;
    return `${total >= 0 ? '+' : ''}${ccy} ${Math.round(total).toLocaleString()}`;
  };

  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // FX periods (Total doesn't apply to FX — there's no single entry point)
  const FX_PERIODS = ['1D', '1W', '1M', 'YTD'] as const;
  type FxPeriod = typeof FX_PERIODS[number];

  const SGD_SYM = FX_SYMBOLS['SGD']; // 'SGDUSD=X'

  // Return of `ccy` vs the base currency (SGD) over `period`.
  // Formula: (ccy_curr_in_usd / sgd_curr_in_usd) / (ccy_prev_in_usd / sgd_prev_in_usd) - 1
  function fxReturn(ccy: Currency, period: FxPeriod): number | null {
    if (ccy === base) return null;

    const sgdHist = priceHistory[SGD_SYM];
    const prevSGDinUSD: number | undefined =
      period === '1D' ? sgdHist?.prev1d :
      period === '1W' ? sgdHist?.prev7d :
      period === '1M' ? sgdHist?.prev30d :
                        sgdHist?.prevYtd;
    if (!prevSGDinUSD || prevSGDinUSD === 0) return null;

    // current cross rate: how many base (SGD) units is 1 ccy worth
    const currCcyInUSD = ccy === 'USD' ? 1 : (exchangeRates[ccy] ?? null);
    const currSGDinUSD = exchangeRates['SGD'] ?? null;
    if (!currCcyInUSD || !currSGDinUSD || currSGDinUSD === 0) return null;
    const currRate = currCcyInUSD / currSGDinUSD;

    // previous cross rate
    let prevCcyInUSD: number | undefined;
    if (ccy === 'USD') {
      prevCcyInUSD = 1; // USD is always the USD reference
    } else {
      const sym = FX_SYMBOLS[ccy];
      if (!sym) return null;
      const hist = priceHistory[sym];
      prevCcyInUSD =
        period === '1D' ? hist?.prev1d :
        period === '1W' ? hist?.prev7d :
        period === '1M' ? hist?.prev30d :
                          hist?.prevYtd;
    }
    if (!prevCcyInUSD || prevCcyInUSD === 0) return null;
    const prevRate = prevCcyInUSD / prevSGDinUSD;
    if (prevRate === 0) return null;

    return (currRate / prevRate - 1) * 100;
  }

  // Current rate: 1 ccy = X base (SGD)
  function currentRate(ccy: Currency): number | null {
    if (ccy === base) return 1;
    const ccyUSD = ccy === 'USD' ? 1 : (exchangeRates[ccy] ?? null);
    const sgdUSD = exchangeRates['SGD'] ?? null;
    if (!ccyUSD || !sgdUSD || sgdUSD === 0) return null;
    return ccyUSD / sgdUSD;
  }

  // Currencies used in the filtered portfolio (excluding base)
  const fxCurrencies = [...new Set(
    holdings.filter((h) => h.currency !== base).map((h) => h.currency as Currency)
  )].sort();

  const totalCashIncome = cashHoldings.reduce((s, h) => {
    if (!h.annualYieldPct) return s;
    return s + toBase(h.quantity * h.annualYieldPct / 100, h.currency, exchangeRates, base);
  }, 0);

  const periodLabel: Record<Period, string> = {
    '1D': 'Daily',
    '1W': 'Weekly',
    '1M': 'Monthly',
    'YTD': `YTD ${new Date().getFullYear()}`,
    'Total': 'Total Return',
  };

  return (
    <div className="space-y-6">

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3">
        {lastUpdatedStr && <span className="text-xs text-slate-600">Updated {lastUpdatedStr}</span>}
        <button
          onClick={fetchLivePrices}
          disabled={priceStatus === 'loading'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={priceStatus === 'loading' ? 'animate-spin' : ''} />
          {priceStatus === 'loading' ? 'Fetching…' : 'Refresh Prices'}
        </button>
      </div>

      {/* Portfolio summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {PERIODS.map((period) => {
          const ret = portfolioReturn(period);
          const needsRefresh = !hasHistory && period !== 'Total';
          return (
            <div key={period} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {periodLabel[period]}
              </p>
              <p className={`text-xl font-semibold tabular-nums ${gainColor(ret.pct)}`}>
                {fmtPct(ret.pct)}
              </p>
              <p className={`text-sm mt-0.5 tabular-nums font-medium ${gainColor(ret.abs)}`}>
                {ret.abs !== null
                  ? `${ret.abs >= 0 ? '+' : ''}${fmt(ret.abs)}`
                  : needsRefresh ? <span className="text-slate-600 text-xs italic">refresh for data</span>
                  : '—'}
              </p>
            </div>
          );
        })}
      </div>

      {!hasHistory && (
        <p className="text-center text-sm text-slate-500 py-2">
          Refresh prices to load 1D / 1W / 1M / YTD returns — Total Return is always available.
        </p>
      )}

      {/* Holdings table */}
      {equityHoldings.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Holdings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Asset</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Since</th>
                  {PERIODS.map((p) => (
                    <th key={p} className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">
                      {p}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {equityHoldings.map((h) => {
                  const valueBase = toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base);
                  return (
                    <tr key={h.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200 truncate max-w-[160px]">{h.name || h.ticker}</p>
                        <p className="text-xs text-slate-500">{h.ticker}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 tabular-nums">{h.purchaseDate}</p>
                      </td>
                      {PERIODS.map((period) => {
                        const ret = holdingReturn(h, period);
                        return (
                          <td key={period} className="px-3 py-3 text-right">
                            <p className={`tabular-nums font-medium text-sm ${gainColor(ret.pct)}`}>
                              {fmtPct(ret.pct)}
                            </p>
                            {ret.abs !== null && (
                              <p className={`text-xs tabular-nums ${gainColor(ret.abs)}`}>
                                {fmtAbsLocal(ret.abs, h.quantity, h.currency)}
                              </p>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-slate-200 tabular-nums text-sm">{fmt(valueBase)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FX Impact on Holdings */}
      {fxCurrencies.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              FX Impact on Holdings
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {base} gain / loss on each position from currency movement alone
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Holding</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Value ({base})</th>
                  {FX_PERIODS.map((p) => (
                    <th key={p} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                      {p} FX
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fxCurrencies.map((ccy) => {
                  const ccyHoldings = equityHoldings.filter((h) => h.currency === ccy);
                  if (ccyHoldings.length === 0) return null;
                  const rate = currentRate(ccy);

                  // Currency separator row
                  return (
                    <Fragment key={ccy}>
                      <tr className="bg-slate-900/60 border-y border-slate-700/40">
                        <td className="px-4 py-2" colSpan={2}>
                          <span className="text-xs font-semibold text-slate-400">{ccy}/{base}</span>
                          {rate != null && (
                            <span className="text-xs text-slate-600 ml-2">
                              1 {ccy} = {rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {base}
                            </span>
                          )}
                        </td>
                        {FX_PERIODS.map((period) => {
                          const pct = fxReturn(ccy, period);
                          return (
                            <td key={period} className="px-4 py-2 text-right">
                              <span className={`text-xs font-semibold tabular-nums ${gainColor(pct)}`}>
                                {fmtPct(pct)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Per-holding FX impact rows */}
                      {ccyHoldings.map((h) => {
                        const valueBase = toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base);
                        return (
                          <tr key={h.id} className="hover:bg-slate-700/20 transition-colors border-b border-slate-700/20">
                            <td className="px-4 py-3 pl-8">
                              <p className="font-medium text-slate-200 truncate max-w-[160px]">{h.name || h.ticker}</p>
                              <p className="text-xs text-slate-500">{h.ticker}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium text-slate-300 tabular-nums">{fmt(valueBase)}</p>
                            </td>
                            {FX_PERIODS.map((period) => {
                              const pct = fxReturn(ccy, period);
                              // S$ impact = holding value × FX % (approximate; exact requires prev price)
                              const impact = pct != null ? valueBase * pct / 100 : null;
                              return (
                                <td key={period} className="px-4 py-3 text-right">
                                  {impact != null ? (
                                    <>
                                      <p className={`tabular-nums font-medium text-sm ${gainColor(impact)}`}>
                                        {impact >= 0 ? '+' : ''}{fmt(impact)}
                                      </p>
                                      <p className={`text-xs tabular-nums ${gainColor(pct)}`}>
                                        {fmtPct(pct)}
                                      </p>
                                    </>
                                  ) : (
                                    <span className="text-slate-700 text-xs">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Currency subtotal */}
                      {ccyHoldings.length > 1 && (
                        <tr className="bg-slate-800/40 border-b border-slate-700/40">
                          <td className="px-4 py-2 pl-8 text-xs text-slate-500 font-medium">{ccy} total</td>
                          <td className="px-4 py-2 text-right text-xs text-slate-400 tabular-nums font-medium">
                            {fmt(ccyHoldings.reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0))}
                          </td>
                          {FX_PERIODS.map((period) => {
                            const pct = fxReturn(ccy, period);
                            const totalImpact = pct != null
                              ? ccyHoldings.reduce((s, h) => s + toBase(h.quantity * h.currentPrice, h.currency, exchangeRates, base), 0) * pct / 100
                              : null;
                            return (
                              <td key={period} className="px-4 py-2 text-right">
                                {totalImpact != null ? (
                                  <p className={`text-xs tabular-nums font-semibold ${gainColor(totalImpact)}`}>
                                    {totalImpact >= 0 ? '+' : ''}{fmt(totalImpact)}
                                  </p>
                                ) : <span className="text-slate-700 text-xs">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasHistory && (
            <p className="px-4 py-2 text-xs text-slate-600 border-t border-slate-700/30">
              Refresh prices to load FX impact data
            </p>
          )}
        </div>
      )}

      {/* Cash income */}
      {cashHoldings.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash — Interest Income</p>
            <p className="text-sm font-semibold text-emerald-400">+{fmt(totalCashIncome)}/yr</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Account</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Balance</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Rate</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Annual</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Monthly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {cashHoldings.map((h) => {
                const annual = h.annualYieldPct != null
                  ? toBase(h.quantity * h.annualYieldPct / 100, h.currency, exchangeRates, base)
                  : null;
                return (
                  <tr key={h.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">{h.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {fmt(toBase(h.quantity, h.currency, exchangeRates, base))}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                      {h.annualYieldPct != null ? `${h.annualYieldPct.toFixed(2)}% p.a.` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      <span className={annual != null ? 'text-emerald-400' : 'text-slate-600'}>
                        {annual != null ? `+${fmt(annual)}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 tabular-nums text-xs">
                      {annual != null ? `+${fmt(annual / 12)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
