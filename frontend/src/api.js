import axios from 'axios'

const BASE = '/api'   // proxied via Vite to http://localhost:8000

export const api = {
  getCompanies:  ()                    => axios.get(`${BASE}/companies`),
  getPrices:     (ticker, period, iv)  => axios.get(`${BASE}/prices/${ticker}`, { params: { period, interval: iv } }),
  getComparison: (period)              => axios.get(`${BASE}/compare`, { params: { period } }),
  refresh:       ()                    => axios.post(`${BASE}/refresh`),
  health:        ()                    => axios.get(`${BASE}/health`),
  csvUrl:        ()                    => `${BASE}/export-csv`,
}
