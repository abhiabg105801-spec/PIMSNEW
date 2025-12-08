// src/pages/SievePage.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

const PARAMETERS = [
  { key: "pct_200mesh", label: "% 200 Mesh" },
  { key: "pct_100mesh", label: "% 100 Mesh" },
  { key: "pct_gt_50mesh", label: "% > 50 Mesh" },
];

export default function SievePage({ auth }) {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState("00:00");
  const [unit, setUnit] = useState("Coal");

  const [values, setValues] = useState(() =>
    Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))
  );
  const [remarks, setRemarks] = useState("");

  const [table, setTable] = useState([]);
  const [msg, setMsg] = useState("");

  const api = axios.create({
    baseURL: API,
    headers: {
      Authorization:
        auth ||
        (localStorage.getItem("authToken")
          ? `Bearer ${localStorage.getItem("authToken")}`
          : ""),
    },
  });

  // ------------------------
  // SAVE ENTRY
  // ------------------------
  const saveSieve = async () => {
    setMsg("");

    // Validate numeric
    for (const p of PARAMETERS) {
      const val = values[p.key];
      if (val !== "" && isNaN(Number(val))) {
        setMsg(`${p.label} must be numeric`);
        return;
      }
    }

    const entries = PARAMETERS.map((p) => ({
      parameter: p.key,
      value: values[p.key] === "" ? null : Number(values[p.key]),
      remarks,
    }));

    const payload = {
      date,
      time,
      unit,
      section: "Sieve Analysis",
      entries,
    };

    try {
      await api.post("/dm-plant/add-section", payload);
      setMsg("Saved successfully ✔");
      setValues(Object.fromEntries(PARAMETERS.map((p) => [p.key, ""])));
      setRemarks("");
      fetchTable();
    } catch (err) {
      setMsg(err?.response?.data?.detail || "Error saving");
    }
  };

  // ------------------------
  // FETCH TABLE
  // ------------------------
  const fetchTable = async () => {
    try {
      const res = await api.get("/dm-plant/report", {
        params: { date },
      });

      const rows = [];

      Object.entries(res.data.stats).forEach(([key, stats]) => {
        if (key.includes("Sieve Analysis")) {
          const parts = key.split("|").map((s) => s.trim());
          rows.push({
            unit: parts[0],
            parameter: parts[2],
            ...stats,
          });
        }
      });

      setTable(rows);
    } catch {
      setTable([]);
    }
  };

  useEffect(() => {
    fetchTable();
  }, [date]);

  // ------------------------
  // UI
  // ------------------------
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Sieve Analysis</h2>

      {/* TOP SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs">Date</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs">Time</label>
          <input
            type="time"
            className="w-full p-2 border rounded"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs">Unit</label>
          <select
            className="w-full p-2 border rounded"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option>Coal</option>
            <option>Unit-1</option>
            <option>Unit-2</option>
            <option>Station</option>
          </select>
        </div>
      </div>

      {/* INPUT GRID */}
      <h3 className="font-semibold mb-2">Analysis Data</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {PARAMETERS.map((p) => (
          <div key={p.key}>
            <label className="text-xs">{p.label}</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              value={values[p.key]}
              onChange={(e) =>
                setValues({ ...values, [p.key]: e.target.value })
              }
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs">Remarks</label>
        <textarea
          rows={2}
          className="w-full p-2 border rounded"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      {/* SAVE BUTTON */}
      <div className="mt-4">
        <button
          onClick={saveSieve}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
        >
          Save
        </button>
      </div>

      <div className="text-green-700 mt-2">{msg}</div>

      {/* TABLE */}
      <h3 className="font-semibold mt-6 mb-2">Previous Entries</h3>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">Unit</th>
              <th className="border px-2 py-1">Parameter</th>
              <th className="border px-2 py-1">Avg</th>
              <th className="border px-2 py-1">Min</th>
              <th className="border px-2 py-1">Max</th>
              <th className="border px-2 py-1">Count</th>
            </tr>
          </thead>

          <tbody>
            {table.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="border px-2 py-1">{r.unit}</td>
                <td className="border px-2 py-1">{r.parameter}</td>
                <td className="border px-2 py-1">{r.avg}</td>
                <td className="border px-2 py-1">{r.min}</td>
                <td className="border px-2 py-1">{r.max}</td>
                <td className="border px-2 py-1">{r.count}</td>
              </tr>
            ))}

            {table.length === 0 && (
              <tr>
                <td colSpan={6} className="py-2 text-center text-gray-500">
                  No data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
