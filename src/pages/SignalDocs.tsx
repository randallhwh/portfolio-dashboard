import { BookOpen, TrendingUp, Activity, BarChart2, Zap, Target, Shield, AlertTriangle } from 'lucide-react';

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, children }: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4 scroll-mt-6">
      <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
        <Icon size={16} className="text-blue-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-slate-300 mt-4 mb-1.5 border-b border-slate-800 pb-1">{title}</h3>;
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/80 border border-slate-700/60 rounded-lg px-4 py-2.5 font-mono text-xs text-slate-300 my-2">
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{children}</span>;
}

function DefTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-xs mt-1">
      <tbody>
        {rows.map(([term, def]) => (
          <tr key={term} className="border-b border-slate-800/50 last:border-0">
            <td className="py-1.5 pr-4 text-slate-400 font-mono whitespace-nowrap align-top w-36">{term}</td>
            <td className="py-1.5 text-slate-300">{def}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThresholdTable({ rows }: { rows: { range: string; meaning: string; color: string }[] }) {
  return (
    <table className="w-full text-xs mt-1">
      <thead>
        <tr className="text-slate-500 border-b border-slate-800">
          <th className="text-left py-1 pr-4 font-medium w-36">Value / Range</th>
          <th className="text-left py-1 font-medium">Interpretation</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-800/40 last:border-0">
            <td className={`py-1.5 pr-4 font-mono font-semibold ${r.color}`}>{r.range}</td>
            <td className="py-1.5 text-slate-300">{r.meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV = [
  { href: '#score',     label: 'Composite Score'    },
  { href: '#regime',    label: 'Regime Adjustment'  },
  { href: '#rsi',       label: 'RSI'                },
  { href: '#macd',      label: 'MACD'               },
  { href: '#bb',        label: 'Bollinger Bands'    },
  { href: '#atr',       label: 'ATR'                },
  { href: '#sma',       label: 'Moving Averages'    },
  { href: '#volume',    label: 'Volume & OBV'       },
  { href: '#flags',     label: 'Signal Flags'       },
  { href: '#exec',      label: 'Execution Quality'  },
  { href: '#entry',     label: 'Entry / Exit Levels'},
  { href: '#sizing',    label: 'Position Sizing'    },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SignalDocs() {
  return (
    <div className="flex gap-6">
      {/* Sticky sidebar nav */}
      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-6 space-y-0.5">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2">On this page</p>
          {NAV.map(n => (
            <a
              key={n.href}
              href={n.href}
              className="block text-xs text-slate-500 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800/50 transition-all"
            >
              {n.label}
            </a>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <BookOpen size={22} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Signal Documentation</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Complete reference for every indicator, score, flag, and metric on the Signals page.
              All signals use 6 months of daily OHLCV data (~126 trading bars) sourced from Yahoo Finance.
            </p>
          </div>
        </div>

        {/* ── Composite Score ─────────────────────────────────────────────── */}
        <Section id="score" icon={Activity} title="Composite Signal Score (0–100)">
          <p className="text-sm text-slate-400">
            Every ticker is reduced to a single score combining four dimensions. A higher score is more bullish;
            scores are always regime-adjusted before display.
          </p>

          <Sub title="Weighting formula" />
          <Formula>
            rawScore = Trend×0.30 + Momentum×0.30 + Volatility×0.15 + Volume×0.15
          </Formula>
          <p className="text-xs text-slate-500">
            Weights sum to 0.90. The remaining 0.10 is implicitly absorbed by the regime pull toward neutral (see Regime Adjustment).
          </p>

          <Sub title="Score → Rating mapping" />
          <ThresholdTable rows={[
            { range: '75 – 100', meaning: 'STRONG BUY — strong trend, momentum aligned, volume confirming', color: 'text-emerald-400' },
            { range: '60 – 74',  meaning: 'BUY — most signals positive, acceptable risk/reward',            color: 'text-green-400'   },
            { range: '40 – 59',  meaning: 'NEUTRAL — mixed signals; avoid new entries',                    color: 'text-slate-400'   },
            { range: '25 – 39',  meaning: 'SELL — majority of signals bearish',                            color: 'text-amber-400'   },
            { range: '0 – 24',   meaning: 'STRONG SELL — trend broken, momentum negative, risk elevated',  color: 'text-red-400'     },
          ]} />

          <Sub title="Component sub-scores" />
          <DefTable rows={[
            ['Trend (30%)',      'SMA20 vs SMA50 alignment, price position vs both MAs. Range 0–100.'],
            ['Momentum (30%)',   'MACD (60% weight) + RSI (40% weight) combined. Range 0–100.'],
            ['Volatility (15%)', 'Price position within Bollinger Bands ± squeeze bonus. Range 0–100.'],
            ['Volume (15%)',     'Volume ratio vs 20-day average + OBV trend direction. Range 0–100.'],
          ]} />
        </Section>

        {/* ── Regime Adjustment ───────────────────────────────────────────── */}
        <Section id="regime" icon={Shield} title="Regime Adjustment">
          <p className="text-sm text-slate-400">
            Raw scores are pulled toward neutral (50) based on the active Bridgewater macro regime.
            This dampens signals in adverse regimes without flipping them — a raw BUY in a RECESSION becomes a softer signal, not a SELL.
          </p>
          <Formula>
            finalScore = 50 + (rawScore − 50) × regimeMultiplier
          </Formula>
          <p className="text-xs text-slate-500 mb-2">
            Example: rawScore 75 in RECESSION (×0.40) → 50 + (75−50)×0.40 = <strong className="text-slate-300">60</strong> (BUY, not STRONG BUY).
          </p>

          <ThresholdTable rows={[
            { range: 'GOLDILOCKS  ×1.00',     meaning: 'No dampening — full signal strength. Trend-following optimal.',           color: 'text-emerald-400' },
            { range: 'REFLATION  ×0.85',      meaning: '15% pull toward neutral. Prefer commodity & value; take profits faster.', color: 'text-yellow-400'  },
            { range: 'STAGFLATION  ×0.60',    meaning: '40% dampening. Defensive only; mean-reversion bounces only.',             color: 'text-amber-400'   },
            { range: 'RECESSION  ×0.40',      meaning: '60% dampening. Capital preservation; oversold bounces only.',             color: 'text-red-400'     },
            { range: 'RISK_OFF_SPIKE  ×0.00', meaning: 'All scores locked to 50 (NEUTRAL). No new entries; raise cash.',          color: 'text-red-500'     },
          ]} />
        </Section>

        {/* ── RSI ─────────────────────────────────────────────────────────── */}
        <Section id="rsi" icon={Activity} title="RSI — Relative Strength Index (14)">
          <p className="text-sm text-slate-400">
            Measures the speed and magnitude of price changes to identify overbought and oversold conditions.
            Uses Wilder's original smoothing (exponential, not simple), matching TradingView's implementation.
          </p>

          <Sub title="Formula" />
          <Formula>
            RS  = AvgGain(14) / AvgLoss(14)   [Wilder smoothing: (prev×13 + curr) / 14]{'\n'}
            RSI = 100 − (100 / (1 + RS))
          </Formula>

          <Sub title="Thresholds & scoring" />
          <ThresholdTable rows={[
            { range: '> 70',    meaning: 'Overbought — price may be extended; momentum score penalised (rsiScore 25). Flags the OVERBOUGHT badge.', color: 'text-red-400'     },
            { range: '50 – 70', meaning: 'Bullish momentum zone — highest score (rsiScore 85 for 50–70 band).',                                      color: 'text-emerald-400' },
            { range: '40 – 50', meaning: 'Neutral-bullish — mildly positive (rsiScore 65).',                                                         color: 'text-slate-300'   },
            { range: '30 – 40', meaning: 'Weakening momentum (rsiScore 45).',                                                                        color: 'text-amber-400'   },
            { range: '< 30',    meaning: 'Oversold — potential reversal; rsiScore 35. Flags the OVERSOLD badge.',                                    color: 'text-emerald-400' },
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            RSI contributes 40% of the Momentum component (which itself is 30% of the final score).
            Oversold readings score slightly lower than the bull zone because they represent momentum breakdown,
            not confirmation — the OVERSOLD flag is the primary actionable signal.
          </p>
        </Section>

        {/* ── MACD ────────────────────────────────────────────────────────── */}
        <Section id="macd" icon={TrendingUp} title="MACD — Moving Average Convergence Divergence (12, 26, 9)">
          <p className="text-sm text-slate-400">
            Tracks the relationship between two exponential moving averages to surface trend direction and momentum shifts.
          </p>

          <Sub title="Formula" />
          <Formula>
            MACD line   = EMA(12) − EMA(26){'\n'}
            Signal line = EMA(9) of MACD line{'\n'}
            Histogram   = MACD line − Signal line
          </Formula>

          <Sub title="Components displayed" />
          <DefTable rows={[
            ['MACD line',   'Direction of the primary trend.'],
            ['Signal line', 'Smoothed MACD — crossover triggers entries/exits.'],
            ['Histogram',   'Distance between MACD and signal. Growing histogram = strengthening trend; shrinking = weakening.'],
          ]} />

          <Sub title="Scoring logic" />
          <ThresholdTable rows={[
            { range: 'MACD > signal AND MACD > 0, histogram growing', meaning: 'Full bull — macdScore 95 (strongest)',      color: 'text-emerald-400' },
            { range: 'MACD > signal AND MACD > 0, histogram flat',    meaning: 'Bull — macdScore 75',                       color: 'text-green-400'   },
            { range: 'MACD > signal BUT MACD ≤ 0',                    meaning: 'Early recovery below zero — score 45',      color: 'text-slate-300'   },
            { range: 'MACD < signal, histogram still > 0',            meaning: 'Momentum fading — score 30',                color: 'text-amber-400'   },
            { range: 'MACD < signal AND histogram < 0',               meaning: 'Full bear — score 10',                      color: 'text-red-400'     },
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            MACD contributes 60% of the Momentum component (Momentum = MACD×0.6 + RSI×0.4).
          </p>
        </Section>

        {/* ── Bollinger Bands ──────────────────────────────────────────────── */}
        <Section id="bb" icon={BarChart2} title="Bollinger Bands (20, 2σ)">
          <p className="text-sm text-slate-400">
            Volatility envelope around a 20-day SMA. Uses population standard deviation (÷N), matching TradingView.
          </p>

          <Sub title="Formula" />
          <Formula>
            Middle = SMA(20){'\n'}
            Upper  = SMA(20) + 2 × σ(20){'\n'}
            Lower  = SMA(20) − 2 × σ(20){'\n'}
            Bandwidth = (Upper − Lower) / Middle   [displayed as %]
          </Formula>

          <Sub title="Price position scoring (Volatility component)" />
          <ThresholdTable rows={[
            { range: 'Price > Upper band',  meaning: 'Overbought extreme — score 20. Likely overextended; watch for mean-reversion.', color: 'text-red-400'     },
            { range: 'Lower < Price < Mid', meaning: 'Below midline but within bands — score 65. Potential accumulation zone.',        color: 'text-amber-400'   },
            { range: 'Mid < Price < Upper', meaning: 'Healthy bull range — score 55.',                                                 color: 'text-green-400'   },
            { range: 'Price < Lower band',  meaning: 'Oversold extreme — score 80. Highest volatility score; reversal potential.',    color: 'text-emerald-400' },
          ]} />

          <Sub title="BB Squeeze" />
          <p className="text-xs text-slate-400">
            When bandwidth drops below 4% (0.04), the bands have contracted to historically narrow levels. This signals
            low volatility compression before a directional breakout. The score receives a +15 bonus and the{' '}
            <Pill color="bg-blue-500/15 text-blue-400">BB Squeeze</Pill> flag is shown.
            Direction of the breakout is NOT predicted — use MACD/volume for confirmation.
          </p>
        </Section>

        {/* ── ATR ─────────────────────────────────────────────────────────── */}
        <Section id="atr" icon={Shield} title="ATR — Average True Range (14)">
          <p className="text-sm text-slate-400">
            Measures market volatility by averaging the true range over 14 periods. Used exclusively for stop loss
            placement and position sizing — it does not contribute to the composite score directly.
          </p>

          <Sub title="Formula" />
          <Formula>
            TrueRange = max(High − Low, |High − PrevClose|, |Low − PrevClose|){'\n'}
            ATR[1]    = mean(TR, 14){'\n'}
            ATR[i]    = (ATR[i−1] × 13 + TR[i]) / 14   [Wilder smoothing]
          </Formula>

          <Sub title="How ATR is used" />
          <DefTable rows={[
            ['Stop Loss',       'Suggested stop = Entry − 2×ATR. Adapts to each stock\'s natural volatility — tighter for calm stocks, wider for volatile ones.'],
            ['Position sizing', 'Stop distance in base currency drives the shares-at-risk calculation (see Position Sizing section).'],
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            The 2×ATR multiplier gives the position room to breathe through normal daily swings
            without being stopped out by noise, while still capping downside risk.
          </p>
        </Section>

        {/* ── Moving Averages ──────────────────────────────────────────────── */}
        <Section id="sma" icon={TrendingUp} title="Moving Averages — SMA20 & SMA50">
          <p className="text-sm text-slate-400">
            Simple moving averages define the trend structure. SMA200 (the classical golden/death cross) requires
            200 bars — only ~126 are available with a 6-month data window, so SMA20/SMA50 is used as a proxy.
          </p>

          <Sub title="Formula" />
          <Formula>
            SMA(n) = sum(Close[i−n+1 … i]) / n
          </Formula>

          <Sub title="Trend score logic" />
          <ThresholdTable rows={[
            { range: 'SMA20 > SMA50 AND Price > SMA20', meaning: 'Full uptrend — price above both MAs, short-term above long-term. Trend score 85.',  color: 'text-emerald-400' },
            { range: 'SMA20 > SMA50 AND Price < SMA20', meaning: 'Pullback in uptrend — potential entry. Trend score 60.',                            color: 'text-green-400'   },
            { range: 'SMA20 < SMA50 AND Price > SMA20', meaning: 'Bounce in downtrend — counter-trend; caution. Trend score 40.',                    color: 'text-amber-400'   },
            { range: 'SMA20 < SMA50 AND Price < SMA20', meaning: 'Full downtrend — avoid new longs. Trend score 15.',                                color: 'text-red-400'     },
            { range: 'SMA50 not yet computed',          meaning: 'Only SMA20 available. Price vs SMA20 only. Score 65 (above) or 35 (below).',       color: 'text-slate-400'   },
          ]} />

          <Sub title="MA Cross events" />
          <p className="text-xs text-slate-400 mb-2">
            A cross is detected only when the relationship changes on consecutive bars (not just the current state).
          </p>
          <DefTable rows={[
            ['↑ MA Cross (Golden)', 'SMA20 just crossed above SMA50. +12 bonus to trend score. Shows the GOLDEN CROSS badge.'],
            ['↓ MA Cross (Death)',  'SMA20 just crossed below SMA50. −12 penalty to trend score. Shows the DEATH CROSS badge.'],
          ]} />
        </Section>

        {/* ── Volume & OBV ─────────────────────────────────────────────────── */}
        <Section id="volume" icon={BarChart2} title="Volume Ratio & OBV">
          <p className="text-sm text-slate-400">
            Volume confirms price moves. Two measures are combined into the Volume component (15% of total score).
          </p>

          <Sub title="Volume Ratio" />
          <Formula>
            Volume Ratio = Today's Volume / SMA(Volume, 20)
          </Formula>
          <ThresholdTable rows={[
            { range: '> 2.0×', meaning: 'Very high volume — strong institutional interest. Score 90.',  color: 'text-emerald-400' },
            { range: '1.5–2.0×', meaning: 'High volume — above-average conviction. Score 75.',          color: 'text-green-400'   },
            { range: '1.0–1.5×', meaning: 'Average volume. Score 50.',                                  color: 'text-slate-400'   },
            { range: '0.7–1.0×', meaning: 'Below-average — weak conviction. Score 35.',                 color: 'text-amber-400'   },
            { range: '< 0.7×',   meaning: 'Low volume — moves may not be sustained. Score 15.',         color: 'text-red-400'     },
          ]} />

          <Sub title="OBV — On-Balance Volume" />
          <Formula>
            OBV[i] = OBV[i−1] + Volume[i]   if Close[i] {'>'} Close[i−1]{'\n'}
            OBV[i] = OBV[i−1] − Volume[i]   if Close[i] &lt; Close[i−1]{'\n'}
            OBV[i] = OBV[i−1]               if Close[i] = Close[i−1]
          </Formula>
          <p className="text-xs text-slate-400">
            OBV is compared to its own 20-day SMA. If OBV is above its SMA (volume flowing in), the volume score
            gets +15. If below (volume flowing out), −15. OBV divergence from price is a leading indicator:
            rising price + falling OBV signals a weakening trend.
          </p>
        </Section>

        {/* ── Signal Flags ─────────────────────────────────────────────────── */}
        <Section id="flags" icon={AlertTriangle} title="Signal Flags">
          <p className="text-sm text-slate-400">
            Boolean flags that appear as badges on each card when triggered. They highlight specific market
            conditions that require attention beyond the composite score.
          </p>

          <div className="space-y-3 mt-2">
            <div className="flex items-start gap-3">
              <Pill color="bg-emerald-500/15 text-emerald-400">Oversold</Pill>
              <p className="text-xs text-slate-400 flex-1">
                RSI &lt; 30. Price has fallen sharply; statistically likely to mean-revert. Does not guarantee a bounce —
                stocks can remain oversold for weeks in downtrends. Best used with a NEUTRAL or better regime.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Pill color="bg-red-500/15 text-red-400">Overbought</Pill>
              <p className="text-xs text-slate-400 flex-1">
                RSI &gt; 70. Momentum may be exhausted. Consider reducing position or tightening trailing stop.
                Strong trends can stay overbought for months — treat as a warning, not a sell signal alone.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Pill color="bg-blue-500/15 text-blue-400">BB Squeeze</Pill>
              <p className="text-xs text-slate-400 flex-1">
                Bollinger Band width &lt; 4%. Volatility has compressed to its lowest point in the lookback window.
                Historically precedes a sharp directional move. Does not indicate direction — watch for a MACD crossover
                or volume spike to confirm the breakout direction.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Pill color="bg-emerald-500/15 text-emerald-400">↑ MA Cross</Pill>
              <p className="text-xs text-slate-400 flex-1">
                SMA20 just crossed above SMA50 (proxy golden cross). A structural shift from bearish to bullish trend.
                This flag only appears on the bar the crossover occurs — it clears the next day.
                Confirmation: price should also be above SMA20 and volume should be above average.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Pill color="bg-red-500/15 text-red-400">↓ MA Cross</Pill>
              <p className="text-xs text-slate-400 flex-1">
                SMA20 just crossed below SMA50 (proxy death cross). Structural shift to downtrend.
                A strong exit signal when combined with MACD &lt; signal and price &lt; SMA20.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Execution Quality ────────────────────────────────────────────── */}
        <Section id="exec" icon={Zap} title="Execution Quality">
          <p className="text-sm text-slate-400">
            Two research-backed metrics that answer: <em>"Is this a good time to execute, and how fresh is the signal?"</em>
          </p>

          <Sub title="Corwin-Schultz Spread Estimate (CS Spread)" />
          <p className="text-xs text-slate-400 mb-2">
            Estimates the effective bid-ask spread from daily OHLC data alone — no tick data required.
            Based on Corwin & Schultz (2012). The intuition: daily highs tend to be executed near the ask price,
            and daily lows near the bid. Comparing single-day vs. two-day ranges isolates the spread component.
          </p>
          <Formula>
            β = [ln(H₁/L₁)]² + [ln(H₂/L₂)]²     [adjacent-day pair variance]{'\n'}
            γ = [ln(max(H₁,H₂) / min(L₁,L₂))]²   [two-day range variance]{'\n'}
            α = (√(2β) − √β) / (3−2√2) − √(γ/(3−2√2)){'\n'}
            spread = 2(eᵅ − 1)/(1 + eᵅ)           [averaged over 20 pairs, as %]
          </Formula>
          <ThresholdTable rows={[
            { range: '< 5 bps (< 0.05%)',   meaning: 'Liquid — tight spread, suitable for market orders. Typical large-cap stock.',  color: 'text-emerald-400' },
            { range: '5–20 bps (0.05–0.20%)', meaning: 'Moderate — use limit orders; spread cost is manageable.',                    color: 'text-amber-400'   },
            { range: '> 20 bps (> 0.20%)', meaning: 'Wide — significant slippage risk. Use limit orders; avoid large market orders.', color: 'text-red-400'     },
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            Note: the CS estimator tends to overestimate spreads for very liquid stocks (by ~2–5 bps) and
            underestimate for illiquid ones. Treat it as an order-of-magnitude guide, not a precise figure.
          </p>

          <Sub title="Alpha Decay (Signal Age)" />
          <p className="text-xs text-slate-400 mb-2">
            Based on Di Mascio, Lines & Naik (2021) and Kaminski & Lo (2014). Every signal has a half-life:
            the number of trading days after which roughly half the original informational edge has decayed.
            Edge decays exponentially — a 200-day-old momentum signal retains only 50% of its original edge.
          </p>
          <Formula>
            decayPct = 0.5^(signalAgeBars / halfLife) × 100
          </Formula>
          <DefTable rows={[
            ['Signal type',       'Determined by: mean-reversion wins if RSI is in oversold/overbought territory; momentum if MACD hist direction or SMA trend is active; neutral otherwise.'],
            ['Momentum half-life', '200 trading days (~10 months). Trend-following signals persist for months.'],
            ['Mean-rev half-life', '5 trading days (~1 week). Oversold/overbought signals decay rapidly — act quickly or they expire.'],
            ['Neutral half-life',  '30 trading days. No dominant signal; moderate decay assumed.'],
            ['signalAgeBars',      'Consecutive bars the current signal state has been active (e.g., bars RSI has been < 30, or bars MACD histogram has been positive).'],
          ]} />
          <ThresholdTable rows={[
            { range: '≥ 70% edge remaining', meaning: 'Fresh signal — full weight. Act with confidence.',                       color: 'text-emerald-400' },
            { range: '40–69%',               meaning: 'Fading — signal still valid but weaken your conviction accordingly.',   color: 'text-amber-400'   },
            { range: '< 40%',                meaning: 'Stale — most of the edge is gone. Wait for a new signal confirmation.', color: 'text-red-400'     },
          ]} />
        </Section>

        {/* ── Entry / Exit Levels ──────────────────────────────────────────── */}
        <Section id="entry" icon={Target} title="Entry / Exit Levels">
          <p className="text-sm text-slate-400">
            Pre-calculated price levels shown in the detail panel. These are starting points — adjust for your
            specific entry price and risk tolerance.
          </p>

          <Sub title="Stop Loss (ATR-based)" />
          <Formula>
            Stop = EntryPrice − 2 × ATR(14)
          </Formula>
          <p className="text-xs text-slate-400">
            Adapts to each stock's current volatility. A low-volatility stock gets a tighter stop; a high-volatility
            stock gets more room. The 2×ATR distance is a widely used default that catches most normal price swings
            without being stopped out by noise.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Alternative shown: O'Neil's 8% rule (Cost − 8%). Use whichever is tighter when you have a cost basis.
          </p>

          <Sub title="Profit Targets (3-tranche exit)" />
          <DefTable rows={[
            ['Target 1 (+3%)', 'Sell ⅓ of position. Lock in initial profit, reduce risk, lower average cost if position runs.'],
            ['Target 2 (+6%)', 'Sell another ⅓. By this point 67% of the position is booked at a profit.'],
            ['Trailing (last ⅓)', 'Hold the final third with a −10% trailing stop from the highest close. Lets winners run while protecting gains.'],
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            The +3%/+6% fixed targets are conservative defaults appropriate for short-to-medium-term swings.
            In strong GOLDILOCKS regimes with a fresh momentum signal and high volume confirmation, you may extend
            Target 2 to +10% or beyond and use a trailing stop on the full position.
          </p>

          <Sub title="Trailing stop mechanics" />
          <p className="text-xs text-slate-400">
            Track the highest closing price after entry. The trailing stop is placed 10% below that peak.
            If the stock closes below the trailing stop, exit the remaining position at the next open.
            Do not move the stop downward — only upward.
          </p>
        </Section>

        {/* ── Position Sizing ──────────────────────────────────────────────── */}
        <Section id="sizing" icon={Shield} title="Position Sizing">
          <p className="text-sm text-slate-400">
            Risk-based position sizing ensures no single losing trade damages the portfolio beyond a pre-set limit.
            The stop distance (2×ATR) determines how many shares can be purchased while keeping the loss within 1–2%
            of the total portfolio.
          </p>

          <Sub title="Formula" />
          <Formula>
            RiskAmount  = PortfolioValue × riskPct          [1% or 2%]{'\n'}
            StopDist    = (EntryPrice − StopPrice) × FxRate [in base currency]{'\n'}
            MaxShares   = floor(RiskAmount / StopDist){'\n'}
            PositionVal = MaxShares × EntryPrice × FxRate
          </Formula>

          <Sub title="Risk level guidelines" />
          <ThresholdTable rows={[
            { range: '1% risk / trade', meaning: 'Conservative. Suits STAGFLATION/RECESSION regimes or high-volatility stocks (ATR > 3%).', color: 'text-slate-300' },
            { range: '2% risk / trade', meaning: 'Moderate. Default for GOLDILOCKS/REFLATION with liquid stocks (CS spread < 10 bps).',       color: 'text-slate-300' },
            { range: 'Max 5% portfolio', meaning: 'Hard cap on position value regardless of sizing calculation. Concentration risk limit.',     color: 'text-amber-400' },
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            Position value shown is a <strong className="text-slate-400">maximum</strong> based on ATR-stop risk.
            Start smaller (e.g. ½ position) if the signal is fresh but unconfirmed, the CS spread is wide,
            or the regime is adverse. Scale in on confirmation.
          </p>

          <Sub title="Regime position size adjustments" />
          <DefTable rows={[
            ['GOLDILOCKS',     '2% risk per trade. Full position on initial entry.'],
            ['REFLATION',      '1.5% risk per trade. Consider scaling in 50% + 50%.'],
            ['STAGFLATION',    '0.5% risk per trade. Reduce all position sizes by 75%.'],
            ['RECESSION',      '0.5% risk per trade. Oversold bounce plays only; small size.'],
            ['RISK_OFF_SPIKE', 'No new entries. Reduce existing positions 50%; raise cash.'],
          ]} />
          <p className="text-xs text-slate-500 mt-2">
            If the volatility regime is HIGH or CRISIS (shown in the regime banner), additionally cut
            all calculated sizes by 30–50% to account for gap risk and elevated market impact costs.
          </p>
        </Section>

        {/* Footer */}
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-1">Data sources & references</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>OHLCV data: Yahoo Finance v8 API · 6-month daily bars (~126 trading days)</li>
            <li>RSI: Wilder, J.W. (1978). <em>New Concepts in Technical Trading Systems.</em></li>
            <li>MACD: Appel, G. (1979). Original formulation (12, 26, 9).</li>
            <li>Bollinger Bands: Bollinger, J. (1983). Population standard deviation (÷N).</li>
            <li>ATR: Wilder (1978). Wilder's smoothed version.</li>
            <li>CS Spread: Corwin, S.A. & Schultz, P. (2012). "A Simple Way to Estimate Bid-Ask Spreads from Daily High and Low Prices." <em>Journal of Finance.</em></li>
            <li>Alpha Decay: Di Mascio, R., Lines, A. & Naik, N. (2021). "Alpha Decay." <em>Working paper</em>; Kaminski, K. & Lo, A. (2014).</li>
            <li>Position sizing: O'Neil, W. (2002). <em>How to Make Money in Stocks.</em> (8% hard stop rule)</li>
          </ul>
          <p className="mt-3 text-slate-600">
            For informational purposes only. Not financial advice. Past signal performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
}
