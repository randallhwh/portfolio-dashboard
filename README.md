# Portfolio Dashboard

A personal investment portfolio dashboard built with React, TypeScript, and Vite. Tracks holdings across multiple currencies, detects macro market regimes in real time, surfaces behavioral bias alerts, and shows analytics.

## Features

- **Holdings** — multi-currency portfolio tracker with live prices from Yahoo Finance
- **Market Regime Detection** — 5 independent macro frameworks + 10 leading indicators for regime transition risk (see [docs/regime-model.md](docs/regime-model.md))
- **Bias Alerts** — disposition effect, recency bias, home country bias, and concentration warnings
- **Analytics** — portfolio value over time, return attribution, drawdown
- **Returns** — period returns and benchmark comparison

## Regime Detection

The regime engine classifies the current macro environment across five frameworks:

1. **Bridgewater Growth/Inflation Quadrant** — GOLDILOCKS / REFLATION / STAGFLATION / RECESSION
2. **Business Cycle Clock** — RECOVERY / EXPANSION / SLOWDOWN / CONTRACTION
3. **Volatility Regime** — LOW / NORMAL / ELEVATED / HIGH / CRISIS
4. **Liquidity Regime** — AMPLE / NEUTRAL / TIGHTENING / STRESS
5. **Credit Cycle** — EXPANSION / STABLE / WIDENING / STRESS

Plus a **Transition Risk Score** (0–100) using 10 leading indicators that anticipate regime shifts before they fully develop.

Full technical documentation: [docs/regime-model.md](docs/regime-model.md)

## Tech Stack

- React 18 + TypeScript
- Vite (with Yahoo Finance proxy to avoid CORS)
- Tailwind CSS v4
- Zustand (with `persist` middleware)
- Lucide React icons

## Running Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`. The Vite dev proxy forwards `/yf/*` requests to Yahoo Finance to avoid CORS issues — no API key required.

## Data Sources

All market data is fetched live from Yahoo Finance (unofficial v8 chart API). No API key required in development. See [docs/regime-model.md#limitations-and-proxies](docs/regime-model.md#limitations-and-proxies) for a full breakdown of what is real vs. proxied.

Portfolio history (the analytics chart) is simulated from purchase dates using a growth curve — there is no brokerage API integration.
