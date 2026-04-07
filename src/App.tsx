import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type MetalData = {
  label: string
  color: string
  timestamps: number[]
  closes: (number | null)[]
  currency: string
  currentPrice: number
}

type ApiResponse = {
  range: string
  metals: string[]
  data: Record<string, MetalData | null>
}

type PricePoint = {
  time: string
  timestamp: number
  [key: string]: string | number | null
}

type RatioPoint = {
  time: string
  timestamp: number
  [key: string]: string | number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METAL_COLORS: Record<string, string> = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  platinum: '#E8E8E8',
  palladium: '#9BB7D4',
  copper: '#B87333',
  aluminum: '#72777A',
}

const METAL_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
  copper: 'Copper',
  aluminum: 'Aluminum',
}

const REFRESH_INTERVAL = 5 * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number, range: string): string {
  const d = new Date(ts)
  if (range === '1d') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatPrice(price: number | undefined | null): string {
  if (price == null) return 'N/A'
  return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatUpdatedAt(): string {
  return new Date().toLocaleTimeString()
}

// ─── Data builders ────────────────────────────────────────────────────────────

function buildPriceChartData(data: Record<string, MetalData | null>, metals: string[], range: string): PricePoint[] {
  const allTimestamps = new Set<number>()
  const firstValid: Record<string, number> = {}

  for (const name of metals) {
    const d = data[name]
    if (!d) continue
    for (let i = 0; i < d.timestamps.length; i++) {
      if (d.closes[i] != null) {
        allTimestamps.add(d.timestamps[i])
        if (!(name in firstValid)) firstValid[name] = d.closes[i]!
      }
    }
  }

  const sorted = [...allTimestamps].sort((a, b) => a - b)
  return sorted.map((ts) => {
    const point: PricePoint = {
      time: formatTime(ts, range),
      timestamp: ts,
    }
    for (const name of metals) {
      const d = data[name]
      if (!d) continue
      const idx = d.timestamps.indexOf(ts)
      if (idx !== -1 && d.closes[idx] != null && firstValid[name]) {
        point[name] = ((d.closes[idx]! - firstValid[name]) / firstValid[name]) * 100
      } else {
        point[name] = null
      }
    }
    return point
  })
}

function buildRatioChartData(data: Record<string, MetalData | null>, metals: string[], range: string): RatioPoint[] {
  const goldD = data.gold
  if (!goldD) return []

  const allTimestamps = new Set<number>()
  for (const name of metals) {
    if (name === 'gold') continue
    const d = data[name]
    if (!d) continue
    for (let i = 0; i < d.timestamps.length; i++) {
      if (d.closes[i] != null) allTimestamps.add(d.timestamps[i])
    }
  }

  const sorted = [...allTimestamps].sort((a, b) => a - b)
  return sorted.map((ts) => {
    const point: RatioPoint = {
      time: formatTime(ts, range),
      timestamp: ts,
    }

    const goldIdx = goldD.timestamps.findIndex((t, gi) => t >= ts && goldD.closes[gi] != null)
    if (goldIdx === -1) return point

    for (const name of metals) {
      if (name === 'gold') continue
      const d = data[name]
      if (!d) continue
      const idx = d.timestamps.indexOf(ts)
      if (idx !== -1 && d.closes[idx] != null) {
        point[name] = goldD.closes[goldIdx]! / d.closes[idx]!
      } else {
        point[name] = null
      }
    }
    return point
  })
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [range, setRange] = useState<'1d' | '1wk'>('1d')
  const [apiData, setApiData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const resp = await fetch(`/api/prices?range=${range}`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json: ApiResponse = await resp.json()
        if (!cancelled) {
          setApiData(json)
          setUpdatedAt(formatUpdatedAt())
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const interval = window.setInterval(() => void load(), REFRESH_INTERVAL)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [range])

  const metals = apiData?.metals ?? []
  const data = apiData?.data ?? {}

  const priceChartData = useMemo(
    () => apiData ? buildPriceChartData(data, metals, range) : [],
    [apiData, data, metals, range],
  )

  const ratioChartData = useMemo(
    () => apiData ? buildRatioChartData(data, metals, range) : [],
    [apiData, data, metals, range],
  )

  return (
    <main className="app-shell">
      {/* ── Header ── */}
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Precious metals tracker</p>
          <h1>Metals vs Gold</h1>
          <p className="hero-copy">
            Live price comparison across six commodity metals with % change charts and gold ratio tracking.
          </p>
        </div>
        <div className="hero-meta">
          <button className="refresh-button" onClick={() => window.location.reload()}>
            Refresh now
          </button>
          <span>{updatedAt ? `Updated ${updatedAt}` : 'Loading live data…'}</span>
        </div>
      </header>

      {error && <section className="error-banner">{error}</section>}

      {/* ── Range tabs ── */}
      <section className="controls-panel">
        <div className="tabs">
          <button
            className={`tab ${range === '1d' ? 'active' : ''}`}
            onClick={() => setRange('1d')}
          >
            24 Hours
          </button>
          <button
            className={`tab ${range === '1wk' ? 'active' : ''}`}
            onClick={() => setRange('1wk')}
          >
            1 Week
          </button>
        </div>
        <span className="helper-text">Auto-refreshes every 5 minutes.</span>
      </section>

      {/* ── Price cards ── */}
      <section className="stat-grid">
        {loading && !apiData ? (
          <div className="empty-state">Loading prices…</div>
        ) : (
          metals.map((name) => {
            const d = data[name]
            if (!d) return null

            const closes = d.closes.filter((c): c is number => c != null)
            const first = closes[0]
            const last = closes.at(-1)
            const pctChange = first && last ? (((last - first) / first) * 100) : null
            const changeClass = pctChange != null ? (pctChange > 0 ? 'positive' : pctChange < 0 ? 'negative' : '') : ''

            const goldData = data.gold
            let ratio: string | null = null
            if (goldData && name !== 'gold' && goldData.currentPrice && d.currentPrice) {
              const r = goldData.currentPrice / d.currentPrice
              ratio = (name === 'copper' || name === 'aluminum') ? r.toFixed(0) : r.toFixed(2)
            }

            return (
              <article key={name} className="stat-card" style={{ borderLeftColor: d.color }}>
                <span className="stat-label" style={{ color: d.color }}>{d.label}</span>
                <strong className="stat-price" style={{ color: d.color }}>
                  {formatPrice(d.currentPrice)}
                </strong>
                {ratio && <small className="stat-ratio">1 oz Au = {ratio} oz</small>}
                {pctChange != null && (
                  <small className={`stat-change ${changeClass}`}>
                    {pctChange > 0 ? '+' : ''}{pctChange.toFixed(2)}%
                  </small>
                )}
              </article>
            )
          })
        )}
      </section>

      {/* ── Price evolution chart ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Price Evolution (% change from period start)</h2>
            <p>All metals shown as % change — normalized to compare across different price scales</p>
          </div>
        </div>
        <div className="chart-wrap">
          {loading && !apiData ? (
            <div className="empty-state">Loading chart…</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={priceChartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#1e2130" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#666', fontSize: 12 }}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#666', fontSize: 12 }}
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1d2e',
                    border: '1px solid #2a2d3e',
                    borderRadius: 8,
                    color: '#e0e0e0',
                  }}
                  formatter={(value, name) => {
                    if (typeof value !== 'number') return ['—', String(name)]
                    return [`${value.toFixed(3)}%`, METAL_LABELS[String(name)] ?? String(name)]
                  }}
                />
                <Legend
                  formatter={(value: string) => METAL_LABELS[value] ?? value}
                  wrapperStyle={{ color: '#aaa' }}
                />
                {/* Gold gets a filled area */}
                <Area
                  type="monotone"
                  dataKey="gold"
                  stroke={METAL_COLORS.gold}
                  fill={METAL_COLORS.gold + '18'}
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
                {metals.filter((m) => m !== 'gold').map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={METAL_COLORS[name]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Ratio chart ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Ratio to Gold (oz metal / oz gold)</h2>
            <p>How many ounces of each metal equal 1 oz of gold — lower = more expensive relative to gold</p>
          </div>
        </div>
        <div className="chart-wrap">
          {loading && !apiData ? (
            <div className="empty-state">Loading chart…</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={ratioChartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#1e2130" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#666', fontSize: 12 }}
                  minTickGap={40}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#666', fontSize: 12 }}
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1d2e',
                    border: '1px solid #2a2d3e',
                    borderRadius: 8,
                    color: '#e0e0e0',
                  }}
                  formatter={(value, name) => {
                    if (typeof value !== 'number') return ['—', String(name)]
                    return [`${value.toFixed(4)} oz per oz gold`, METAL_LABELS[String(name)] ?? String(name)]
                  }}
                />
                <Legend
                  formatter={(value: string) => METAL_LABELS[value] ?? value}
                  wrapperStyle={{ color: '#aaa' }}
                />
                {metals.filter((m) => m !== 'gold').map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={METAL_COLORS[name]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
