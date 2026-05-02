import { LayoutDashboard, Briefcase, Brain, BarChart2, Settings, TrendingUp, Layers, Banknote, Lock, Activity, Radar, Zap } from 'lucide-react';
import { usePortfolioStore } from '../../store/portfolioStore';

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'holdings' as const, label: 'Holdings',    icon: Briefcase       },
  { id: 'returns'  as const, label: 'Returns',     icon: Activity        },
  { id: 'bias'     as const, label: 'Bias Check',  icon: Brain           },
  { id: 'analytics' as const, label: 'Analytics',  icon: BarChart2       },
  { id: 'regime'    as const, label: 'Regime',     icon: Radar           },
  { id: 'signals'   as const, label: 'Signals',    icon: Zap             },
];

export function Sidebar() {
  const { activeView, setActiveView, activePortfolio, setActivePortfolio, getBiasAlerts } = usePortfolioStore();
  const alerts = getBiasAlerts();
  const highAlerts = alerts.filter((a) => a.severity === 'high').length;
  const totalAlerts = alerts.length;

  const btnCls = (active: boolean, color = 'text-slate-300') =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'bg-slate-800 ' + color
        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
    }`;

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Portfolio</p>
            <p className="text-xs text-slate-500">Manager</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Liquid portfolio group */}
        <div className="px-3 pt-4 pb-2">
          <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Liquid</p>

          <button onClick={() => setActivePortfolio('Liquid')} className={btnCls(activePortfolio === 'Liquid', 'text-blue-400')}>
            <Layers size={14} className={activePortfolio === 'Liquid' ? 'text-blue-400' : 'text-slate-600'} />
            <span>All Liquid</span>
          </button>

          <div className="pl-3 mt-0.5 space-y-0.5">
            {([
              { id: 'Stocks', color: 'text-blue-300' },
              { id: 'Bonds',  color: 'text-cyan-400'  },
              { id: 'Cash',   color: 'text-emerald-400' },
            ] as const).map(({ id, color }) => (
              <button
                key={id}
                onClick={() => setActivePortfolio(id)}
                className={btnCls(activePortfolio === id, color)}
              >
                <Banknote size={13} className={activePortfolio === id ? 'opacity-80' : 'text-slate-700'} />
                <span className="text-sm">{id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SRS — separate retirement section */}
        <div className="mx-3 my-1 border-t border-slate-800" />
        <div className="px-3 py-2">
          <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Lock size={10} />
            Retirement
          </p>
          <button onClick={() => setActivePortfolio('SRS')} className={btnCls(activePortfolio === 'SRS', 'text-violet-400')}>
            <Lock size={14} className={activePortfolio === 'SRS' ? 'text-violet-400' : 'text-slate-600'} />
            <span>SRS</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded font-semibold bg-violet-500/20 text-violet-400">
              ILLIQUID
            </span>
          </button>
        </div>

        {/* Net worth view */}
        <div className="mx-3 my-1 border-t border-slate-800" />
        <div className="px-3 py-2">
          <button onClick={() => setActivePortfolio('all')} className={btnCls(activePortfolio === 'all', 'text-slate-300')}>
            <Layers size={14} className={activePortfolio === 'all' ? 'text-slate-400' : 'text-slate-700'} />
            <span>Net Worth (All)</span>
          </button>
        </div>

        <div className="mx-3 my-1 border-t border-slate-800" />

        {/* Views nav */}
        <nav className="px-3 py-2 space-y-0.5">
          <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Views</p>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeView === id;
            const showBadge = id === 'bias' && totalAlerts > 0;
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                {showBadge && (
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    highAlerts > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-900'
                  }`}>
                    {totalAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
