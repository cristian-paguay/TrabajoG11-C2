export default function CompanyTable({ companies, onSelect, selected, csvUrl }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-500">Top 10 companies</h3>
        
          href={csvUrl}
          download
          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-100 transition"
        >
          ↓ Download CSV
        </a>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
            {["Ticker","Name","Price","Chg%","Sector","P/E","Score"].map(h => (
              <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map(c => (
            <tr
              key={c.ticker}
              onClick={() => onSelect(c.ticker)}
              className={`cursor-pointer border-b border-gray-50 hover:bg-indigo-50 transition ${
                selected === c.ticker ? "bg-indigo-50" : ""
              }`}
            >
              <td className="px-4 py-2 font-mono font-medium text-indigo-600">{c.ticker}</td>
              <td className="px-4 py-2 text-gray-700 truncate max-w-[140px]">{c.name}</td>
              <td className="px-4 py-2">${c.price?.toFixed(2)}</td>
              <td className={`px-4 py-2 font-medium ${c.change_pct_num >= 0 ? "text-green-600" : "text-red-500"}`}>
                {c.change_pct}
              </td>
              <td className="px-4 py-2 text-gray-500 text-xs">{c.sector}</td>
              <td className="px-4 py-2 text-gray-500">{c.pe_ratio?.toFixed(1) ?? "—"}</td>
              <td className="px-4 py-2 text-gray-400">{c.indicator_score?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
