# Metals Dashboard

Real-time dashboard tracking the price evolution of top metals compared to gold.

## Metals Tracked

| Metal | Yahoo Finance Symbol |
|-------|---------------------|
| Gold (baseline) | GC=F |
| Silver | SI=F |
| Platinum | PL=F |
| Palladium | PA=F |
| Copper | HG=F |
| Aluminum | ALI=F |

## Features

- **24h / 1 Week toggle** — switch between 5-minute and 1-hour interval charts
- **Price cards** — current price, % change, and gold ratio for each metal
- **% Change chart** — normalized price evolution so all metals are comparable on one chart
- **Gold Ratio chart** — tracks how each metal's price relates to gold over time
- **Auto-refresh** every 5 minutes with server-side caching
- Dark theme, responsive layout

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3457` in your browser.

Set a custom port with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/JS + Chart.js
- **Data source:** Yahoo Finance (no API key required)

## License

MIT
