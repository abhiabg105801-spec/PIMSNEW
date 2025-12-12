// src/pages/UniversalPIMSPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FORMS, { MODULE_KEYS } from "../config/dm_config";

const API = "/api/dm";
const DEFAULT_CFG = { label: "", params: [], locations: [], main_area_options: [], exact_options: [], plant: "", broad_area: "", main_collection_area: "" };

export default function UniversalPIMSPage({ auth }) {
  // top
  const [sampleNo, setSampleNo] = useState("");
  const [dateSampling, setDateSampling] = useState(new Date().toISOString().slice(0,10));
  const [timeSampling, setTimeSampling] = useState(new Date().toTimeString().slice(0,8));
  const [shift, setShift] = useState("Morning");
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0,10));

  // left/mid
  const [module, setModule] = useState((MODULE_KEYS && MODULE_KEYS[0]) || "");
  const [plant, setPlant] = useState("");
  const [broadArea, setBroadArea] = useState("");
  const [mainArea, setMainArea] = useState("");
  const [mainCollection, setMainCollection] = useState("");
  const [exactArea, setExactArea] = useState("");
  const [analysisType, setAnalysisType] = useState("Proximate");
  const [sendingAuthority, setSendingAuthority] = useState("Self");

  // right/analysis values
  const [values, setValues] = useState({});
  const [matrix, setMatrix] = useState({}); // for matrix modules
  const [remarks, setRemarks] = useState("");

  // table + states
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const api = useMemo(() => axios.create({
    baseURL: API,
    headers: { Authorization: auth || (localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "") }
  }), [auth]);

  // safe config for module
  const cfg = FORMS[module] || DEFAULT_CFG;

  // default proximate fields (in case module doesn't define)
  const PROXIMATE_PARAMS = [
    { key: "total_moisture", label: "Total Moisture (%)" },
    { key: "ash", label: "Ash (%)" },
    { key: "vm", label: "Volatile Matter (%)" },
    { key: "fixed_carbon", label: "Fixed Carbon (%)" },
    { key: "gcv", label: "GCV (Kcal/kg)" },
    { key: "uhv", label: "UHV (Kcal/kg)" },
    { key: "plus_25mm", label: "Plus 25 mm Size" },
  ];

  // initialize when module/date change
  useEffect(() => {
    const c = FORMS[module] || DEFAULT_CFG;

    setPlant(c.plant || "");
    setBroadArea(c.broad_area || c.broadArea || "");
    setMainArea((c.main_area_options && c.main_area_options[0]) || "");
    setMainCollection(c.main_collection_area || "");
    setExactArea((c.exact_options && c.exact_options[0]) || "");
    setRemarks("");

    // values
    const usedParams = (c.params && c.params.length) ? c.params : PROXIMATE_PARAMS;
    setValues(Object.fromEntries(usedParams.map(p => [p.key, ""])));

    // matrix skeleton (if any)
    const m = {};
    (c.params || []).forEach(p => {
      m[p.key] = {};
      (c.locations || []).forEach(loc => m[p.key][loc] = "");
    });
    setMatrix(m);

    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, dateSampling, analysisDate]);

  const updateValue = (k, v) => setValues(prev => ({ ...prev, [k]: v }));
  const updateMatrixCell = (p, loc, v) => setMatrix(prev => ({ ...prev, [p]: {...(prev[p]||{}), [loc]: v} }));

  // fetch records (raw) and aggregated stats
  async function fetchRecords() {
    setLoading(true);
    try {
      // try /raw first (not guaranteed), otherwise /report
      let raw = [];
      try {
        const rr = await api.get("/raw", { params: { date: dateSampling, module } });
        raw = Array.isArray(rr.data) ? rr.data : (rr.data.rows || []);
      } catch (e) {
        raw = [];
      }
      setRecords(raw);

      const r = await api.get("/report", { params: { date: dateSampling, module } });
      setStats(r.data.stats || []);
    } catch (err) {
      console.error(err);
      setRecords([]);
      setStats([]);
    } finally {
      setLoading(false);
    }
  }

  // build payload and send
  const save = async () => {
    const c = FORMS[module] || DEFAULT_CFG;
    // matrix flow for chemical_matrix (legacy)
    if ((c.locations || []).length > 1 && module === "chemical_matrix") {
      setSaving(true);
      try {
        for (const loc of (c.locations || [])) {
          const entries = (c.params || []).filter(p => {
            const v = matrix?.[p.key]?.[loc];
            return v !== undefined && v !== "" && !isNaN(Number(v));
          }).map(p => ({ parameter: p.key, value: Number(matrix?.[p.key]?.[loc]), remarks }));

          if (entries.length === 0) continue;

          await api.post("/add", {
            date: dateSampling, time: timeSampling, module,
            plant, broad_area: broadArea, main_area: mainArea, main_collection_area: mainCollection,
            exact_collection_area: loc, category: c.label, location: loc, entries
          });
        }
        alert("Saved matrix entries");
        fetchRecords();
      } catch (err) {
        console.error(err);
        alert(err?.response?.data?.detail || "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    // single-location
    const usedParams = (c.params && c.params.length) ? c.params : PROXIMATE_PARAMS;
    const entries = usedParams.map(p => ({ parameter: p.key, value: values[p.key] === "" ? null : Number(values[p.key]), remarks }))
      .filter(e => e.value !== null && e.value !== undefined && !Number.isNaN(e.value));

    if (entries.length === 0) return alert("Enter at least one value");

    setSaving(true);
    try {
      await api.post("/add", {
        date: dateSampling, time: timeSampling, module,
        plant, broad_area: broadArea, main_area: mainArea, main_collection_area: mainCollection,
        exact_collection_area: exactArea, category: c.label, location, entries
      });
      alert("Saved");
      fetchRecords();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // load a record into form on click
  const handleRowClick = (row) => {
    if (!row) return;
    try {
      if (row.time) setTimeSampling(String(row.time).slice(0,8));
      if (row.plant) setPlant(row.plant);
      if (row.main_collection_area) setMainCollection(row.main_collection_area);
      if (row.exact_collection_area) setExactArea(row.exact_collection_area);
      if (row.remarks) setRemarks(row.remarks);

      if (row.params && typeof row.params === "object") {
        const newVals = {...values};
        Object.keys(row.params).forEach(k => { if (newVals.hasOwnProperty(k)) newVals[k] = row.params[k]; });
        setValues(newVals);
        return;
      }

      if (row.parameter) {
        setValues(prev => ({ ...prev, [row.parameter]: row.value ?? "" }));
      }
    } catch (e) {
      console.error("load row", e);
    }
  };

  // Download PDF
  const downloadPdf = () => {
    const url = `/api/dm/report/pdf?date=${encodeURIComponent(dateSampling)}&module=${encodeURIComponent(module)}`;
    window.open(url, "_blank");
  };

  // placeholder actions
  const calculateGcvUhv = () => alert("GCV/UHV calculation disabled (per config).");
  const deleteBySr = () => alert("Delete by Sr - implement backend endpoint.");
  const changeStatusByDate = () => alert("Change Status by Date - implement backend endpoint.");
  const approve = () => alert("Approve - implement backend endpoint.");
  const unapprove = () => alert("Unapprove - implement backend endpoint.");

  // render helpers
  const usedParams = (cfg.params && cfg.params.length) ? cfg.params : PROXIMATE_PARAMS;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-screen-xl mx-auto space-y-4 text-sm">

        {/* TOP HORIZONTAL PANEL */}
        <div className="bg-white border rounded shadow p-3 grid grid-cols-12 gap-3 items-center">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Sample No.</label>
            <input value={sampleNo} onChange={e=>setSampleNo(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Date of Sampling</label>
            <input type="date" value={dateSampling} onChange={e=>setDateSampling(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Time of Sampling</label>
            <input type="time" value={timeSampling} onChange={e=>setTimeSampling(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Shift</label>
            <select value={shift} onChange={e=>setShift(e.target.value)} className="w-full p-2 border rounded">
              <option>Morning</option><option>Evening</option><option>Night</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Date of Analysis</label>
            <input type="date" value={analysisDate} onChange={e=>setAnalysisDate(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="col-span-2 text-right">
            <div className="text-xs text-gray-500">Module</div>
            <select value={module} onChange={e=>setModule(e.target.value)} className="p-2 border rounded">
              {(MODULE_KEYS || []).map(k => <option key={k} value={k}>{FORMS[k]?.label ?? k}</option>)}
            </select>
          </div>
        </div>

        {/* MIDDLE PANELS (LEFT: Location & Equipment, RIGHT: Analysis Data) */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-white border rounded shadow p-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Location & Equipment</h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">Plant</label>
                  <input value={plant} onChange={e=>setPlant(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Broad Area</label>
                  <input value={broadArea} onChange={e=>setBroadArea(e.target.value)} className="w-full p-2 border rounded" />
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Main Area</label>
                  { (cfg.main_area_options || []).length > 0 ?
                    (<select value={mainArea} onChange={e=>setMainArea(e.target.value)} className="w-full p-2 border rounded">
                      {(cfg.main_area_options||[]).map(x => <option key={x} value={x}>{x}</option>)}
                    </select>)
                    :
                    (<input value={mainArea} onChange={e=>setMainArea(e.target.value)} className="w-full p-2 border rounded" />)
                  }
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Main Collection Area</label>
                  <input value={mainCollection} onChange={e=>setMainCollection(e.target.value)} className="w-full p-2 border rounded" />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-500">Exact Collection Area / Sample Point</label>
                  { (cfg.exact_options || []).length > 0 ? (
                    <select value={exactArea} onChange={e=>setExactArea(e.target.value)} className="w-full p-2 border rounded">
                      {(cfg.exact_options||[]).map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  ) : (
                    <input value={exactArea} onChange={e=>setExactArea(e.target.value)} className="w-full p-2 border rounded" />
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Analysis Type</label>
                  <input value={analysisType} onChange={e=>setAnalysisType(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Sending Authority</label>
                  <input value={sendingAuthority} onChange={e=>setSendingAuthority(e.target.value)} className="w-full p-2 border rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-white border rounded shadow p-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">ANALYSIS DATA</h3>

              <div className="grid grid-cols-2 gap-2">
                {(usedParams || []).slice(0,4).map(p => (
                  <div key={p.key}>
                    <label className="block text-xs text-gray-500">{p.label}</label>
                    <input type="number" step="any" value={values[p.key] ?? ""} onChange={e=>updateValue(p.key, e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                ))}

                {(usedParams || []).slice(4).map(p => (
                  <div key={p.key}>
                    <label className="block text-xs text-gray-500">{p.label}</label>
                    <input type="number" step="any" value={values[p.key] ?? ""} onChange={e=>updateValue(p.key, e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                ))}

                <div className="col-span-2">
                  <label className="block text-xs text-gray-500">Remarks</label>
                  <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} className="w-full p-2 border rounded h-24"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HORIZONTAL TOOLBAR */}
        <div className="bg-black text-white rounded shadow px-3 py-2 flex flex-wrap gap-2 items-center">
          <button onClick={deleteBySr} className="bg-red-400 px-3 py-1 rounded text-sm">Delete by Sr</button>
          <button onClick={save} className="bg-orange-500 px-3 py-1 rounded text-sm">{saving ? "Saving..." : "Save"}</button>
          <button onClick={fetchRecords} className="bg-gray-200 text-black px-3 py-1 rounded text-sm">Search By Sr</button>
          <button onClick={downloadPdf} className="bg-gray-200 text-black px-3 py-1 rounded text-sm">Report</button>
          <button onClick={()=>{ setValues({}); setRemarks(""); }} className="bg-gray-200 text-black px-3 py-1 rounded text-sm">Clear / Refresh</button>
          <button onClick={calculateGcvUhv} className="bg-gray-200 text-black px-3 py-1 rounded text-sm">Calculate GCV & UHV</button>

          <div className="ml-auto flex gap-2">
            <button onClick={changeStatusByDate} className="bg-pink-400 px-3 py-1 rounded text-sm">Change Status by Date</button>
            <button onClick={approve} className="bg-green-500 px-3 py-1 rounded text-sm">Approve</button>
            <button onClick={unapprove} className="bg-gray-300 px-3 py-1 rounded text-sm">Unapprove</button>
          </div>
        </div>

        {/* DATA TABLE SECTION */}
        <div className="bg-white border rounded shadow p-3">
          <h4 className="text-sm font-semibold mb-2">Click the grid to select for editing / updating</h4>

          {loading ? (
            <div className="text-center py-6 text-gray-500">Loading...</div>
          ) : (records && records.length > 0) ? (
            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {Object.keys(records[0] || {}).slice(0, 12).map(k => <th key={k} className="p-2 text-left">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r,i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-orange-50 cursor-pointer" onClick={()=>handleRowClick(r)}>
                      {Object.keys(records[0] || {}).slice(0,12).map(k => <td key={k} className="p-2 text-xs">{String(r[k] ?? "-")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (stats && Object.keys(stats).length > 0) ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Parameter</th>
                    <th className="p-2 text-right">Avg</th>
                    <th className="p-2 text-right">Min</th>
                    <th className="p-2 text-right">Max</th>
                    <th className="p-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats).map(([k,v],i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{k}</td>
                      <td className="p-2 text-right">{v.avg ?? "-"}</td>
                      <td className="p-2 text-right">{v.min ?? "-"}</td>
                      <td className="p-2 text-right">{v.max ?? "-"}</td>
                      <td className="p-2 text-right">{v.count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">No records found</div>
          )}
        </div>

        {/* BOTTOM CALC PANEL */}
        <div className="bg-white border rounded shadow p-3 space-y-3">
          <h4 className="text-sm font-semibold">Unit & Mill Calculations</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600 mb-2">Unit #1 Mills</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="p-2 border rounded text-sm" placeholder="Mill A" />
                <input className="p-2 border rounded text-sm" placeholder="Mill B" />
                <input className="p-2 border rounded text-sm" placeholder="Mill C" />
                <input className="p-2 border rounded text-sm" placeholder="Mill D" />
              </div>
            </div>

            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600 mb-2">Weighted / Coal / GCV</div>
              <div className="space-y-2 text-sm">
                <div>Weighted Average GCV of Unit #1: <strong className="text-orange-600">-</strong></div>
                <div>Weighted Average GCV of Unit #2: <strong className="text-orange-600">-</strong></div>
                <div>Coal (T): <strong>-</strong></div>
              </div>
            </div>

            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600 mb-2">Generation / Heat Rate</div>
              <div className="space-y-2 text-sm">
                <div>Average GCV: <strong>-</strong></div>
                <div>Generation MWH: <strong>-</strong></div>
                <div>Heat Rate Kcal/KWh: <strong>-</strong></div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">Presented by Operation Dept., CPP</div>
        </div>
      </div>
    </div>
  );
}
