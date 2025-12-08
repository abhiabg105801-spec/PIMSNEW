import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

const PARAMETERS = [
  // UNIT PARAMETERS
  { key: "total_coal_flow_tph", label: "Total Coal Flow (TPH)" },
  { key: "total_air_flow_tph", label: "Total Air Flow (TPH)" },
  { key: "sa_flow_tph", label: "SA Flow (TPH)" },
  { key: "mill_dp", label: "Mill DP (mmWC)" },
  { key: "outlet_temp", label: "Outlet Temp (°C)" },

  // FLUE GAS ANALYSIS
  { key: "fg_temp", label: "FG Temp (°C)" },
  { key: "co2_pct", label: "CO₂ (%)" },
  { key: "o2_pct", label: "O₂ (%)" },
  { key: "combustion_efficiency_pct", label: "Comb. Efficiency (%)" },
  { key: "excess_air_pct", label: "Excess Air (%)" },
  { key: "co_ppm", label: "CO (ppm)" },
];

export default function FlueGasPage({ auth }) {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState(
    new Date().toTimeString().slice(0, 8)
  );
  const [unit, setUnit] = useState("Unit-1");

  const [values, setValues] = useState(
    Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))
  );

  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState([]);

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

  const saveData = async () => {
    setMsg("");

    // validate
    for (const p of PARAMETERS) {
      if (values[p.key] !== "" && isNaN(Number(values[p.key]))) {
        setMsg(`${p.label} must be numeric`);
        return;
      }
    }

    const entries = PARAMETERS.filter(
      (p) => values[p.key] !== ""
    ).map((p) => ({
      parameter: p.key,
      value: Number(values[p.key]),
      remarks: null,
    }));

    if (entries.length === 0) {
      setMsg("Nothing to save");
      return;
    }

    const payload = {
      date,
      time,
      unit,
      section: "Flue Gas Analysis",
      entries,
    };

    try {
      await api.post("/dm-plant/add-section", payload);
      setMsg("Saved ✔");
      setValues(
        Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))
      );
      fetchRows();
    } catch (err) {
      setMsg("Error saving");
    }
  };

  const fetchRows = async () => {
    try {
      const res = await api.get("/dm-plant/report", {
        params: { date },
      });

      const parsed = [];

      Object.entries(res.data.stats).forEach(([key, stats]) => {
        if (key.includes("Flue Gas Analysis")) {
          const parts = key.split("|").map((s) => s.trim());
          parsed.push({
            unit: parts[0],
            parameter: parts[2],
            ...stats,
          });
        }
      });

      setRows(parsed);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [date]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-semibold text-lg mb-3">
        Flue Gas Analysis
      </h2>

      {/* TOP FIELDS */}
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
            <option>Unit-1</option>
            <option>Unit-2</option>
            <option>Station</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={saveData}
            className="px-4 py-2 bg-orange-600 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>

      <div className="text-green-700 text-sm mb-2">{msg}</div>

      {/* INPUT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PARAMETERS.map((p) => (
          <div key={p.key}>
            <label className="text-xs">{p.label}</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              value={values[p.key]}
              onChange={(e) =>
                setValues({
                  ...values,
                  [p.key]: e.target.value,
                })
              }
            />
          </div>
        ))}
      </div>

      {/* TABLE */}
      <h3 className="font-semibold mt-6 mb-2">
        Previous Entries
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
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
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="border px-2 py-1">{r.unit}</td>
                <td className="border px-2 py-1">{r.parameter}</td>
                <td className="border px-2 py-1">{r.avg}</td>
                <td className="border px-2 py-1">{r.min}</td>
                <td className="border px-2 py-1">{r.max}</td>
                <td className="border px-2 py-1">{r.count}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-2 text-gray-600"
                >
                  No Data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
