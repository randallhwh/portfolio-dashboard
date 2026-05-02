import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchAllIndicators,
  computeFullAnalysis,
  REGIME_TICKERS,
  type FullRegimeAnalysis,
  type RegimeName,
} from '../services/regimeDetection';

interface RegimeStore {
  indicators: Record<string, number[]>;
  analysis: FullRegimeAnalysis | null;
  history: RegimeName[];
  confirmedRegime: RegimeName;
  status: 'idle' | 'loading' | 'success' | 'error';
  errorDetail: string | null;
  lastUpdated: string | null;
  fetch: () => Promise<void>;
}

export const useRegimeStore = create<RegimeStore>()(
  persist(
    (set, get) => ({
      indicators: {},
      analysis: null,
      history: [],
      confirmedRegime: 'UNKNOWN',
      status: 'idle',
      errorDetail: null,
      lastUpdated: null,

      fetch: async () => {
        set({ status: 'loading', errorDetail: null });
        try {
          const indicators = await fetchAllIndicators();
          const loaded = Object.values(indicators).filter(v => v.length > 0).length;
          if (loaded === 0) {
            set({ status: 'error', errorDetail: `All ${REGIME_TICKERS.length} tickers returned no data` });
            return;
          }
          let analysis;
          try {
            analysis = computeFullAnalysis(indicators);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            set({ status: 'error', errorDetail: `Compute error: ${msg}` });
            return;
          }

          const currentRegime = analysis.bridgewater.regime;

          // Stability: confirm regime only when last 3 detections agree
          const prev = get().history;
          const history = [...prev, currentRegime].slice(-5) as RegimeName[];
          const lastThree = history.slice(-3);
          const confirmedRegime: RegimeName =
            lastThree.length === 3 && lastThree.every(r => r === currentRegime)
              ? currentRegime
              : (get().confirmedRegime === 'UNKNOWN' ? currentRegime : get().confirmedRegime);

          set({
            indicators,
            analysis,
            history,
            confirmedRegime,
            status: 'success',
            lastUpdated: new Date().toISOString(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          set({ status: 'error', errorDetail: `Fetch error: ${msg}` });
        }
      },
    }),
    {
      name: 'regime-store',
      version: 2,
      partialize: (s) => ({
        analysis: s.analysis,
        history: s.history,
        confirmedRegime: s.confirmedRegime,
        lastUpdated: s.lastUpdated,
        indicators: {},
      }),
    }
  )
);
