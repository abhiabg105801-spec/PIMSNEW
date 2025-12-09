// src/pages/ProximatePage.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";

// --- Configuration & Constants ---
const API_BASE = "http://localhost:8080/api";

const THEME = {
  primary: "bg-orange-600 hover:bg-orange-700 text-white",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700",
  input: "w-full text-sm border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 p-2 transition-all bg-gray-50",
  label: "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1",
  card: "bg-white rounded-lg shadow-sm border border-gray-200",
};

const PARAMETERS = [
  { key: "total_moisture", label: "Total Moisture %", placeholder: "0.00" },
  { key: "ash", label: "Ash %", placeholder: "0.00" },
  { key: "volatile", label: "Volatile Matter %", placeholder: "0.00" },
  { key: "fixed_carbon", label: "Fixed Carbon %", placeholder: "0.00" },
  { key: "gcv", label: "GCV (Kcal/kg)", placeholder: "0" },
  { key: "uhv", label: "UHV (Kcal/kg)", placeholder: "0" },
];

// --- Reusable UI Components ---
const InputGroup = ({ label, children }) => (
  <div className="mb-3">
    <label className={THEME.label}>{label}</label>
    {children}
  </div>
);

export default function ProximatePage({ auth }) {
  // --- State ---
  const [form, setForm] = useState({
    sample_no: "",
    date_sample: new Date().toISOString().slice(0, 10),
    time_sample: "00:00",
    shift: "Morning",
    date_analysis: new Date().toISOString().slice(0, 10),
    plant: "JSLO",
    broad_area: "2x125 MW CPP",
    main_area: "",
    remarks: "",
  });

  const [values, setValues] = useState(() =>
    Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))
  );

  const [table, setTable] = useState([]);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  // --- API Instance ---
  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: auth || (localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : ""),
    },
  });

  // --- Handlers ---
  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleValueChange = (key, val) => setValues({ ...values, [key]: val });

  const resetForm = () => {
    setValues(Object.fromEntries(PARAMETERS.map((p) => [p.key, ""])));
    setMsg({ text: "", type: "" });
    setForm(prev => ({ ...prev, sample_no: "", remarks: "" }));
  };

  // --- Actions ---
  const fetchTable = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dm-plant/report", {
        params: { date: form.date_sample },
      });

      // Transform API response (Unit|Section|Param key format)
      const raw = res.data.stats || {};
      const rows = [];
      Object.entries(raw).forEach(([key, v]) => {
        if (key.includes("Proximate Analysis")) {
          const [unit, section, parameter] = key.split("|").map((s) => s.trim());
          rows.push({ unit, section, parameter, ...v });
        }
      });
      setTable(rows);
    } catch (err) {
      setTable([]);
    } finally {
      setLoading(false);
    }
  };

  const saveProximate = async () => {
    setMsg({ text: "", type: "" });

    // Validate
    for (const p of PARAMETERS) {
      const v = values[p.key];
      if (v !== "" && isNaN(Number(v))) {
        setMsg({ text: `${p.label} must be a number`, type: "error" });
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
      unit: `${form.plant} – ${form.main_area || "General"}`,
      section: "Proximate Analysis",
      entries,
    };

    try {
      await api.post("/dm-plant/add-section", payload);
      setMsg({ text: "Entry saved successfully", type: "success" });
      fetchTable();
      setValues(Object.fromEntries(PARAMETERS.map((p) => [p.key, ""]))); // Optional: Clear values after save
    } catch (err) {
      setMsg({ text: err?.response?.data?.detail || "Error saving data", type: "error" });
    }
  };

  // Initial Fetch
  useEffect(() => {
    fetchTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date_sample]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Proximate Analysis</h1>
          <p className="text-xs text-gray-500 mt-1">Daily Coal Analysis Log</p>
        </div>
        <div className="text-right">
           <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">
             {form.date_sample}
           </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* --- LEFT COLUMN: COMPACT INPUT FORM --- */}
        <div className={`${THEME.card} w-full lg:w-80 flex-shrink-0 sticky top-4`}>
          <div className="p-4 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <h2 className="font-bold text-gray-700 text-sm uppercase">Input Details</h2>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Meta Data */}
            <div className="space-y-3 pb-4 border-b border-gray-100">
               <InputGroup label="Sample Info">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="date" name="date_sample" value={form.date_sample} onChange={handleFormChange} className={THEME.input} />
                    <input type="time" name="time_sample" value={form.time_sample} onChange={handleFormChange} className={THEME.input} />
                  </div>
                  <input placeholder="Sample No." name="sample_no" value={form.sample_no} onChange={handleFormChange} className={THEME.input} />
               </InputGroup>

               <InputGroup label="Location & Shift">
                  <select name="shift" value={form.shift} onChange={handleFormChange} className={`${THEME.input} mb-2`}>
                    <option>Morning</option>
                    <option>Evening</option>
                    <option>Night</option>
                  </select>
                  <input placeholder="Main Area (e.g. CHP)" name="main_area" value={form.main_area} onChange={handleFormChange} className={THEME.input} />
               </InputGroup>
            </div>

            {/* Parameters */}
            <div className="space-y-3">
              {PARAMETERS.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                   <label className="text-xs font-medium text-gray-600 w-1/2">{p.label}</label>
                   <input
                     type="number"
                     step="any"
                     placeholder={p.placeholder}
                     value={values[p.key]}
                     onChange={(e) => handleValueChange(p.key, e.target.value)}
                     className={`${THEME.input} w-1/2 text-right font-mono`}
                   />
                </div>
              ))}
            </div>

            {/* Footer / Actions */}
            <div className="pt-2">
               <textarea
                 placeholder="Remarks..."
                 rows={2}
                 name="remarks"
                 value={form.remarks}
                 onChange={handleFormChange}
                 className={`${THEME.input} mb-3`}
               />

               {msg.text && (
                 <div className={`text-xs p-2 rounded mb-3 text-center ${msg.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                   {msg.text}
                 </div>
               )}

               <div className="flex gap-2">
                 <button onClick={resetForm} className={`${THEME.secondary} flex-1 py-2 rounded text-xs font-bold uppercase`}>
                   Reset
                 </button>
                 <button onClick={saveProximate} className={`${THEME.primary} flex-1 py-2 rounded text-xs font-bold uppercase shadow-md`}>
                   Save Entry
                 </button>
               </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: DATA TABLE --- */}
        <div className={`${THEME.card} w-full flex-grow overflow-hidden`}>
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-gray-700 text-sm uppercase">Analysis Report ({form.date_sample})</h2>
            <button onClick={fetchTable} className="text-orange-600 hover:text-orange-800 text-xs font-bold flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-100 text-gray-500 uppercase text-xs font-bold">
                <tr>
                  <th className="px-4 py-3 border-b">Parameter</th>
                  <th className="px-4 py-3 border-b">Unit / Area</th>
                  <th className="px-4 py-3 border-b text-right">Avg</th>
                  <th className="px-4 py-3 border-b text-right">Min</th>
                  <th className="px-4 py-3 border-b text-right">Max</th>
                  <th className="px-4 py-3 border-b text-center">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                   <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading data...</td></tr>
                ) : table.length === 0 ? (
                   <tr><td colSpan={6} className="p-8 text-center text-gray-400">No data found for this date.</td></tr>
                ) : (
                  table.map((row, i) => (
                    <tr key={i} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700">{row.parameter}</td>
                      <td className="px-4 py-3 text-gray-500">{row.unit}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 font-bold">{row.avg}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">{row.min}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">{row.max}</td>
                      <td className="px-4 py-3 text-center">
                         <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                           {row.count}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-center text-gray-500">
             Showing aggregated stats from database
          </div>
        </div>

      </div>
    </div>
  );
}