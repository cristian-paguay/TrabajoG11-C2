import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d  = payload[0]?.payload
  if (!d) return null
  const up = (d.pct_change ?? 0) >= 0
  return (
    <div style={{ background:'#12121a', border:'1px solid #2a2a3f', borderRadius:8, padding:'8px 12px' }}>
      <p className="mono" style={{ fontSize:10, color:'#6060a0', marginBottom:2 }}>{d.ticker}</p>
      <p className="mono" style={{ fontSize:13, fontWeight:600, color: up ? '#00e5b0' : '#ff4455' }}>
        {up ? '+' : ''}{(d.pct_change ?? 0).toFixed(2)}%
      </p>
      <p className="mono" style={{ fontSize:10, color:'#4a4a6a', marginTop:2 }}>
        ${d.start_price ?? '—'} → ${d.end_price ?? '—'}
      </p>
    </div>
  )
}

export default function CompareChart({ data = [], period }) {
  const safe   = Array.isArray(data) ? data : []
  const sorted = [...safe].sort((a, b) => (b.pct_change ?? 0) - (a.pct_change ?? 0))

  if (!sorted.length) return (
    <div className="card card-pad">
      <div className="chart-head">
        <div>
          <p className="chart-label">Comparación</p>
          <p className="chart-title">Cambio % · {period}</p>
        </div>
      </div>
      <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p className="mono" style={{ fontSize:12, color:'#3a3a5a' }}>Sin datos</p>
      </div>
    </div>
  )

  return (
    <div className="card card-pad">
      <div className="chart-head">
        <div>
          <p className="chart-label">Comparación</p>
          <p className="chart-title">Cambio % · {period}</p>
        </div>
        <span className="badge neu mono" style={{ fontSize:11 }}>{sorted.length} empresas</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={sorted} margin={{ top:4, right:4, bottom:0, left:-15 }}>
          <XAxis dataKey="ticker" tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
            tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize:10, fill:'#4a4a6a', fontFamily:'DM Mono' }}
            tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#2a2a3f" strokeWidth={1} />
          <Bar dataKey="pct_change" radius={[3,3,0,0]} maxBarSize={28}>
            {sorted.map((e, i) => (
              <Cell key={i} fill={(e.pct_change ?? 0) >= 0 ? '#00e5b0' : '#ff4455'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
