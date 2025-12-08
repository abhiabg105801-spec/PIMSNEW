// src/pages/DMWaterPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

const PARAMETERS = [
  { key: "tank1_level_m", label: "Tank1 Level (m)" },
  { key: "tank2_level_m", label: "Tank2 Level (m)" },
  { key: "dm_produced_t", label: "Produced (T)" },
  { key: "dm_used_t", label: "Used (T)" },
  { key: "dm_production_m3h", label: "DM Production (m3/h)" },
  { key: "dm_consumption_m3h", label: "DM Consumption (m3/h)" },
  { key: "transfer_to_unit1_t", label: "Transferred to Unit-1 (T)" },
  { key: "transfer_to_unit2_t", label: "Transferred to Unit-2 (T)" },
];

export default function DMWaterPage({ auth }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 8),
    unit: "DM",
    shift: "Morning",
    remarks: "",
  });

  const [values, setValues] = useState(() => Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const api = useMemo(() => {
    const token = auth || (localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "");
    return axios.create({ baseURL: API, headers: token ? { Authorization: token } : {} });
  }, [auth]);

  const save = async () => {
    setMsg("");
    for (const p of PARAMETERS) {
      const v = values[p.key];
      if (v !== "" && isNaN(Number(v))) {
        setMsg(`${p.label} must be numeric`);
        return;
      }
    }

    const entries = PARAMETERS.map(p => ({ parameter: p.key, value: values[p.key] === "" ? null : Number(values[p.key]), remarks: form.remarks || null }));

    const payload = {
      date: form.date,
      time: form.time,
      unit: form.unit,
      section: "DM Water Data",
      entries,
    };

    try {
      setSaving(true);
      await api.post("/dm-plant/add-section", payload);
      setMsg("Saved successfully.");
      setValues(Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
      fetchStats();
    } catch (e) {
      setMsg(e.response?.data?.detail || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    setStats([]);
    try {
      const res = await api.get("/dm-plant/report", { params: { date: form.date } });
      const raw = res.data.stats || {};
      const rows = [];
      Object.entries(raw).forEach(([k, v]) => {
        const parts = k.includes("|") ? k.split("|").map(s => s.trim()) : k.replace(/^\(|\)$/g, "").split(",").map(s => s.trim().replace(/^['"]|['"]$/g, ""));
        const [unit, section, parameter] = parts;
        if (section === "DM Water Data" && (unit === form.unit || form.unit === "")) {
          rows.push({ unit, parameter, ...v });
        }
      });
      setStats(rows);
    } catch {
      setStats([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { fetchStats(); }, [form.date, form.unit]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-3">DM Water Data</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs">Date</label>
          <input type="date" className="w-full p-2 border rounded" value={form.date} onChange={(e) => setForm(s => ({ ...s, date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs">Time</label>
          <input type="time" className="w-full p-2 border rounded" value={form.time} onChange={(e) => setForm(s => ({ ...s, time: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs">Unit</label>
          <select className="w-full p-2 border rounded" value={form.unit} onChange={(e) => setForm(s => ({ ...s, unit: e.target.value }))}>
            <option>DM</option>
            <option>Unit-1</option>
            <option>Unit-2</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Shift</label>
          <select className="w-full p-2 border rounded" value={form.shift} onChange={(e) => setForm(s => ({ ...s, shift: e.target.value }))}>
            <option>Morning</option>
            <option>Evening</option>
            <option>Night</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {PARAMETERS.map(p => (
          <div key={p.key}>
            <label className="text-xs">{p.label}</label>
            <input type="number" step="any" className="w-full p-2 border rounded" value={values[p.key]} onChange={(e) => setValues(s => ({ ...s, [p.key]: e.target.value }))} />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs">Remarks</label>
        <input className="w-full p-2 border rounded" value={form.remarks} onChange={(e) => setForm(s => ({ ...s, remarks: e.target.value }))} />
      </div>

      <div className="mt-4 flex gap-3 items-center">
        <button onClick={save} disabled={saving} className={`px-4 py-2 rounded text-white ${saving ? "bg-gray-400" : "bg-orange-600 hover:bg-orange-700"}`}>{saving ? "Saving..." : "Save"}</button>
        <button onClick={() => { setValues(Object.fromEntries(PARAMETERS.map(p => [p.key, ""]))); setForm(s => ({ ...s, remarks: "" })); setMsg(""); }} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Reset</button>
        <div className="text-sm text-green-700 ml-auto">{msg}</div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Daily Aggregated Stats ({form.date})</h3>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr><th className="px-2 py-1 text-left">Parameter</th><th className="px-2 py-1 text-right">Avg</th><th className="px-2 py-1 text-right">Min</th><th className="px-2 py-1 text-right">Max</th><th className="px-2 py-1 text-right">Count</th></tr>
            </thead>
            <tbody>
              {loadingStats ? (<tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>) :
                stats.length === 0 ? (<tr><td colSpan={5} className="text-center py-4 text-gray-500">No data</td></tr>) :
                stats.map((r,i) => (<tr key={i} className="border-t"><td className="px-2 py-1">{r.parameter}</td><td className="px-2 py-1 text-right">{r.avg}</td><td className="px-2 py-1 text-right">{r.min}</td><td className="px-2 py-1 text-right">{r.max}</td><td className="px-2 py-1 text-right">{r.count}</td></tr>))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
