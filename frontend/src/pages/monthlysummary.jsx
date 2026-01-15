

// MonthlySummaryPage.jsx

import React, { useEffect, useState, useMemo } from "react";

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

export default function MonthlySummaryPage({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const loadMonthlySummary = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/dpr/monthly-summary?year=${year}&month=${month}`;
      const res = await fetch(url, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      setSummaryData(data);
    } catch (err) {
      console.error("Monthly summary load failed", err);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlySummary();
  }, [year, month, authHeader]);

  const v = (value, decimals = 2) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    return Number(value).toFixed(decimals);
  };

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-[95%] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold">
                2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA
              </h1>
              <p className="text-sm mt-1">
                PLANT PERFORMANCE REPORT FOR THE DATE - Monthly Summary
              </p>
              <p className="text-xs mt-1">
                From 01-04-2025 To 23-11-2025 (00:00 hr to 23:59)
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="px-3 py-2 text-sm border-2 border-white rounded bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2025, i).toLocaleDateString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="px-3 py-2 text-sm border-2 border-white rounded bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {Array.from({ length: 10 }, (_, i) => 2020 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                onClick={loadMonthlySummary}
                disabled={loading}
                className="px-4 py-2 bg-white text-indigo-600 rounded font-semibold text-sm hover:bg-indigo-50 disabled:opacity-60 transition-all shadow-md border-2 border-white"
              >
                {loading ? "⏳ Loading…" : "🔄 Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Summary Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading monthly summary...</p>
          </div>
        ) : summaryData ? (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th
                    rowSpan="2"
                    className="bg-gray-700 text-white py-3 px-3 text-center font-semibold border border-gray-600"
                  >
                    Date
                  </th>
                  <th
                    colSpan="5"
                    className="bg-indigo-600 text-white py-3 px-3 font-semibold border border-indigo-500"
                  >
                    UNIT-1
                  </th>
                  <th
                    colSpan="5"
                    className="bg-indigo-600 text-white py-3 px-3 font-semibold border border-indigo-500"
                  >
                    UNIT-2
                  </th>
                  <th
                    colSpan="5"
                    className="bg-indigo-700 text-white py-3 px-3 font-semibold border border-indigo-600"
                  >
                    STATION
                  </th>
                </tr>
                <tr>
                  {["PAF %", "PLF %", "APC%", "SCC", "Run Hrs"].map((h) => (
                    <th
                      key={`u1-${h}`}
                      className="bg-indigo-500 text-white py-2 px-2 font-medium text-[10px] border border-indigo-400"
                    >
                      {h}
                    </th>
                  ))}
                  {["PAF %", "PLF %", "APC%", "SCC", "Run Hrs"].map((h) => (
                    <th
                      key={`u2-${h}`}
                      className="bg-indigo-500 text-white py-2 px-2 font-medium text-[10px] border border-indigo-400"
                    >
                      {h}
                    </th>
                  ))}
                  {["PAF %", "PLF %", "APC%", "SCC", "Run Hrs"].map((h) => (
                    <th
                      key={`st-${h}`}
                      className="bg-indigo-600 text-white py-2 px-2 font-medium text-[10px] border border-indigo-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {summaryData.daily_data.map((day, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 border-b border-gray-200">
                    <td className="py-2 px-3 text-center font-medium bg-gray-50 border border-gray-300">
                      {new Date(day.date).getDate()}-{monthName.substring(0, 3)}-{year.toString().substring(2)}
                    </td>

                    {/* Unit-1 */}
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-1"].paf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-1"].plf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-1"].apc_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-1"].scc, 3)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-1"].run_hrs, 2)}
                    </td>

                    {/* Unit-2 */}
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-2"].paf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-2"].plf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-2"].apc_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-2"].scc, 3)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums border border-gray-200">
                      {v(day["Unit-2"].run_hrs, 2)}
                    </td>

                    {/* Station */}
                    <td className="py-2 px-2 text-center font-semibold text-indigo-700 tabular-nums bg-indigo-50 border border-indigo-200">
                      {v(day["Station"].paf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-indigo-700 tabular-nums bg-indigo-50 border border-indigo-200">
                      {v(day["Station"].plf_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-indigo-700 tabular-nums bg-indigo-50 border border-indigo-200">
                      {v(day["Station"].apc_percent, 2)}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-indigo-700 tabular-nums bg-indigo-50 border border-indigo-200">
                      {v(day["Station"].scc, 3)}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-indigo-700 tabular-nums bg-indigo-50 border border-indigo-200">
                      {v(day["Station"].run_hrs, 2)}
                    </td>
                  </tr>
                ))}

                {/* Monthly Average/Sum Row */}
                <tr className="bg-yellow-100 font-bold border-t-2 border-yellow-600">
                  <td className="py-3 px-3 text-center">Mth Average / Sum</td>

                  {/* Unit-1 */}
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-1"].paf_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-1"].plf_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-1"].apc_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-1"].scc, 3)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-1"].run_hrs, 2)}</td>

                  {/* Unit-2 */}
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-2"].paf_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-2"].plf_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-2"].apc_percent, 2)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-2"].scc, 3)}</td>
                  <td className="py-3 px-2 text-center">{v(summaryData.monthly_average["Unit-2"].run_hrs, 2)}</td>

                  {/* Station */}
                  <td className="py-3 px-2 text-center text-indigo-800 bg-indigo-100">
                    {v(summaryData.monthly_average["Station"].paf_percent, 2)}
                  </td>
                  <td className="py-3 px-2 text-center text-indigo-800 bg-indigo-100">
                    {v(summaryData.monthly_average["Station"].plf_percent, 2)}
                  </td>
                  <td className="py-3 px-2 text-center text-indigo-800 bg-indigo-100">
                    {v(summaryData.monthly_average["Station"].apc_percent, 2)}
                  </td>
                  <td className="py-3 px-2 text-center text-indigo-800 bg-indigo-100">
                    {v(summaryData.monthly_average["Station"].scc, 3)}
                  </td>
                  <td className="py-3 px-2 text-center text-indigo-800 bg-indigo-100">
                    {v(summaryData.monthly_average["Station"].run_hrs, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}