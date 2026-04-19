import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#12121a', border:'1px solid #2a2a3f', borderRadius:8, padding:'8px 12px' }}>
      <p className="mono" style={{ fontSize:10, color:'#6060a0', marginBottom:2 }}>{label}</p>
      <p className="mono" style={{ fontSize:13, color:'#00e5b0', fontWeight:600 }}>
        ${payload[0].value?.toFixed(2)}
      </p>
    </div>
  )
}

export default function PriceChart({ ticker, period }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    api.getPrices(ticker, period, '1d')
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [ticker, period])

  const closes = data.map(d => d.Close).filter(Boolean)
  const min  = closes.length ? Math.min(...closes) * 0.998 : 'auto'
  const max  = closes.length ? Math.max(...closes) * 1.002 : 'auto'
  const pct  = closes.length > 1
    ? (((closes.at(-1) - closes[0]) / closes[0]) * 100).toFixed(2)
    : null
  const up   = pct !== null && pct >= 0
  const color = up ? '#00e5b0' : '#ff4455'

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

      {loading ? (
        <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <p className="mono" style={{ fontSize:12, color:'#3a3a5a' }}>Cargando...</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top:4, right:4, bottom:0, left:-10 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="#1a1a2e" vertical={false} />
            <XAxis dataKey="Date" tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
              tickLine={false} axisLine={false}
              tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
              tickLine={false} axisLine={false} domain={[min, max]}
              tickFormatter={v => `$${v.toFixed(0)}`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="Close" stroke={color} strokeWidth={2}
              dot={false} activeDot={{ r:4, fill:color }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
