// src/pages/ChemicalMatrixPage.jsx
import React, { useState } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

const COLUMNS = [
  "Condensate Water",
  "Feed Water",
  "Drum Water",
  "Saturated Steam",
  "Super Heated Steam",
  "Hot Reheated Steam",
];

const PARAMETERS = [
  { key: "conductivity", label: "Conductivity" },
  { key: "ph", label: "pH" },
  { key: "breading", label: "B Reading (ml)" },
  { key: "phosphate", label: "Phosphate (ppm)" },
  { key: "sio2", label: "SiO₂ (ppm)" },
  { key: "cl_ppm", label: "Cl (ppm)" },
  { key: "nh3", label: "NH₃ (ppm)" },
  { key: "n2h4", label: "N₂H₄ (ppm)" },
  { key: "fe_ppm", label: "Fe (ppm)" },
  { key: "hardness", label: "Hardness (ppm)" },
  { key: "turbidity", label: "Turbidity (NTU)" },
  { key: "o2", label: "O₂ (ppm)" },
];

function emptyMatrix() {
  const m = {};
  PARAMETERS.forEach((p) => {
    m[p.key] = {};
    COLUMNS.forEach((c) => (m[p.key][c] = ""));
  });
  return m;
}

export default function ChemicalMatrixPage({ auth }) {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState(() =>
    new Date().toTimeString().slice(0, 8)
  );
  const [unit, setUnit] = useState("Unit-1");
  const [matrix, setMatrix] = useState(() => emptyMatrix());
  const [saving, setSaving] = useState(false);
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

  const updateCell = (param, col, val) => {
    setMatrix((prev) => ({
      ...prev,
      [param]: { ...prev[param], [col]: val },
    }));
  };
const saveEntry = async () => {
  setMsg("");

  // validate numeric
  for (const p of PARAMETERS) {
    for (const c of COLUMNS) {
      const val = matrix[p.key][c];
      if (val !== "" && isNaN(Number(val))) {
        setMsg(`${p.label} (${c}) must be numeric`);
        return;
      }
    }
  }

  try {
    setSaving(true);

    // LOOP EACH COLUMN (SECTION)
    for (const section of COLUMNS) {

      const entries = PARAMETERS
        .filter((p) => matrix[p.key][section] !== "")
        .map((p) => ({
          parameter: p.key,
          value: Number(matrix[p.key][section]),
          remarks: null,
        }));

      if (entries.length === 0) continue;

      const payload = {
        date,
        time,
        unit,
        section,
        entries,
      };

      await api.post("/dm-plant/add-section", payload);
    }

    setMsg("Saved successfully ✔");
    setMatrix(emptyMatrix());

  } catch (err) {
    setMsg(err?.response?.data?.detail || "Save failed");
  } finally {
    setSaving(false);
  }
};



  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Chemical Analysis Entry</h2>

      {/* TOP FIELDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-600">Date</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Time</label>
          <input
            type="time"
            className="w-full p-2 border rounded"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Unit</label>
          <select
            className="w-full p-2 border rounded"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option>Unit-1</option>
            <option>Unit-2</option>
            <option>Station</option>
            <option>Coal</option>
            <option>DM</option>
            <option>Chem</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={saveEntry}
            disabled={saving}
            className={`px-4 py-2 rounded text-white ${
              saving ? "bg-gray-400" : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {saving ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </div>

      <div className="mb-3 text-sm text-green-700">{msg}</div>

      {/* MATRIX GRID */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-3 py-2 text-left">Parameter</th>
              {COLUMNS.map((c) => (
                <th key={c} className="border px-3 py-2 text-center">
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PARAMETERS.map((p) => (
              <tr key={p.key}>
                <td className="border px-3 py-2 bg-gray-50 font-medium">
                  {p.label}
                </td>

                {COLUMNS.map((col) => (
                  <td key={col} className="border px-2 py-1">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded text-sm"
                      value={matrix[p.key][col]}
                      onChange={(e) =>
                        updateCell(p.key, col, e.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
