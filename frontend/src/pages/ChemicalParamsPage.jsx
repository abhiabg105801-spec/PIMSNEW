// src/pages/ChemicalParamsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API =  "http://localhost:8080/api";

// parameter list shown in screenshot
const PARAMETERS = [
  { key: "temp_c", label: "Temp (°C)" },
  { key: "turbidity", label: "Turbidity (NTU)" },
  { key: "ph", label: "pH" },
  { key: "p_alkalinity", label: "P-Alkalinity ppm as CaCO3" },
  { key: "m_alkalinity", label: "M.O. ppm as CaCO3" },
  { key: "ca_h", label: "Ca-H ppm as CaCO3" },
  { key: "mg_h", label: "Mg-H ppm as CaCO3" },
  { key: "th", label: "T.H. ppm as CaCO3" },
  { key: "cl_ppm", label: "Cl ppm as CaCO3" },
  { key: "conductivity", label: "Conductivity (Micromhos/cm)" },
  { key: "tds", label: "TDS ppm" },
  { key: "sio2", label: "SiO2 ppm" },
  { key: "po4", label: "PO4" },
  { key: "coc_th", label: "COC TH" },
];

// sample master lists (you can replace with API-driven lists)
const PLANTS = ["JSLO"];
const BROAD_AREAS = ["2x125 MW CPP"];
const MAIN_AREAS = ["Unit #1", "Unit #2", "14 MW"];
const MAIN_COLLECTION_AREAS = ["1A+1B+1D+1E", "1A+1B+1C", "Hoppers", "Boiler"];
const EXACT_AREAS = ["CT Make Up", "Circulating Water", "Clarified Water", "Intake Water", "Coal Feeder"];

export default function ChemicalParamsPage({ auth }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0,8));
  const [plant, setPlant] = useState(PLANTS[0]);
  const [broadArea, setBroadArea] = useState(BROAD_AREAS[0]);
  const [mainArea, setMainArea] = useState(MAIN_AREAS[0]);
  const [mainCollection, setMainCollection] = useState(MAIN_COLLECTION_AREAS[0]);
  const [exactArea, setExactArea] = useState(EXACT_AREAS[0]);
  const [remarks, setRemarks] = useState("");

  // CT Blowdown controls
  const [ctBdPercent, setCtBdPercent] = useState("");
  const [ctBdStatus, setCtBdStatus] = useState("open"); // 'open'|'close'
  const [ctOpening, setCtOpening] = useState("00:00");
  const [ctClosing, setCtClosing] = useState("00:00");

  // values
  const [values, setValues] = useState(() => Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tableRows, setTableRows] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const api = useMemo(() => axios.create({
    baseURL: API,
    headers: {
      Authorization: auth || (localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "")
    }
  }), [auth]);

  // dependent dropdown example - here static; replace with API calls if needed
  useEffect(() => {
    // you could fetch specific main collection areas based on mainArea here
  }, [mainArea]);

  function updateValue(key, v) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  const clearForm = () => {
    setValues(Object.fromEntries(PARAMETERS.map(p => [p.key, ""])));
    setRemarks("");
    setCtBdPercent("");
    setCtBdStatus("open");
    setCtOpening("00:00");
    setCtClosing("00:00");
    setMsg("");
  };

  // Build entries and post using new API
  const save = async () => {
    setMsg("");
    // validate numeric where provided
    for (const p of PARAMETERS) {
      const val = values[p.key];
      if (val !== "" && isNaN(Number(val))) {
        setMsg(`${p.label} must be numeric`);
        return;
      }
    }

    // Build entries array
    const entries = PARAMETERS.map(p => ({
      parameter: p.key,
      value: values[p.key] === "" ? null : Number(values[p.key]),
      remarks: remarks || null
    })).filter(e => e.value !== null); // save only provided values

    // Also append CT blowdown as parameters if provided
    if (ctBdPercent !== "") entries.push({ parameter: "ct_bd_percent", value: Number(ctBdPercent), remarks: null });
    entries.push({ parameter: "ct_bd_status", value: ctBdStatus === "open" ? 1.0 : 0.0, remarks: ctBdStatus });
    if (ctOpening) entries.push({ parameter: "ct_opening_time", value: null, remarks: ctOpening });
    if (ctClosing) entries.push({ parameter: "ct_closing_time", value: null, remarks: ctClosing });

    if (entries.length === 0) {
      setMsg("Please enter at least one parameter value to save");
      return;
    }

    const payload = {
      date,
      time,
      plant,
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
      setMsg("Saved successfully ✔");
      clearForm();
      fetchTable();
    } catch (err) {
      console.error(err);
      setMsg(err?.response?.data?.detail || "Error while saving");
    } finally {
      setSaving(false);
    }
  };

  // Fetch report -> shows raw rows for date
  const fetchTable = async () => {
    try {
      setLoadingTable(true);
      const res = await api.get("/chemical/report", { params: { date } });
      // res.data.rows is a flat list. We'll pivot to one row per sample-time by grouping
      const raw = res.data.rows || [];

      // group by sample key (plant+time+exact_area) to make table rows with multiple parameter columns
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
          shift: "", // shift isn't stored in this table; leave blank unless you add it
          remarks: r.remarks || "",
          params: {}
        };
        grouped[key].params[r.parameter] = r.value;
      });

      const rows = Object.values(grouped);
      setTableRows(rows);
    } catch (err) {
      setTableRows([]);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchTable();
  }, [date]);

  // helper to render parameter cell in table
  const showParam = (row, key) => {
    const v = row.params?.[key];
    if (v === undefined) return "-";
    if (v === null) return "-";
    return String(v);
  };

  // Add Exact Area locally (Add Area button)
  const handleAddArea = () => {
    if (!exactArea) return;
    if (!EXACT_AREAS.includes(exactArea)) {
      EXACT_AREAS.push(exactArea);
      setMsg(`Added area ${exactArea} locally`);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Chemical Parameter (CW / CT / MU / Raw Water)</h2>

      {/* Top fields */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
        <div>
          <label className="text-xs">Sample No</label>
          <input className="w-full p-2 border rounded" placeholder="Optional" />
        </div>

        <div>
          <label className="text-xs">Date of Sampling</label>
          <input type="date" className="w-full p-2 border rounded" value={date} onChange={(e)=>setDate(e.target.value)} />
        </div>

        <div>
          <label className="text-xs">Time of Sampling</label>
          <input type="time" className="w-full p-2 border rounded" value={time} onChange={(e)=>setTime(e.target.value)} />
        </div>

        <div>
          <label className="text-xs">Plant</label>
          <select className="w-full p-2 border rounded" value={plant} onChange={(e)=>setPlant(e.target.value)}>
            {PLANTS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs">Broad Area</label>
          <select className="w-full p-2 border rounded" value={broadArea} onChange={(e)=>setBroadArea(e.target.value)}>
            {BROAD_AREAS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs">Main Area</label>
          <select className="w-full p-2 border rounded" value={mainArea} onChange={(e)=>setMainArea(e.target.value)}>
            {MAIN_AREAS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs">Main Collection Area</label>
          <select className="w-full p-2 border rounded" value={mainCollection} onChange={(e)=>setMainCollection(e.target.value)}>
            {MAIN_COLLECTION_AREAS.map(x => <option key={x}>{x}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs">Exact Collection Area</label>
          <select className="w-full p-2 border rounded" value={exactArea} onChange={(e)=>setExactArea(e.target.value)}>
            {EXACT_AREAS.map(a => <option key={a}>{a}</option>)}
            <option>--custom--</option>
          </select>
        </div>

        <div className="col-span-2 md:col-span-2">
          <label className="text-xs">Remarks</label>
          <input className="w-full p-2 border rounded" value={remarks} onChange={(e)=>setRemarks(e.target.value)} />
        </div>

        <div className="flex items-end gap-2">
          <button onClick={handleAddArea} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Add Area</button>
          <button onClick={() => {fetchTable(); setMsg("");}} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Search by Serial / Show</button>
          <button onClick={() => {clearForm(); setMsg("");}} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Clear / Refresh</button>
        </div>
      </div>

      {/* Parameter inputs + CT blowdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          {PARAMETERS.slice(0, Math.ceil(PARAMETERS.length/3)).map(p => (
            <div key={p.key}>
              <label className="text-xs">{p.label}</label>
              <input type="number" step="any" className="w-full p-2 border rounded" value={values[p.key]} onChange={(e)=>updateValue(p.key, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {PARAMETERS.slice(Math.ceil(PARAMETERS.length/3), 2*Math.ceil(PARAMETERS.length/3)).map(p => (
            <div key={p.key}>
              <label className="text-xs">{p.label}</label>
              <input type="number" step="any" className="w-full p-2 border rounded" value={values[p.key]} onChange={(e)=>updateValue(p.key, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {PARAMETERS.slice(2*Math.ceil(PARAMETERS.length/3)).map(p => (
            <div key={p.key}>
              <label className="text-xs">{p.label}</label>
              <input type="number" step="any" className="w-full p-2 border rounded" value={values[p.key]} onChange={(e)=>updateValue(p.key, e.target.value)} />
            </div>
          ))}

          <div className="mt-2 p-2 border rounded">
            <label className="text-xs block mb-1">CT Blow Down</label>
            <div className="flex gap-2 items-center mb-2">
              <input type="number" step="any" className="p-2 border rounded w-24" placeholder="%" value={ctBdPercent} onChange={(e)=>setCtBdPercent(e.target.value)} />
              <div>
                <label className="text-xs mr-2"><input type="radio" checked={ctBdStatus==="open"} onChange={()=>setCtBdStatus("open")} /> CT BD Open</label>
                <label className="text-xs ml-2"><input type="radio" checked={ctBdStatus==="close"} onChange={()=>setCtBdStatus("close")} /> CT BD Close</label>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <div>
                <label className="text-xs">Opening</label>
                <input type="time" className="p-2 border rounded" value={ctOpening} onChange={(e)=>setCtOpening(e.target.value)} />
              </div>
              <div>
                <label className="text-xs">Closing</label>
                <input type="time" className="p-2 border rounded" value={ctClosing} onChange={(e)=>setCtClosing(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save block */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={save} disabled={saving} className={`px-4 py-2 rounded text-white ${saving ? "bg-gray-400" : "bg-orange-600 hover:bg-orange-700"}`}>{saving ? "Saving..." : "Save"}</button>
        <div className="text-green-700">{msg}</div>
      </div>

      {/* Table - horizontally scrollable */}
      <h3 className="font-semibold mt-4 mb-2">Click the grid to select for editing / updating</h3>

      <div className="overflow-auto border rounded">
        <table className="min-w-max text-sm">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="border px-2 py-1">Sl</th>
              <th className="border px-2 py-1">Plant</th>
              <th className="border px-2 py-1">Broad Area</th>
              <th className="border px-2 py-1">Main Area</th>
              <th className="border px-2 py-1">Main Collection</th>
              <th className="border px-2 py-1">Exact Collection</th>
              <th className="border px-2 py-1">Time</th>
              {PARAMETERS.map(p => <th key={p.key} className="border px-2 py-1">{p.label}</th>)}
              <th className="border px-2 py-1">Remarks</th>
            </tr>
          </thead>

          <tbody>
            {loadingTable ? (
              <tr><td colSpan={10+PARAMETERS.length} className="p-4 text-center">Loading...</td></tr>
            ) : tableRows.length === 0 ? (
              <tr><td colSpan={10+PARAMETERS.length} className="p-4 text-center text-gray-500">No data</td></tr>
            ) : tableRows.map((r, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50 cursor-pointer">
                <td className="border px-2 py-1">{idx+1}</td>
                <td className="border px-2 py-1">{r.plant}</td>
                <td className="border px-2 py-1">{r.broad_area}</td>
                <td className="border px-2 py-1">{r.main_area}</td>
                <td className="border px-2 py-1">{r.main_collection_area}</td>
                <td className="border px-2 py-1">{r.exact_collection_area}</td>
                <td className="border px-2 py-1">{r.time}</td>
                {PARAMETERS.map(p => <td key={p.key} className="border px-2 py-1">{r.params?.[p.key] ?? "-"}</td>)}
                <td className="border px-2 py-1">{r.remarks ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
