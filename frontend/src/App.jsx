import { useEffect, useState } from "react";
import { api } from "./api";
import CompanyTable from "./components/CompanyTable";
import PriceChart from "./components/PriceChart";
import CompareChart from "./components/CompareChart";

const PERIODS = ["5d", "1mo", "3mo", "6mo", "1y"];

export default function App() {
  const [companies, setCompanies]   = useState([]);
  const [comparison, setComparison] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [period, setPeriod]         = useState("1mo");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, cmp] = await Promise.all([
      api.getCompanies(),
      api.getComparison(period),
    ]);
    setCompanies(c.data);
    setComparison(cmp.data);
    if (!selected && c.data.length) setSelected(c.data[0].ticker);
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await api.refresh();
    await load();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Financial Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Top 10 most active · powered by yfinance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg border border-gray-200 p-0.5 gap-0.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-sm transition ${
                    period === p
                      ? "bg-indigo-600 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "↺ Refresh"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading data…</div>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-2 gap-4">
              <PriceChart ticker={selected} period={period} />
              <CompareChart data={comparison} />
            </div>

            {/* Company table */}
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
  );
}
