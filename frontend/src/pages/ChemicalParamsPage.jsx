// src/pages/ChemicalParamsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

// --- Icons ---
const Icons = {
  Save: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Alert: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
};

// --- Theme Constants ---
const THEME = {
  primary: "bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all",
  secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all",
  input: "w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder-gray-400",
  label: "block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1",
  card: "bg-white rounded-lg shadow-sm border border-gray-100",
  tableHeader: "bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200",
  tableRow: "hover:bg-orange-50/40 transition-colors border-b border-gray-100 text-sm",
};

// --- Toast Component ---
const Toast = ({ show, type = "success", message }) => {
  if (!show) return null;
  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium flex items-center gap-3 z-50 animate-fadeIn ${type === "error" ? "bg-red-500" : "bg-green-600"}`}>
      {type === "error" ? <Icons.Alert /> : <Icons.Check />} {message}
    </div>
  );
};

// --- Configuration ---
const API = "http://localhost:8080/api";

const PARAMETERS = [
  { key: "temp_c", label: "Temp (°C)" },
  { key: "turbidity", label: "Turbidity (NTU)" },
  { key: "ph", label: "pH" },
  { key: "p_alkalinity", label: "P-Alk (ppm)" },
  { key: "m_alkalinity", label: "M-Alk (ppm)" },
  { key: "ca_h", label: "Ca-H (ppm)" },
  { key: "mg_h", label: "Mg-H (ppm)" },
  { key: "th", label: "T.H. (ppm)" },
  { key: "cl_ppm", label: "Cl (ppm)" },
  { key: "conductivity", label: "Cond (µS/cm)" },
  { key: "tds", label: "TDS (ppm)" },
  { key: "sio2", label: "SiO2 (ppm)" },
  { key: "po4", label: "PO4" },
  { key: "coc_th", label: "COC TH" },
];

const PLANTS = ["JSLO"];
const BROAD_AREAS = ["2x125 MW CPP"];
const MAIN_AREAS = ["Unit #1", "Unit #2", "14 MW"];
const MAIN_COLLECTION_AREAS = ["1A+1B+1D+1E", "1A+1B+1C", "Hoppers", "Boiler"];
const INITIAL_EXACT_AREAS = ["CT Make Up", "Circulating Water", "Clarified Water", "Intake Water", "Coal Feeder"];

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function ChemicalParamsPage({ auth }) {
  // State
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 8));
  
  // Location State
  const [plant, setPlant] = useState(PLANTS[0]);
  const [broadArea, setBroadArea] = useState(BROAD_AREAS[0]);
  const [mainArea, setMainArea] = useState(MAIN_AREAS[0]);
  const [mainCollection, setMainCollection] = useState(MAIN_COLLECTION_AREAS[0]);
  const [exactArea, setExactArea] = useState(INITIAL_EXACT_AREAS[0]);
  const [customExactAreas, setCustomExactAreas] = useState(INITIAL_EXACT_AREAS);
  const [remarks, setRemarks] = useState("");

  // CT Blowdown Controls
  const [ctBdPercent, setCtBdPercent] = useState("");
  const [ctBdStatus, setCtBdStatus] = useState("open"); 
  const [ctOpening, setCtOpening] = useState("00:00");
  const [ctClosing, setCtClosing] = useState("00:00");

  // Data State
  const [values, setValues] = useState(() => Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
  const [saving, setSaving] = useState(false);
  const [tableRows, setTableRows] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const api = useMemo(() => axios.create({
    baseURL: API,
    headers: { Authorization: auth || (localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "") }
  }), [auth]);

  // Helpers
  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, message: msg });
    setTimeout(() => setToast({ show: false, type: "success", message: "" }), 3000);
  };

  const updateValue = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  const clearForm = () => {
    setValues(Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
    setRemarks("");
    setCtBdPercent("");
    setCtBdStatus("open");
    setCtOpening("00:00");
    setCtClosing("00:00");
  };

  const handleAddArea = () => {
    if (!exactArea) return;
    if (!customExactAreas.includes(exactArea)) {
      setCustomExactAreas(prev => [...prev, exactArea]);
      showToast(`Added area: ${exactArea}`);
    }
  };

  // API Actions
  const save = async () => {
    // Validation
    for (const p of PARAMETERS) {
      if (values[p.key] !== "" && isNaN(Number(values[p.key]))) {
        return showToast(`${p.label} must be numeric`, "error");
      }
    }

    const entries = PARAMETERS.map(p => ({
      parameter: p.key,
      value: values[p.key] === "" ? null : Number(values[p.key]),
      remarks: remarks || null
    })).filter(e => e.value !== null);

    if (ctBdPercent !== "") entries.push({ parameter: "ct_bd_percent", value: Number(ctBdPercent), remarks: null });
    entries.push({ parameter: "ct_bd_status", value: ctBdStatus === "open" ? 1.0 : 0.0, remarks: ctBdStatus });
    if (ctOpening) entries.push({ parameter: "ct_opening_time", value: null, remarks: ctOpening });
    if (ctClosing) entries.push({ parameter: "ct_closing_time", value: null, remarks: ctClosing });

    if (entries.length === 0) return showToast("Enter at least one value", "error");

    const payload = {
      date, time, plant,
      broad_area: broadArea,
      main_area: mainArea,
      main_collection_area: mainCollection,
      exact_collection_area: exactArea,
      section: "Chemical Parameter",
      entries
    };

    try {
      setSaving(true);
      await api.post("/chemical/add-section", payload);
      showToast("Data Saved Successfully");
      clearForm();
      fetchTable();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Error saving data", "error");
    } finally {
      setSaving(false);
    }
  };

  const fetchTable = async () => {
    try {
      setLoadingTable(true);
      const res = await api.get("/chemical/report", { params: { date } });
      const raw = res.data.rows || [];

      // Grouping logic
      const grouped = {};
      raw.forEach(r => {
        const key = `${r.plant}||${r.time}||${r.main_collection_area}||${r.exact_collection_area}||${r.remarks || ""}`;
        grouped[key] = grouped[key] || {
          plant: r.plant,
          broad_area: r.broad_area,
          main_area: r.main_area,
          main_collection_area: r.main_collection_area,
          exact_collection_area: r.exact_collection_area,
          time: r.time,
          date: r.date,
          remarks: r.remarks || "",
          params: {}
        };
        grouped[key].params[r.parameter] = r.value;
      });
      setTableRows(Object.values(grouped));
    } catch (err) {
      setTableRows([]);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => { fetchTable(); }, [date]);

  // Load record into form for editing (simple copy)
  const handleRowClick = (row) => {
    setTime(row.time);
    setPlant(row.plant);
    setMainArea(row.main_area);
    setMainCollection(row.main_collection_area);
    setExactArea(row.exact_collection_area);
    setRemarks(row.remarks);
    
    // Reset values first
    const newValues = Object.fromEntries(PARAMETERS.map(p => [p.key, ""]));
    // Fill with row data
    Object.keys(row.params).forEach(k => {
      if(newValues.hasOwnProperty(k)) newValues[k] = row.params[k];
    });
    setValues(newValues);
    
    showToast("Record loaded for editing. Click Save to create new entry.", "success");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800 animate-fadeIn">
      <Toast show={toast.show} type={toast.type} message={toast.message} />

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Chemical Parameters</h1>
            <p className="text-sm text-gray-500 mt-1">CW / CT / MU / Raw Water Quality Log</p>
          </div>
          <div className="flex gap-2 mt-3 md:mt-0">
            <button onClick={clearForm} className={`${THEME.secondary} px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2`}>
              <Icons.Refresh /> Clear
            </button>
            <button onClick={save} disabled={saving} className={`${THEME.primary} px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center gap-2 ${saving ? "opacity-50 cursor-not-allowed" : ""}`}>
              {saving ? "Saving..." : <><Icons.Save /> Save Entry</>}
            </button>
          </div>
        </div>

        {/* Input Form Card */}
        <div className={`${THEME.card} p-5`}>
          
          {/* Top Section: Context */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div>
               <label className={THEME.label}>Date</label>
               <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className={THEME.input} />
            </div>
            <div>
               <label className={THEME.label}>Time</label>
               <input type="time" value={time} onChange={(e)=>setTime(e.target.value)} className={THEME.input} />
            </div>
            <div>
               <label className={THEME.label}>Plant</label>
               <select value={plant} onChange={(e)=>setPlant(e.target.value)} className={THEME.input}>
                  {PLANTS.map(p => <option key={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className={THEME.label}>Broad Area</label>
               <select value={broadArea} onChange={(e)=>setBroadArea(e.target.value)} className={THEME.input}>
                  {BROAD_AREAS.map(p => <option key={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className={THEME.label}>Main Area</label>
               <select value={mainArea} onChange={(e)=>setMainArea(e.target.value)} className={THEME.input}>
                  {MAIN_AREAS.map(p => <option key={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className={THEME.label}>Sample No (Opt)</label>
               <input type="text" placeholder="Auto" className={THEME.input} />
            </div>

            {/* Row 2 */}
            <div className="md:col-span-2">
               <label className={THEME.label}>Main Collection Area</label>
               <select value={mainCollection} onChange={(e)=>setMainCollection(e.target.value)} className={THEME.input}>
                  {MAIN_COLLECTION_AREAS.map(p => <option key={p}>{p}</option>)}
               </select>
            </div>
            <div className="md:col-span-2 relative">
               <label className={THEME.label}>Exact Collection Area</label>
               <div className="flex gap-1">
                 <select value={exactArea} onChange={(e)=>setExactArea(e.target.value)} className={THEME.input}>
                    {customExactAreas.map(p => <option key={p}>{p}</option>)}
                    <option value="">-- Custom --</option>
                 </select>
                 <button onClick={handleAddArea} className="px-2 bg-gray-100 border border-gray-200 rounded text-gray-600 hover:text-orange-600" title="Add current area to list"><Icons.Plus /></button>
               </div>
            </div>
            <div className="md:col-span-2">
               <label className={THEME.label}>Remarks</label>
               <input value={remarks} onChange={(e)=>setRemarks(e.target.value)} className={THEME.input} placeholder="Enter observations..." />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4"></div>

          {/* Middle Section: Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {PARAMETERS.map(p => (
              <div key={p.key}>
                <label className={THEME.label}>{p.label}</label>
                <input 
                  type="number" 
                  step="any" 
                  value={values[p.key]} 
                  onChange={(e)=>updateValue(p.key, e.target.value)} 
                  className={THEME.input} 
                />
              </div>
            ))}
          </div>

          <div className="h-px bg-gray-100 my-4"></div>

          {/* Bottom Section: CT Blowdown */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-orange-600 uppercase mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
              Cooling Tower Operations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
               <div>
                  <label className={THEME.label}>Blowdown %</label>
                  <input type="number" step="any" value={ctBdPercent} onChange={(e)=>setCtBdPercent(e.target.value)} className={`${THEME.input} bg-white`} placeholder="0.00" />
               </div>
               
               <div className="flex gap-4 pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={ctBdStatus==="open"} onChange={()=>setCtBdStatus("open")} className="text-orange-600 focus:ring-orange-500" />
                    <span className="text-xs font-medium text-gray-700">Open</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={ctBdStatus==="close"} onChange={()=>setCtBdStatus("close")} className="text-orange-600 focus:ring-orange-500" />
                    <span className="text-xs font-medium text-gray-700">Close</span>
                  </label>
               </div>

               <div>
                  <label className={THEME.label}>Opening Time</label>
                  <input type="time" value={ctOpening} onChange={(e)=>setCtOpening(e.target.value)} className={`${THEME.input} bg-white`} />
               </div>
               <div>
                  <label className={THEME.label}>Closing Time</label>
                  <input type="time" value={ctClosing} onChange={(e)=>setCtClosing(e.target.value)} className={`${THEME.input} bg-white`} />
               </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className={`${THEME.card} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
             <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Daily Log - {date}</h2>
             <button onClick={fetchTable} className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                <Icons.Search /> Refresh Data
             </button>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full whitespace-nowrap">
                <thead>
                   <tr>
                      <th className={`${THEME.tableHeader} px-4 py-3 text-left sticky left-0 bg-gray-100 z-10`}>Location</th>
                      <th className={`${THEME.tableHeader} px-4 py-3 text-left`}>Time</th>
                      {PARAMETERS.map(p => <th key={p.key} className={`${THEME.tableHeader} px-4 py-3 text-right`}>{p.label}</th>)}
                      <th className={`${THEME.tableHeader} px-4 py-3 text-left`}>Remarks</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                   {loadingTable ? (
                      <tr><td colSpan={PARAMETERS.length+3} className="p-8 text-center text-gray-400">Loading records...</td></tr>
                   ) : tableRows.length === 0 ? (
                      <tr><td colSpan={PARAMETERS.length+3} className="p-8 text-center text-gray-400 italic">No records found for this date.</td></tr>
                   ) : (
                      tableRows.map((r, i) => (
                         <tr key={i} onClick={() => handleRowClick(r)} className={`${THEME.tableRow} cursor-pointer group`}>
                            <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-orange-50 transition-colors border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                               <div className="font-bold text-gray-800 text-xs">{r.main_collection_area}</div>
                               <div className="text-[10px] text-gray-500">{r.exact_collection_area}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.time.slice(0,5)}</td>
                            {PARAMETERS.map(p => (
                               <td key={p.key} className="px-4 py-3 text-right text-xs font-mono text-gray-700">
                                  {r.params?.[p.key] ?? "-"}
                               </td>
                            ))}
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{r.remarks || "-"}</td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
        </div>

      </div>
    </div>
  );
}