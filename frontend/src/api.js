import axios from "axios";

const BASE = "http://localhost:8000";

export const api = {
  getCompanies:  ()             => axios.get(`${BASE}/companies`),
  getPrices:     (ticker, period) => axios.get(`${BASE}/prices/${ticker}`, { params: { period } }),
  getComparison: (period)       => axios.get(`${BASE}/compare`, { params: { period } }),
  refresh:       ()             => axios.post(`${BASE}/refresh`),
  csvUrl:        ()             => `${BASE}/export-csv`,
};
