import { Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Loader, TrendingUp } from 'lucide-react';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  holdings: 'Holdings',
  bias: 'Behavioral Bias Check',
  analytics: 'Analytics',
};

export function Header() {
  const { activeView, settings, updateSettings, saveSnapshot, fetchLivePrices, priceStatus, lastUpdated } =
    usePortfolioStore();

  // Auto-fetch on first load
  useEffect(() => {
    fetchLivePrices();
  }, []);

  const statusIcon = () => {
    if (priceStatus === 'loading') return <Loader size={13} className="animate-spin text-blue-400" />;
    if (priceStatus === 'success') return <CheckCircle size={13} className="text-emerald-400" />;
    if (priceStatus === 'error') return <AlertCircle size={13} className="text-red-400" />;
    return <RefreshCw size={13} />;
  };

  const statusLabel = () => {
    if (priceStatus === 'loading') return 'Fetching…';
    if (priceStatus === 'error') return 'Fetch failed';
    if (priceStatus === 'success' && lastUpdated)
      return `Updated ${formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}`;
    return 'Refresh prices';
  };

  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 z-10">
      <h1 className="text-base font-semibold text-slate-100">{VIEW_TITLES[activeView]}</h1>

      <div className="flex items-center gap-2">
        <button
          onClick={() => updateSettings({ showCostBasis: !settings.showCostBasis })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            settings.showCostBasis
              ? 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-600'
              : 'border-blue-500 bg-blue-500/10 text-blue-400'
          }`}
          title={settings.showCostBasis ? 'Hide cost basis (Cost Blindfold)' : 'Show cost basis'}
        >
          {settings.showCostBasis ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>{settings.showCostBasis ? 'Cost Visible' : 'Cost Blindfold'}</span>
        </button>

        <button
          onClick={() => updateSettings({ neutralColorMode: !settings.neutralColorMode })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            settings.neutralColorMode
              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
              : 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-600'
          }`}
          title="Neutral color mode reduces emotional response to gains/losses"
        >
          <span>{settings.neutralColorMode ? 'Neutral Colors' : 'Standard Colors'}</span>
        </button>

        <button
          onClick={fetchLivePrices}
          disabled={priceStatus === 'loading'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Fetch live prices from Yahoo Finance"
        >
          {statusIcon()}
          <span>{statusLabel()}</span>
        </button>

        <button
          onClick={() => {
            const next = settings.investingStyle === 'value' ? 'mixed' : settings.investingStyle === 'mixed' ? 'momentum' : 'value';
            updateSettings({ investingStyle: next });
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            settings.investingStyle === 'value'
              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
              : settings.investingStyle === 'momentum'
              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
              : 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-600'
          }`}
          title="Cycle: Value → Mixed → Momentum (affects signal framing on Signals page)"
        >
          <TrendingUp size={13} />
          <span>
            {settings.investingStyle === 'value' ? 'Value' : settings.investingStyle === 'momentum' ? 'Momentum' : 'Mixed'}
          </span>
        </button>

        <button
          onClick={saveSnapshot}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-all"
          title="Save today's portfolio snapshot for the chart"
        >
          <span>Snapshot</span>
        </button>
      </div>
    </header>
  );
}
