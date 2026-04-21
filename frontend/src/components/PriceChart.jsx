import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{ background:'#12121a', border:'1px solid #2a2a3f', borderRadius:8, padding:'8px 12px' }}>
      <p className="mono" style={{ fontSize:10, color:'#6060a0', marginBottom:2 }}>{label}</p>
      <p className="mono" style={{ fontSize:13, color:'#00e5b0', fontWeight:600 }}>
        {val != null ? `$${Number(val).toFixed(2)}` : '—'}
      </p>
    </div>
  )
}

// Takes any date string and returns only YYYY-MM-DD
const parseDate = (raw) => {
  if (!raw) return ''
  // handles "2024-03-18 00:00:00+00:00", "2024-03-18T00:00:00", "2024-03-18"
  return String(raw).slice(0, 10)
}

// Format for X axis label: "Mar 18"
const formatLabel = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return dateStr.slice(5) // fallback: MM-DD
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

export default function PriceChart({ ticker, period }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setErr(null)
    api.getPrices(ticker, period, '1d')
      .then(r => {
        const rows = Array.isArray(r.data) ? r.data : []
        // Normalise Date to YYYY-MM-DD on every row
        const clean = rows.map(row => ({
          ...row,
          Date: parseDate(row.Date)
        }))
        setData(clean)
      })
      .catch(e => setErr(e?.message ?? 'Error cargando precios'))
      .finally(() => setLoading(false))
  }, [ticker, period])

  const closes = data.map(d => d?.Close).filter(v => v != null && !isNaN(v))
  const min    = closes.length ? Math.min(...closes) * 0.998 : 'auto'
  const max    = closes.length ? Math.max(...closes) * 1.002 : 'auto'
  const pct    = closes.length > 1
    ? (((closes.at(-1) - closes[0]) / closes[0]) * 100).toFixed(2)
    : null
  const up     = pct !== null && Number(pct) >= 0
  const color  = up ? '#00e5b0' : '#ff4455'

  // Show ~6 ticks max regardless of period
  const tickInterval = Math.max(1, Math.floor(data.length / 6))

  return (
    <div className="card card-pad">
      <div className="chart-head">
        <div>
          <p className="chart-label">Precio de cierre</p>
          <p className="chart-title">{ticker || '—'}</p>
        </div>
        {pct !== null && (
          <span className={`badge ${up ? 'up' : 'dn'}`}>
            {up ? '+' : ''}{pct}%
          </span>
        )}
      </div>

      {loading && (
        <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <p className="mono" style={{ fontSize:12, color:'#3a3a5a' }}>Cargando...</p>
        </div>
      )}

      {!loading && err && (
        <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <p className="mono" style={{ fontSize:12, color:'#ff4455' }}>{err}</p>
        </div>
      )}

      {!loading && !err && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top:4, right:4, bottom:0, left:-10 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="#1a1a2e" vertical={false} />
            <XAxis
              dataKey="Date"
              tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatLabel}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
              tickLine={false} axisLine={false} domain={[min, max]}
              tickFormatter={v => `$${Number(v).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="Close" stroke={color} strokeWidth={2}
              dot={false} activeDot={{ r:4, fill:color }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
