export default function CompanyTable({ companies, onSelect, selected, csvUrl }) {
  const fmt    = (n, d=2) => n != null ? Number(n).toFixed(d) : '—'
  const fmtCap = v => {
    if (!v) return '—'
    if (v >= 1e12) return `$${(v/1e12).toFixed(1)}T`
    if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`
    return `$${(v/1e6).toFixed(0)}M`
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="chart-label">Empresas seleccionadas</p>
          <p className="chart-title" style={{ fontSize:18 }}>Top 10 · más activas</p>
        </div>
        <a href={csvUrl} download className="btn-csv">↓ Descargar CSV</a>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {['Ticker','Empresa','Precio','Cambio %','Sector','P/E','Cap. Mkt','Beta','Score'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map(c => {
              const up = (c.change_pct_num ?? 0) >= 0
              return (
                <tr key={c.ticker} onClick={() => onSelect(c.ticker)}
                  className={selected === c.ticker ? 'selected' : ''}>
                  <td><span className="ticker-cell">{c.ticker}</span></td>
                  <td><span className="name-cell" title={c.name}>{c.name}</span></td>
                  <td><span className="mono-cell">${fmt(c.price)}</span></td>
                  <td><span className={up ? 'up-cell' : 'dn-cell'}>{up?'+':''}{fmt(c.change_pct_num)}%</span></td>
                  <td><span className="sector-cell">{c.sector ?? '—'}</span></td>
                  <td><span className="mono-cell">{fmt(c.pe_ratio,1)}</span></td>
                  <td><span className="mono-cell">{fmtCap(c.market_cap)}</span></td>
                  <td><span className="mono-cell">{fmt(c.beta,2)}</span></td>
                  <td>
                    <div className="score-wrap">
                      <div className="score-track">
                        <div className="score-fill"
                          style={{ width:`${Math.min(100,(c.indicator_score/10)*100)}%` }} />
                      </div>
                      <span className="score-num">{fmt(c.indicator_score,1)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
