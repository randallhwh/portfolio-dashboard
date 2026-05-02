# Market Regime Detection Model

**Source file:** `src/services/regimeDetection.ts`  
**UI:** `src/pages/Regime.tsx`  
**State:** `src/store/regimeStore.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Sources](#data-sources)
4. [Framework 1 — Bridgewater Growth/Inflation Quadrant](#framework-1--bridgewater-growthinflation-quadrant)
5. [Framework 2 — Business Cycle Clock](#framework-2--business-cycle-clock)
6. [Framework 3 — Volatility Regime](#framework-3--volatility-regime)
7. [Framework 4 — Liquidity Regime](#framework-4--liquidity-regime)
8. [Framework 5 — Credit Cycle](#framework-5--credit-cycle)
9. [Leading Indicators & Transition Risk](#leading-indicators--transition-risk)
10. [Cross-Framework Consensus](#cross-framework-consensus)
11. [Regime Stability (Confirmation Logic)](#regime-stability-confirmation-logic)
12. [Portfolio Alignment](#portfolio-alignment)
13. [Regime Classification Summary](#regime-classification-summary)
14. [Limitations and Proxies](#limitations-and-proxies)

---

## Overview

The regime detection engine classifies the current macro environment using **five independent analytical frameworks**, then aggregates them into a consensus view and computes a **transition risk score** using **10 leading indicators** designed to anticipate regime shifts before they fully develop.

The goal is to answer two questions simultaneously:

- **What is the current regime?** (current-state detection across 5 frameworks)
- **Is a regime change likely soon?** (forward-looking transition risk)

All inputs are live market prices fetched from Yahoo Finance on demand. No static lookups, no sample data for the regime model.

---

## Architecture

```
fetchAllIndicators()          ← parallel Yahoo Finance fetches for 17 tickers
         │
         ▼
computeFullAnalysis()
   ├── computeBridgewater()    → RegimeResult      (Framework 1)
   ├── computeBusinessCycle()  → BusinessCycleResult (Framework 2)
   ├── computeVolatility()     → VolatilityResult   (Framework 3)
   ├── computeLiquidity()      → LiquidityResult    (Framework 4)
   ├── computeCreditCycle()    → CreditCycleResult  (Framework 5)
   ├── computeTransitionRisk() → TransitionRiskResult (10 leading indicators)
   └── computeConsensus()      → { riskBias, conviction, summary }
         │
         ▼
   FullRegimeAnalysis          ← persisted in Zustand store (regime-store v2)
```

Each framework is **fully independent** — it receives only the raw price series and returns its own classification. `computeConsensus` reads all five outputs to form a cross-framework view.

---

## Data Sources

### Tickers (17 total)

All fetched via `GET /yf/v8/finance/chart/{ticker}?interval=1d&range=6mo` through the Vite dev proxy (avoiding browser CORS restrictions).

| Ticker | Asset | Role |
|--------|-------|------|
| `SPY` | S&P 500 ETF | Equity growth proxy |
| `^VIX` | CBOE Volatility Index | Market fear gauge |
| `^TNX` | 10-Year Treasury yield | Long-end rates |
| `^IRX` | 3-Month T-Bill yield | Short-end rates / policy |
| `TLT` | 20Y+ Treasury ETF | Long-duration bond price |
| `TIP` | TIPS ETF | Inflation expectations (breakevens) |
| `GLD` | Gold ETF | Safe haven / inflation hedge |
| `GSG` | GSCI Commodity ETF | Broad commodity basket |
| `HYG` | High Yield Bond ETF | Credit risk appetite |
| `UUP` | US Dollar Bullish ETF | USD momentum |
| `IWM` | Russell 2000 ETF | Small-cap / market breadth |
| `LQD` | Investment Grade Corp Bond ETF | Credit quality anchor |
| `XLU` | Utilities Select Sector ETF | Defensive sector rotation |
| `XLK` | Technology Select Sector ETF | Risk-on sector rotation |
| `EEM` | Emerging Markets ETF | Global growth / USD sensitivity |
| `SHY` | 1-3Y Treasury ETF | Short-duration bond; yield curve shape |
| `CPER` | Copper ETF | Industrial demand / growth proxy |

**Time range:** 6 months (~126 trading days). This is sufficient for all signals — the longest lookback used is 126 days (126d SMA in the Bridgewater growth score).

**Forward-fill:** Missing closing prices (e.g. from holidays) are forward-filled using the last known close so that return calculations are not distorted.

---

## Framework 1 — Bridgewater Growth/Inflation Quadrant

**Inspired by:** Ray Dalio / Bridgewater Associates "All Weather" macro framework.

### Concept

Every asset class performs differently depending on whether growth and inflation are rising or falling relative to expectations. There are four possible macro states:

| | Growth Rising | Growth Falling |
|---|---|---|
| **Inflation Rising** | REFLATION | STAGFLATION |
| **Inflation Falling** | GOLDILOCKS | RECESSION |

A VIX override adds a fifth state: **RISK_OFF_SPIKE** when VIX > 30, overriding the quadrant classification regardless of growth/inflation readings.

### Growth Score (range: −4 to +4)

Four signals contribute to the growth axis:

**G1 — S&P 500 Trend** (`SPY`)  
Compares the current SPY price to its 126-day (6-month) simple moving average.
- SPY above 126d SMA → +2 (equity uptrend, growth positive)
- SPY below 126d SMA → −2

**G2 — Yield Curve (10Y − 3M)** (`^TNX − ^IRX`)  
The 10Y minus 3M spread is the most empirically reliable recession predictor.
- Spread < −0.5% (inverted) → −2 (historically precedes recession by 6–18 months)
- Spread > +1.0% → +1 (steep curve, growth expanding)
- Between → 0

**G3 — Long Treasury Bond Return** (`TLT`, 1-month)  
Bond price is inversely correlated with growth expectations — a bond rally signals the market is pricing in a slowdown.
- TLT 1M return > +3% → −1 (flight to safety = growth concern)
- TLT 1M return < −2% → +1 (bond selloff = growth/inflation rising)
- Otherwise → 0

**G4 — Credit Appetite** (`HYG vs TLT`, 1-month relative return)  
High yield bonds outperforming Treasuries signals risk appetite and growth confidence.
- HYG 1M return − TLT 1M return > +2% → +1 (risk-on, credit bullish)
- Below −2% → −1 (flight to quality, credit stress)

```
growthScore = clamp(G1 + G2 + G3 + G4, −4, +4)
```

### Inflation Score (range: −3 to +3)

Four signals contribute to the inflation axis:

**I1 — TIPS vs Nominal Treasuries** (`TIP vs TLT`, 3-month relative return)  
The TIP/TLT return differential is the market-based breakeven inflation rate proxy. TIPS outperforming means the market is pricing in more inflation.
- TIP 3M − TLT 3M > +2% → +2 (inflation sharply rising)
- +0.5% to +2% → +1
- −0.5% to +0.5% → 0
- −2% to −0.5% → −1
- Below −2% → −2 (disinflationary)

**I2 — Broad Commodities** (`GSG`, 3-month return)  
Commodity prices are a coincident/leading indicator of goods inflation.
- GSG 3M > +5% → +2 (significant inflation pressure)
- +1% to +5% → +1
- Below −5% → −1 (commodity bust, deflationary)

**I3 — Gold alongside Equities** (`GLD + SPY`, 1-month)  
Gold rising alongside equities signals an inflation regime. Gold rising with falling equities is a safe-haven signal, not an inflation signal.
- GLD 1M > +3% AND SPY 1M > 0 → +1 (simultaneous rise = inflation)
- Otherwise → 0

**I4 — US Dollar** (`UUP`, 3-month return)  
A stronger USD creates deflationary pressure globally (cheaper imports, EM stress). Weaker USD is inflationary.
- UUP 3M > +3% → −1 (USD strength, deflationary impulse)
- UUP 3M < −3% → +1 (USD weakness, inflationary)

```
inflationScore = clamp(I1 + I2 + I3 + I4, −3, +3)
```

### Quadrant Classification

```
growthUp    = growthScore > 0
inflationUp = inflationScore > 0

if  growthUp  && !inflationUp → GOLDILOCKS
if  growthUp  &&  inflationUp → REFLATION
if !growthUp  &&  inflationUp → STAGFLATION
if !growthUp  && !inflationUp → RECESSION
```

### Confidence Score

```
growthConf    = |growthScore| / 4       (how far from the axis boundary)
inflationConf = |inflationScore| / 3
confidence    = 0.40 + (growthConf × 0.6 + inflationConf × 0.4) × 0.55
```

Confidence ranges from ~40% (borderline) to ~95% (strong cross-asset consensus). The VIX crisis override sets confidence proportionally above 70%.

### Regime Recommendations

| Regime | Growth | Inflation | Recommended Allocation |
|--------|--------|-----------|------------------------|
| GOLDILOCKS | ↑ | ↓ | 60% stocks · 15% bonds · 15% real estate · 5% cash · 5% commodities |
| REFLATION | ↑ | ↑ | 50% stocks · 20% commodities · 15% cash · 10% real estate · 5% bonds |
| STAGFLATION | ↓ | ↑ | 45% cash · 20% stocks · 15% bonds · 15% commodities · 5% real estate |
| RECESSION | ↓ | ↓ | 40% bonds · 25% cash · 20% stocks · 10% commodities · 5% real estate |
| RISK_OFF_SPIKE | crisis | crisis | 45% cash · 30% bonds · 15% stocks · 10% commodities |

---

## Framework 2 — Business Cycle Clock

### Concept

While the Bridgewater framework measures the **level** of growth and inflation, the Business Cycle Clock measures their **rate of change** (momentum and acceleration). This captures whether the economy is speeding up or slowing down, independent of its absolute level.

The classic four-phase clock:

```
           Recovery → Expansion
              ↑              ↓
         Contraction ← Slowdown
```

### Growth Momentum Calculation

**SPY momentum** (annualised acceleration):
```
spyMom = (SPY 1M return × 12) − (SPY 3M return × 4)
```
A positive value means the 1-month annualised return is exceeding the 3-month annualised return — growth is accelerating.

**Breadth momentum** (`IWM/SPY` ratio, annualised):
```
ratioNow = IWM / SPY (today)
ratio1M  = IWM[−22] / SPY[−22]
breadthMom = ((ratioNow − ratio1M) / ratio1M) × 12
```
Small-cap outperformance signals broad, healthy economic expansion. Large-cap leadership is a narrowing breadth / late-cycle signal.

```
growthMomentum = spyMom × 0.7 + breadthMom × 0.3
```

### Inflation Momentum Calculation

**TIP momentum** (TIPS ETF, annualised acceleration):
```
tipMom = (TIP 1M return × 12) − (TIP 3M return × 4)
```

**GSG momentum** (commodity ETF, annualised acceleration):
```
gsgMom = (GSG 1M return × 12) − (GSG 3M return × 4)
```

```
inflationMomentum = tipMom × 0.6 + gsgMom × 0.4
```

### Phase Classification

```
threshold = 0.02 (annualised, i.e. 2% per year threshold for "accelerating")

gAccel = growthMomentum > threshold
iAccel = inflationMomentum > threshold

RECOVERY    = gAccel && !iAccel   (growth re-accelerating, inflation still falling)
EXPANSION   = gAccel && iAccel    (both accelerating — mid-cycle)
SLOWDOWN    = !gAccel && iAccel   (growth topping out, inflation still rising — late cycle)
CONTRACTION = !gAccel && !iAccel  (both decelerating — recessionary)
```

### Sector Recommendations by Phase

| Phase | Favoured Sectors | Action |
|-------|-----------------|--------|
| Recovery | Financials, Industrials, Consumer Discretionary | Add risk exposure |
| Expansion | Technology, Materials, Energy | Deploy remaining cash |
| Slowdown | Healthcare, Utilities, Consumer Staples | Rotate to defensives |
| Contraction | Bonds, cash, gold | Capital preservation |

---

## Framework 3 — Volatility Regime

### Concept

VIX (CBOE Volatility Index) measures the implied 30-day volatility of S&P 500 options. It is both a fear gauge and a risk regime indicator — elevated VIX compresses risk-adjusted returns across equities and forces position size reductions.

A secondary bond volatility proxy (using TLT realized vol) approximates the MOVE index (bond volatility), which is not available on Yahoo Finance.

### VIX Classification

| Level | VIX Range | Interpretation |
|-------|-----------|----------------|
| LOW | < 15 | Complacency zone — risk assets supported but mean-reversion risk building |
| NORMAL | 15–20 | Constructive — standard position sizing appropriate |
| ELEVATED | 20–25 | Caution warranted — consider 10–20% position size reduction |
| HIGH | 25–30 | Significant stress — defensive positioning advised |
| CRISIS | > 30 | Capital preservation overrides return objectives |

### VIX Trend

```
vix20dAvg = SMA(VIX, 20 days)

rising  = VIX > vix20dAvg × 1.12   (12% above moving average)
falling = VIX < vix20dAvg × 0.88   (12% below moving average)
stable  = otherwise
```

### Bond Volatility Proxy

```
bondVolProxy = annualized realized volatility of TLT over past 20 days
             = sqrt(variance of daily log-returns × 252) × 100
```

Elevated bond volatility alongside high VIX confirms a multi-asset stress environment.

---

## Framework 4 — Liquidity Regime

### Concept

Liquidity refers to the availability and cost of money in the financial system. Tight liquidity (rising rates, strong USD, widening credit spreads) is a headwind for all risk assets. Ample liquidity is supportive.

### Four Liquidity Signals

**L1 — Short-Rate Trend** (`^IRX`, 3-month return)  
The 3-month T-Bill yield is effectively the Fed Funds rate. Rising short rates = monetary tightening.
- IRX 3M > +5% → −1 (tightening)
- IRX 3M < −5% → +1 (easing)

**L2 — IG Credit Performance** (`LQD`, 3-month return)  
Investment-grade corporate bonds are highly sensitive to funding conditions. LQD rising = credit markets receptive; falling = tightening.
- LQD 3M > +2% → +1 (loose funding)
- LQD 3M < −3% → −1 (funding tightening)

**L3 — US Dollar** (`UUP`, 3-month return)  
The USD is effectively the global reserve currency. Dollar strength drains USD liquidity from the global system and creates headwinds for EM and commodity markets.
- UUP 3M > +3% → −1 (global liquidity tightening)
- UUP 3M < −3% → +1 (global liquidity expanding)

**L4 — HY vs IG Quality Spread** (`HYG − LQD`, 1-month relative return)  
When investors flee high-yield for investment-grade, it signals reduced risk appetite and funding stress.
- HYG 1M − LQD 1M > +1.5% → +1 (risk-on, ample liquidity)
- Below −1.5% → −1 (flight to quality, liquidity stress)

### Liquidity Score and Level

```
score = clamp(L1 + L2 + L3 + L4, −3, +3)

AMPLE      = score ≥ 2
NEUTRAL    = score 0 or 1
TIGHTENING = score −1 or −2
STRESS     = score ≤ −3
```

---

## Framework 5 — Credit Cycle

### Concept

Credit cycles lead economic cycles. When high-yield credit outperforms and is above its trend, the credit cycle is in expansion — a growth-supportive environment. When high-yield starts underperforming investment-grade, stress is building, often before equity markets react.

### Quality Spread Calculation

```
qualitySpread1M = HYG 1M return − LQD 1M return
qualitySpread3M = HYG 3M return − LQD 3M return
```

A positive spread means HY is outperforming IG — credit market is risk-on, spread compression ongoing.

### Trend Direction

```
improving      = qualitySpread1M > qualitySpread3M + 0.01
deteriorating  = qualitySpread1M < qualitySpread3M − 0.01
stable         = otherwise
```

### HYG Trend Filter

```
hygSMA63 = SMA(HYG, 63 days)   (approx 3 months)
hygAboveSMA = last(HYG) > hygSMA63
```

### Phase Classification

```
EXPANSION = qualitySpread1M > +1%   && hygAboveSMA   (HY outperforming + above trend)
STABLE    = qualitySpread1M > −1%   && hygAboveSMA   (neutral spread, HY above trend)
STRESS    = qualitySpread1M < −1.5% && !hygAboveSMA  (HY underperforming + below trend)
WIDENING  = otherwise                                 (deteriorating but not full stress)
```

Credit stress (WIDENING or STRESS) historically precedes equity drawdowns by 4–8 weeks.

---

## Leading Indicators & Transition Risk

### Purpose

The transition risk score measures the **probability of a near-term regime shift** rather than confirming the current regime. It scores 10 cross-asset leading indicators and produces:
- A **0–100 score** (higher = more likely to transition)
- A **risk level**: LOW / MODERATE / ELEVATED / HIGH
- A **predicted next regime** based on momentum direction
- Individual signal breakdowns with time horizons

### Scoring Mechanics

Each signal is classified as `bullish`, `bearish`, or `neutral`, with strength `strong`, `moderate`, or `weak`.

```
bearish strong   → rawScore += 18
bearish moderate → rawScore += 10
bearish weak     → rawScore +=  4
bullish strong   → rawScore −=  5
bullish moderate → rawScore −=  3
bullish weak     → rawScore −=  1
neutral          → rawScore += 0
```

The asymmetric scoring (bearish counts more than bullish) reflects the asymmetry of tail risk — regime breaks tend to be sudden and sharp.

```
normalised = clamp(round((rawScore / maxPossible) × 100), 0, 100)
maxPossible = signals.length × 18

LOW      = score < 25
MODERATE = score 25–44
ELEVATED = score 45–64
HIGH     = score ≥ 65
```

### The 10 Leading Indicators

---

**LI1 — Copper / Gold Ratio** (`CPER / GLD`, 3-month change)

Copper is driven by industrial demand; gold is driven by fear and inflation expectations. The ratio measures the market's confidence in real economic growth.

- Rising ratio (>+5%) → bullish: industrial demand building, growth regime forming
- Falling ratio (<−3%) → bearish: safe haven outperforming, growth deteriorating

Time horizon: **3–6 months**

---

**LI2 — Small Cap Breadth** (`IWM / SPY`, 2-month change)

Small-cap outperformance indicates broad economic participation. When the Russell 2000 starts lagging the S&P 500, growth is narrowing to large caps — a classic late-cycle signal.

- Ratio rising >+3% → bullish: broad participation, early/mid-cycle
- Ratio falling <−3% → bearish: breadth narrowing, late cycle

Time horizon: **1–3 months**

---

**LI3 — Yield Curve Trajectory** (`^TNX − ^IRX`, 3-month change)

This is the most important and most counter-intuitive signal: **yield curve un-inversion** (the inversion healing) is actually the most reliable recession warning, not the inversion itself.

Why? When the curve un-inverts, it usually means the market is pricing in rate cuts — because a recession is imminent. The classic sequence is: inversion → sustained inversion → un-inversion → recession arrives.

Special conditions detected:
- **Un-inversion**: 3M-ago spread < −0.3% AND current spread > 3M-ago spread by +0.3% → strong bearish
- **Bull steepening**: short rates falling faster than long rates (market pricing aggressive cuts) → strong bearish
- **Inversion deepening**: inverted AND slope worsening → moderate bearish
- **Positive steepening**: curve steepening from positive territory → moderate bullish

Time horizon: **3–6 months**

---

**LI4 — VIX Complacency / Stress** (`^VIX vs 60-day average`)

Low VIX relative to its own recent history signals complacency — a contrarian bearish indicator. Very high VIX relative to recent history signals acute stress building.

```
ratio = VIX / SMA(VIX, 60 days)

< 0.70 → strong bearish (extreme complacency, volatility spike imminent)
< 0.80 → moderate bearish (complacency building)
> 1.40 → strong bearish (acute stress regime)
> 1.20 → moderate bearish (elevated stress)
```

Time horizon: **1–4 weeks**

---

**LI5 — Sector Rotation: Tech vs Defensives** (`XLK / XLU`, 2-month change)

Technology (growth-sensitive, long-duration earnings) outperforming Utilities (defensive, stable cash flows) is a risk-on signal. The reverse rotation signals investors are defensively repositioning.

- XLK/XLU ratio rising >+4% → bullish: risk appetite, growth expectations
- XLK/XLU ratio falling <−4% → bearish: defensive rotation, slowdown anticipated

Time horizon: **1–3 months**

---

**LI6 — Emerging Markets vs Developed Markets** (`EEM / SPY`, 2-month change)

EM equities are highly sensitive to USD strength and global growth. EM underperformance often precedes DM stress as capital flows reverse.

- EEM/SPY rising >+3% → bullish: global recovery, USD weakness, commodity demand
- EEM/SPY falling <−3% → bearish: USD strength, global growth concerns, EM outflows

Time horizon: **1–3 months**

---

**LI7 — Credit Spread Velocity** (`HYG vs LQD`, 1M vs 3M acceleration)

The rate of change of credit spreads often leads the level. Spreads widening faster recently than their trailing average signals accelerating stress — even if the absolute level looks manageable.

```
spd1M = HYG 1M return − LQD 1M return
spd3M = HYG 3M return − LQD 3M return
velocity = spd1M − spd3M

> +1.5% → bullish (credit loosening faster recently)
< −1.5% → bearish (credit tightening accelerating)
```

Time horizon: **1–4 weeks**

---

**LI8 — Equity Momentum Shift** (`SPY`, 1M vs 3M annualised acceleration)

```
mom = (SPY 1M return × 12) − (SPY 3M return × 4)

> +10% annualised → bullish (short-term exceeding medium-term, accelerating)
< −10% annualised → bearish (momentum decelerating, growth impulse fading)
```

Momentum deceleration is a leading indicator of trend change even when absolute returns are still positive.

Time horizon: **1–3 months**

---

**LI9 — Dollar Momentum** (`UUP`, 1M vs 3M annualised acceleration)

Dollar acceleration (1M annualised rate exceeding 3M) signals tightening global liquidity conditions — bearish for risk assets, EM, and commodities.

```
dolMom = (UUP 1M × 12) − (UUP 3M × 4)

> +8% annualised → bearish (dollar accelerating = global liquidity tightening)
< −8% annualised → bullish (dollar decelerating = global liquidity improving)
```

Time horizon: **1–3 months**

---

**LI10 — Duration Preference: Short vs Long Treasury** (`SHY / TLT`, 2-month change)

When investors move from short-duration to long-duration bonds, they are pricing in significant rate cuts — a growth deterioration signal. The SHY/TLT ratio falling means TLT (long duration) is outperforming.

```
ratio = SHY / TLT (today vs 2 months ago)

falling <−3% → bearish (flight to long duration = growth slowdown priced)
rising >+3%  → bullish (short duration preferred = inflation/growth rising, steepening curve)
```

Time horizon: **3–6 months**

---

### Predicted Next Regime

The most likely next regime is derived from the current regime and the direction of business cycle momentum:

```
threshold T = 0.04

From GOLDILOCKS:
  inflationMom > T && growthMom > T  → REFLATION
  growthMom < −T  && inflationMom < −T → RECESSION
  growthMom < −T  && inflationMom > T  → STAGFLATION

From REFLATION:
  growthMom < −T  && inflationMom > T  → STAGFLATION
  growthMom < −T  && inflationMom < −T → RECESSION
  inflationMom < −T && growthMom > T   → GOLDILOCKS

From STAGFLATION:
  inflationMom < −T && growthMom < −T → RECESSION
  growthMom > T   && inflationMom > T → REFLATION
  inflationMom < −T && growthMom > T  → GOLDILOCKS

From RECESSION:
  growthMom > T   && inflationMom < −T → GOLDILOCKS
  growthMom > T   && inflationMom > T  → REFLATION
  inflationMom > T && growthMom < −T   → STAGFLATION
```

If no momentum threshold is crossed, returns `null` (regime likely stable for now).

---

## Cross-Framework Consensus

Each of the six outputs (5 frameworks + transition risk) votes risk-on or risk-off:

| Framework | Risk-On | Risk-Off |
|-----------|---------|---------|
| Bridgewater | GOLDILOCKS or REFLATION | STAGFLATION, RECESSION, RISK_OFF_SPIKE |
| Business Cycle | RECOVERY or EXPANSION | SLOWDOWN or CONTRACTION |
| Volatility | LOW or NORMAL | HIGH or CRISIS (ELEVATED = neutral) |
| Liquidity | AMPLE | TIGHTENING or STRESS |
| Credit Cycle | EXPANSION or STABLE | WIDENING or STRESS |
| Transition Risk | LOW | ELEVATED or HIGH |

```
riskBiasScore = riskOnVotes / 6

risk-on  = score ≥ 0.60   (4+ of 6 frameworks)
balanced = score 0.41–0.59 (mixed)
risk-off = score ≤ 0.40   (≤ 2 of 6 frameworks risk-on)

conviction = |score − 0.5| × 2   (0 = perfectly split, 1 = unanimous)
```

---

## Regime Stability (Confirmation Logic)

A single detection can be noise. The store applies a confirmation filter using a rolling history of the last 5 detections, requiring 3 consecutive identical readings before the **confirmed regime** updates.

```typescript
const history = [...prev, currentRegime].slice(-5);
const lastThree = history.slice(-3);

confirmedRegime =
  lastThree.length === 3 && lastThree.every(r => r === currentRegime)
    ? currentRegime
    : (prev_confirmedRegime === 'UNKNOWN' ? currentRegime : prev_confirmedRegime);
```

This means:
- On first run: confirmed immediately (fallback from UNKNOWN)
- On subsequent runs: requires 3 consecutive identical detections to confirm a new regime
- Prevents whipsawing between GOLDILOCKS and REFLATION on borderline signals

The confirmed regime is what drives the portfolio alignment targets.

---

## Portfolio Alignment

The Regime page compares the user's current portfolio allocation (from their holdings) against the suggested target allocation for the active Bridgewater regime.

**Gap calculation:**
```
gap = current% − target%
```

| Gap | Action Shown |
|-----|-------------|
| ≥ 5% | "Reduce by X%" (overweight) |
| 2–4% | "Minor drift" |
| < 2% | "On target" ✓ |
| < −5% | "Increase by X%" (underweight) |

The portfolio target allocations are suggestions only, based on historical asset class performance in each macro regime. They do not account for individual tax situations, time horizons, or risk tolerance.

---

## Regime Classification Summary

| Regime | Growth | Inflation | VIX | Key Assets |
|--------|--------|-----------|-----|-----------|
| GOLDILOCKS | ↑ | ↓ | Low/Normal | Equities, REITs |
| REFLATION | ↑ | ↑ | Normal | Equities (cyclicals), Commodities, TIPS |
| STAGFLATION | ↓ | ↑ | Elevated | Cash, Commodities (energy), short duration |
| RECESSION | ↓ | ↓ | High | Long-duration bonds, Gold, Cash |
| RISK_OFF_SPIKE | — | — | > 30 | Cash, short-term bonds |

---

## Limitations and Proxies

### What is proxied (not direct data)

| Concept | What we'd ideally use | What we use instead | Why |
|---------|----------------------|---------------------|-----|
| Bond market volatility | MOVE Index | TLT 21-day realized vol | MOVE not on Yahoo Finance |
| PMI / ISM | Survey data (ISM Manufacturing) | SPY + IWM momentum | Economic surveys are proprietary / delayed |
| Real GDP growth | BEA quarterly data | SPY, IWM price momentum | GDP is quarterly and lagged |
| M2 money supply | Federal Reserve H.6 release | IRX yield + LQD price | M2 released with 2+ week lag |
| SLOOS (credit standards) | Fed Senior Loan Officer Survey | HYG/LQD quality spread | SLOOS is quarterly |
| Copper futures | CME copper front-month | CPER (copper ETF) | Futures data requires commercial API |

### What is genuinely real-time

- All 17 ticker price series (live from Yahoo Finance)
- VIX (real options-implied volatility, live)
- Treasury yields ^TNX and ^IRX (live)
- All ETF prices and their derived signals

### Caveats

1. **ETF price momentum ≠ economic fundamentals.** The Business Cycle framework uses SPY/IWM/TIP/GSG price returns as economic proxies. This means the model can be driven by market expectations and sentiment rather than actual economic data.

2. **6-month history limitation.** With only ~126 days of data, signals requiring longer windows (e.g. 126-day SMA) are computed on the full available history. For fresh data, this is exact. Data older than 6 months is not available in the current fetch.

3. **VIX crisis override.** When VIX > 30, the Bridgewater quadrant result is overridden regardless of growth/inflation signals. This is intentional — in acute crises, correlations break down and the quadrant model becomes unreliable.

4. **Regime confirmation lag.** The 3-detection confirmation logic means the confirmed regime can lag the raw detection by 2–3 fetch cycles. This is a deliberate stability trade-off.

5. **No intraday data.** All signals use daily closing prices. Intraday moves on the detection day are not reflected until the next calendar day.

6. **Yahoo Finance reliability.** Data is fetched from an unofficial Yahoo Finance endpoint (v8 chart API). This has no SLA and may be rate-limited or changed without notice. The app degrades gracefully — any ticker returning no data is excluded from signal computation rather than causing a hard failure.
