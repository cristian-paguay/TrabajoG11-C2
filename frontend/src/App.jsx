import { useEffect, useState, useRef } from 'react'
import { api } from './api'
import CompanyTable from './components/CompanyTable'
import PriceChart   from './components/PriceChart'
import CompareChart from './components/CompareChart'

const PERIODS = ['5d', '1mo', '3mo', '6mo', '1y']

export default function App() {
  const [companies,  setCompanies]  = useState([])
  const [comparison, setComparison] = useState([])
  const [selected,   setSelected]   = useState(null)
  const [period,     setPeriod]     = useState('1mo')
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState(null)
  const [serverOk,   setServerOk]   = useState(null)

  // track whether the initial load already ran
  const initialized = useRef(false)

  const loadComparison = async (p) => {
    try {
      const cmp = await api.getComparison(p)
      setComparison(cmp.data)
    } catch {
      // non-fatal — chart just stays empty
    }
  }

  const loadAll = async (p) => {
    setLoading(true)
    setError(null)
    try {
      const c = await api.getCompanies()
      setCompanies(c.data)
      if (c.data.length) setSelected(prev => prev ?? c.data[0].ticker)
      await loadComparison(p)
    } catch {
      setError('No se pudo cargar los datos. Verifica que el backend esté corriendo en el puerto 8000.')
    } finally {
      setLoading(false)
    }
  }

  // runs once on mount — waits for health check first
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    api.health()
      .then(() => {
        setServerOk(true)
        loadAll(period)
      })
      .catch(() => {
        setServerOk(false)
        setLoading(false)
        setError('Servidor no disponible en http://localhost:8000')
      })
  }, [])

  // runs only when period changes AFTER initial load
  useEffect(() => {
    if (!initialized.current || !serverOk) return
    loadComparison(period)
  }, [period])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refresh()
      await loadAll(period)
    } catch {
      setError('Falló el refresco de datos.')
    } finally {
      setRefreshing(false)
    }
  }

  const handlePeriod = (p) => {
    setPeriod(p)
    // also reload price chart by updating selected ticker dependency
  }

  return (
    <div className="page">
      <div className="bg-grid" />
      <div className="container">

        {/* Header */}
        <div className="topbar">
          <div>
            <p className="page-sub">Financial Dashboard · yfinance + Yahoo Finance</p>
            <h1 className="page-title">
              Mercado <span style={{ color:'var(--accent)' }}>en vivo</span>
            </h1>
          </div>
          <div className="topbar-right">
            <div className="period-bar">
              {PERIODS.map(p => (
                <button key={p} className={`period-btn${period===p?' active':''}`}
                  onClick={() => handlePeriod(p)}>{p}</button>
              ))}
            </div>
            <button className="btn-refresh" onClick={handleRefresh}
              disabled={refreshing || loading}>
              <span className={refreshing ? 'spin' : ''}>↺</span>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span className={`status-pill${serverOk===true?' ok':serverOk===false?' err':''}`}>
            <span className="dot" />
            {serverOk===null ? 'Conectando...' : serverOk ? 'Backend conectado' : 'Backend desconectado'}
          </span>
          {companies.length > 0 && (
            <span className="mono" style={{ fontSize:11, color:'var(--dim)' }}>
              {companies.length} empresas · período {period}
            </span>
          )}
        </div>

        {/* Error */}
        {error && <div className="error-banner">{error}</div>}

        {/* Loading */}
        {loading && !error && (
          <div className="card loading-box">
            <p>Scrapeando y enriqueciendo datos...</p>
            <p>Puede tardar 20–40 segundos en el primer inicio</p>
          </div>
        )}

        {/* Main content — only shown when we have data and are not loading */}
        {!loading && !error && companies.length > 0 && (
          <>
            <div className="charts-grid">
              <PriceChart ticker={selected} period={period} />
              <CompareChart data={comparison} period={period} />
            </div>
            <CompanyTable
              companies={companies}
              onSelect={setSelected}
              selected={selected}
              csvUrl={api.csvUrl()}
            />
          </>
        )}
      </div>
    </div>
  )
}
