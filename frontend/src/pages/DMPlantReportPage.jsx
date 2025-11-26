// pages/DMPlantReportPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-t-transparent border-gray-600 rounded-full animate-spin"></div>
);

const SECTION_DEFINITIONS = [
  { unit: "Unit-1", section: "Condensate Water" },
  { unit: "Unit-1", section: "Drum Water" },
  { unit: "Unit-1", section: "Feed Water" },
  { unit: "Unit-1", section: "Hot Reheated Steam" },
  { unit: "Unit-1", section: "Saturated Steam" },
  { unit: "Unit-1", section: "Super Heated Steam" },

  { unit: "Unit-2", section: "Condensate Water" },
  { unit: "Unit-2", section: "Drum Water" },
  { unit: "Unit-2", section: "Feed Water" },
  { unit: "Unit-2", section: "Hot Reheated Steam" },
  { unit: "Unit-2", section: "Saturated Steam" },
  { unit: "Unit-2", section: "Super Heated Steam" },

  { unit: "Station", section: "Circulating Water" },
  { unit: "Coal", section: "Proximate Analysis" },
  { unit: "Coal", section: "Sieve Analysis" },
  { unit: "Coal", section: "Combustible Analysis" },

  { unit: "DM", section: "Tank Levels & Usage" },
  { unit: "Chem", section: "Chemical Consumption" },
  { unit: "Chem", section: "Chemical Stock" },
];

export default function DMPlantReportPage({ auth }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportStats, setReportStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Filters
  const units = [...new Set(SECTION_DEFINITIONS.map((s) => s.unit))];
  const [filterUnit, setFilterUnit] = useState("");
  const [filterSection, setFilterSection] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Raw cache + expanded rows
  const rawCache = useRef({});
  const [allRawData, setAllRawData] = useState({});
  const [rawLoading, setRawLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({}); // key -> bool

  // Expand all toggle
  const [expandAll, setExpandAll] = useState(false);

  const authHeader = useMemo(() => {
    if (!auth) return localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "";
    return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
  }, [auth]);

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: authHeader },
      }),
    [authHeader]
  );

  // Fetch summary stats
  const fetchReport = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await api.get("/dm-plant/report", { params: { date: reportDate } });
      setReportStats(res.data);
      rawCache.current = {};
      setExpandedRows({});
      setAllRawData({});
      setPage(1);
    } catch (e) {
      setMessage("⚠️ Could not fetch DM Plant report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportDate]);

  // Parse stats
  const parseStats = (statsObj) => {
    if (!statsObj || !statsObj.stats) return [];
    return Object.entries(statsObj.stats).map(([k, v]) => {
      const [unit, section, parameter] = k.split("|").map((s) => s.trim());
      return {
        unit,
        section,
        parameter,
        avg: v.avg ?? "-",
        min: v.min ?? "-",
        max: v.max ?? "-",
        count: v.count ?? 0,
      };
    });
  };

  const filteredRows = useMemo(() => {
    let rows = parseStats(reportStats);
    if (filterUnit) rows = rows.filter((r) => r.unit === filterUnit);
    if (filterSection) rows = rows.filter((r) => r.section === filterSection);
    return rows;
  }, [reportStats, filterUnit, filterSection]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const sectionsForSelectedUnit = filterUnit
    ? SECTION_DEFINITIONS.filter((s) => s.unit === filterUnit).map((s) => s.section)
    : [];

  // ---------- FETCH RAW DATA FOR ROW ----------
  const loadRawForRow = async (r) => {
    const key = `${r.unit}_${r.section}_${r.parameter}`;
    if (rawCache.current[key]) {
      setAllRawData((old) => ({ ...old, [key]: rawCache.current[key] }));
      return;
    }

    try {
      const res = await api.get("/dm-plant/raw", {
        params: {
          date: reportDate,
          unit: r.unit,
          section: r.section,
          parameter: r.parameter,
        },
      });

      rawCache.current[key] = res.data || [];
      setAllRawData((old) => ({ ...old, [key]: rawCache.current[key] }));
    } catch {
      rawCache.current[key] = [];
      setAllRawData((old) => ({ ...old, [key]: [] }));
    }
  };

  // ---------- EXPAND ONE ROW ----------
  const toggleExpandRow = async (r) => {
    const key = `${r.unit}_${r.section}_${r.parameter}`;
    const nowExpanded = !expandedRows[key];
    setExpandedRows((prev) => ({ ...prev, [key]: nowExpanded }));

    if (nowExpanded) await loadRawForRow(r);
  };

  // ---------- EXPAND ALL ----------
  const handleExpandAll = async () => {
    const newState = !expandAll;
    setExpandAll(newState);

    const newExpanded = {};
    for (const r of pagedRows) {
      const key = `${r.unit}_${r.section}_${r.parameter}`;
      newExpanded[key] = newState;
    }
    setExpandedRows(newExpanded);

    if (newState === true) {
      for (const r of pagedRows) {
        await loadRawForRow(r);
      }
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">DM Plant Report Viewer</h1>

      <button
  onClick={async () => {
    try {
      const token = localStorage.getItem("authToken");

      const res = await axios.get(
        `http://localhost:8080/api/dm-plant/report/pdf?date=${reportDate}`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          }
        }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `dm-plant-${reportDate}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("❌ PDF download failed");
      console.error(err);
    }
  }}
  className="px-3 py-2 bg-red-600 text-white rounded"
>
  Export PDF
</button>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="text-xs text-gray-600">Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="p-2 border rounded w-full"
          />
        </div>

        {/* Unit filter */}
        <div>
          <label className="text-xs text-gray-600">Unit</label>
          <select
            value={filterUnit}
            onChange={(e) => {
              setFilterUnit(e.target.value);
              setFilterSection("");
            }}
            className="p-2 border rounded w-full"
          >
            <option value="">All Units</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Section filter */}
        <div>
          <label className="text-xs text-gray-600">Section</label>
          <select
            value={filterSection}
            disabled={!filterUnit}
            onChange={(e) => setFilterSection(e.target.value)}
            className="p-2 border rounded w-full"
          >
            <option value="">All Sections</option>
            {sectionsForSelectedUnit.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <div className="flex items-end">
          <button onClick={fetchReport} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Refresh
          </button>
          {loading && (
            <div className="ml-2">
              <Spinner />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mb-2">
        <button
          onClick={handleExpandAll}
          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded p-4">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left text-xs font-medium">Unit</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Section</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Parameter</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Avg</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Min</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Max</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Count</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center p-4">
                  <Spinner />
                </td>
              </tr>
            )}

            {!loading &&
              pagedRows.map((r) => {
                const key = `${r.unit}_${r.section}_${r.parameter}`;
                const expanded = expandedRows[key];
                const raws = allRawData[key] || [];

                return (
                  <React.Fragment key={key}>
                    {/* SUMMARY ROW */}
                    <tr
                      className="cursor-pointer hover:bg-orange-50 border-t"
                      onClick={() => toggleExpandRow(r)}
                    >
                      <td className="px-3 py-2 text-sm">{r.unit}</td>
                      <td className="px-3 py-2 text-sm">{r.section}</td>
                      <td className="px-3 py-2 text-sm flex gap-2 items-center">
                        {r.parameter}
                        <span className="text-xs text-gray-600">{expanded ? "▾" : "▸"}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">{r.avg}</td>
                      <td className="px-3 py-2 text-sm text-right">{r.min}</td>
                      <td className="px-3 py-2 text-sm text-right">{r.max}</td>
                      <td className="px-3 py-2 text-sm text-right">{r.count}</td>
                    </tr>

                    {/* COLLAPSIBLE RAW ROWS */}
                    {expanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="p-3">
                          {rawLoading && raws.length === 0 ? (
                            <Spinner />
                          ) : raws.length === 0 ? (
                            <div className="text-gray-500 text-sm">No raw data available.</div>
                          ) : (
                            <table className="min-w-full text-sm border mt-2">
                              <thead>
                                <tr className="bg-gray-200">
                                  <th className="px-2 py-1 text-left">Time</th>
                                  <th className="px-2 py-1 text-left">Value</th>
                                  <th className="px-2 py-1 text-left">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {raws.map((rv, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="px-2 py-1">{rv.time}</td>
                                    <td className="px-2 py-1">{rv.value}</td>
                                    <td className="px-2 py-1">{rv.remarks || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className={`px-3 py-1 rounded ${
                page === 1 ? "bg-gray-100 cursor-not-allowed" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Previous
            </button>

            <span className="text-sm">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className={`px-3 py-1 rounded ${
                page === totalPages ? "bg-gray-100 cursor-not-allowed" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
