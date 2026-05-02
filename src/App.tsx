import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Holdings } from './pages/Holdings';
import { BiasCheck } from './pages/BiasCheck';
import { Analytics } from './pages/Analytics';
import { Returns } from './pages/Returns';
import { Regime } from './pages/Regime';
import { Signals } from './pages/Signals';
import { usePortfolioStore } from './store/portfolioStore';

export default function App() {
  const { activeView } = usePortfolioStore();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <Header />
      <main className="ml-56 pt-14 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'holdings' && <Holdings />}
          {activeView === 'bias' && <BiasCheck />}
          {activeView === 'returns'   && <Returns />}
          {activeView === 'analytics' && <Analytics />}
          {activeView === 'regime'    && <Regime />}
          {activeView === 'signals'   && <Signals />}
        </div>
      </main>
    </div>
  );
}
