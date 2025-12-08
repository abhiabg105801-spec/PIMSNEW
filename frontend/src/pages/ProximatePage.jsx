// src/pages/ProximatePage.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

const PARAMETERS = [
  { key: "total_moisture", label: "Total Moisture %" },
  { key: "ash", label: "Ash %" },
  { key: "volatile", label: "Volatile Matter %" },
  { key: "fixed_carbon", label: "Fixed Carbon %" },
  { key: "gcv", label: "GCV (Kcal/kg)" },
  { key: "uhv", label: "UHV (Kcal/kg)" },
];

export default function ProximatePage({ auth }) {
  const [form, setForm] = useState({
    sample_no: "",
    date_sample: new Date().toISOString().slice(0, 10),
    time_sample: "00:00",
    shift: "Morning",
    date_analysis: new Date().toISOString().slice(0, 10),

    plant: "JSLO",
    broad_area: "2x125 MW CPP",
    main_area: "",
    main_collection: "",
    exact_collection: "",

    remarks: "",
  });

  const [values, setValues] = useState(() =>
    Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))
  );

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

  // ---------------------------
  // SAVE ENTRY
  // ---------------------------
  const saveProximate = async () => {
    setMsg("");

    // Validate numeric values
    for (const p of PARAMETERS) {
      const v = values[p.key];
      if (v !== "" && isNaN(Number(v))) {
        setMsg(`${p.label} must be numeric`);
        return;
      }
    }

    const entries = PARAMETERS.map((p) => ({
      parameter: p.key,
      value: values[p.key] === "" ? null : Number(values[p.key]),
      remarks: form.remarks,
    }));

    const payload = {
      date: form.date_sample,
      time: form.time_sample,
      unit: `${form.plant} – ${form.main_area}`,
      section: "Proximate Analysis",
      entries,
    };

    try {
      await api.post("/dm-plant/add-section", payload);
      setMsg("Saved successfully ✔");
      fetchTable();
    } catch (err) {
      setMsg(err?.response?.data?.detail || "Error saving");
    }
  };

  // ---------------------------
  // FETCH TABLE DATA (list)
  // ---------------------------
  const fetchTable = async () => {
    try {
      const res = await api.get("/dm-plant/report", {
        params: { date: form.date_sample },
      });

      // Filter only proximate records
      const raw = res.data.stats;
      const rows = [];

      Object.entries(raw).forEach(([key, v]) => {
        if (key.includes("Proximate Analysis")) {
          const [unit, section, parameter] = key.split("|").map((s) => s.trim());
          rows.push({ unit, section, parameter, ...v });
        }
      });

      setTable(rows);
    } catch {
      setTable([]);
    }
  };

  useEffect(() => {
    fetchTable();
  }, [form.date_sample]);

  // ---------------------------
  // COMPONENT UI
  // ---------------------------
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Proximate Analysis of Coal</h2>

      {/* TOP FILTERS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs">Sample No</label>
          <input
            className="w-full p-2 border rounded"
            value={form.sample_no}
            onChange={(e) => setForm({ ...form, sample_no: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs">Date of Sampling</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={form.date_sample}
            onChange={(e) => setForm({ ...form, date_sample: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs">Time of Sampling</label>
          <input
            type="time"
            className="w-full p-2 border rounded"
            value={form.time_sample}
            onChange={(e) => setForm({ ...form, time_sample: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs">Shift</label>
          <select
            className="w-full p-2 border rounded"
            value={form.shift}
            onChange={(e) => setForm({ ...form, shift: e.target.value })}
          >
            <option>Morning</option>
            <option>Evening</option>
            <option>Night</option>
          </select>
        </div>

        <div>
          <label className="text-xs">Date of Analysis</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={form.date_analysis}
            onChange={(e) => setForm({ ...form, date_analysis: e.target.value })}
          />
        </div>
      </div>

      {/* ANALYSIS DATA */}
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
          className="w-full p-2 border rounded"
          rows={2}
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        />
      </div>

      {/* Save button */}
      <div className="mt-4">
        <button
          onClick={saveProximate}
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
            {table.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="border px-2 py-1">{row.unit}</td>
                <td className="border px-2 py-1">{row.parameter}</td>
                <td className="border px-2 py-1">{row.avg}</td>
                <td className="border px-2 py-1">{row.min}</td>
                <td className="border px-2 py-1">{row.max}</td>
                <td className="border px-2 py-1">{row.count}</td>
              </tr>
            ))}

            {table.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-2 text-gray-500">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
