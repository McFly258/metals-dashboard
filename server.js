import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3457;

const METALS = [
  { name: 'gold',      symbol: 'GC=F',  color: '#FFD700', label: 'Gold' },
  { name: 'silver',    symbol: 'SI=F',  color: '#C0C0C0', label: 'Silver' },
  { name: 'platinum',  symbol: 'PL=F',  color: '#E8E8E8', label: 'Platinum' },
  { name: 'palladium', symbol: 'PA=F',  color: '#9BB7D4', label: 'Palladium' },
  { name: 'copper',    symbol: 'HG=F',  color: '#B87333', label: 'Copper' },
  { name: 'aluminum',  symbol: 'ALI=F', color: '#72777A', label: 'Aluminum' },
];

app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Cache to avoid hammering Yahoo Finance
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchYahoo(symbol, range, interval) {
  const key = `${symbol}:${range}`;
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) {
    return cache[key].data;
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) throw new Error(`Yahoo returned ${resp.status} for ${symbol}`);
  const json = await resp.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  const timestamps = result.timestamp.map(t => t * 1000);
  const closes = result.indicators.quote[0].close;
  const currency = result.meta?.currency || 'USD';
  const currentPrice = result.meta?.regularMarketPrice ?? closes.filter(Boolean).at(-1);

  const data = { timestamps, closes, currency, currentPrice };
  cache[key] = { ts: now, data };
  return data;
}

app.get('/api/prices', async (req, res) => {
  const range = req.query.range === '1wk' ? '5d' : '1d';
  const interval = range === '5d' ? '1h' : '5m';

  const results = {};

  await Promise.all(METALS.map(async (metal) => {
    try {
      const data = await fetchYahoo(metal.symbol, range, interval);
      results[metal.name] = {
        label: metal.label,
        color: metal.color,
        timestamps: data.timestamps,
        closes: data.closes,
        currency: data.currency,
        currentPrice: data.currentPrice,
      };
    } catch (err) {
      console.error(`Failed to fetch ${metal.name}: ${err.message}`);
      results[metal.name] = null;
    }
  }));

  res.json({ range, metals: METALS.map(m => m.name), data: results });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Metals dashboard → http://localhost:${PORT}`);
});
