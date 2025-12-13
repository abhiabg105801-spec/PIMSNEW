// ======================================================================
// UNIVERSAL PIMS PAGE — FINAL COMPLETE FILE
// Light UI • Update Mode (U1) • Raw Table • Sample No (SN1)
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PIMS_CONFIG from "../config/pims_config";
import {
  Save, RefreshCw, FileText, Activity, Clock, MapPin,
  Database, Layers, Settings, Trash2
} from "lucide-react";

// ======================================================================
// INPUT COMPONENT (LIGHT THEME)
// ======================================================================
const PimsInput = ({ label, type="text", value, onChange, options=[], readOnly=false }) => {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">
        {label}
      </label>

      {type === "textarea" ? (
        <textarea
          rows={2}
          readOnly={readOnly}
          value={value}
          onChange={onChange}
          className={`w-full bg-zinc-50 border border-zinc-300 text-zinc-800 text-sm px-3 py-2 
            rounded-sm outline-none focus:border-orange-500 
            ${readOnly ? "bg-zinc-100 cursor-not-allowed" : ""}`}
        />
      ) : type === "select" ? (
        <select
          value={value}
          disabled={readOnly}
          onChange={onChange}
          className={`w-full bg-zinc-50 border border-zinc-300 text-zinc-800 text-sm px-3 py-2 
            rounded-sm outline-none focus:border-orange-500
            ${readOnly ? "bg-zinc-100 cursor-not-allowed" : ""}`}
        >
          <option value="">-- Select --</option>
          {options.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          readOnly={readOnly}
          value={value}
          onChange={onChange}
          className={`w-full bg-zinc-50 border border-zinc-300 text-zinc-800 text-sm px-3 py-2 
            rounded-sm outline-none focus:border-orange-500
            ${readOnly ? "bg-zinc-100 cursor-not-allowed" : ""}`}
        />
      )}
    </div>
  );
};

// ======================================================================
// SECTION HEADER
// ======================================================================
const SectionHeader = ({ title, icon: Icon, subTitle }) => (
  <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 bg-white">
    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md border border-orange-100">
      {Icon && <Icon size={18} />}
    </div>
    <div>
      <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">{title}</h3>
      {subTitle && <p className="text-[10px] text-zinc-400 font-medium">{subTitle}</p>}
    </div>
  </div>
);

// ======================================================================
// MAIN PAGE COMPONENT
// ======================================================================
export default function UniversalPIMSPage({ auth }) {

  // -----------------------------------------
  // MODULE & FORM STATES
  // -----------------------------------------
  const MODULES = Object.keys(PIMS_CONFIG);
  const [module, setModule] = useState(MODULES[0]);
  const config = PIMS_CONFIG[module];

  const [formData, setFormData] = useState({});
  const [matrixData, setMatrixData] = useState({});
  const [sampleNo, setSampleNo] = useState("");
  const [updateMode, setUpdateMode] = useState(false);

  // Raw table
  const [rawRows, setRawRows] = useState([]);
  const [loadingRaw, setLoadingRaw] = useState(false);

  // Save/Update
  const [saving, setSaving] = useState(false);

  // -----------------------------------------
  // AXIOS
  // -----------------------------------------
  const api = useMemo(() => {
    return axios.create({
      baseURL: "/api/dm",
      headers: {
        Authorization: auth || localStorage.getItem("authToken")
          ? `Bearer ${localStorage.getItem("authToken")}`
          : "",
      },
    });
  }, [auth]);

  // ======================================================================
  // INITIALIZE FORM WHEN MODULE CHANGES
  // ======================================================================
  useEffect(() => {
    initForm();
  }, [module]);

  const initForm = () => {
    setSampleNo("");
    setUpdateMode(false);

    let tmp = {};
    const now = new Date();
    const d = now.toISOString().slice(0, 10);
    const t = now.toTimeString().slice(0, 5);

    config.topPanel?.forEach(f => {
      if (f.type === "date") tmp[f.key] = d;
      else if (f.type === "time") tmp[f.key] = t;
      else tmp[f.key] = "";
    });

    config.locationPanel?.forEach(f => (tmp[f.key] = ""));
    config.parameterPanels?.forEach(p => p.fields.forEach(f => (tmp[f.key] = "")));
    config.bottomPanel?.fields?.forEach(f => (tmp[f.key] = ""));

    setFormData(tmp);

    // Matrix
    if (config.matrix) {
      const m = {};
      config.matrix.params.forEach(p => {
        m[p.key] = {};
        config.matrix.locations.forEach(loc => (m[p.key][loc] = ""));
      });
      setMatrixData(m);
    } else setMatrixData({});

    fetchRaw(d);
  };

  // ======================================================================
  // FETCH RAW TABLE
  // ======================================================================
  const fetchRaw = async (dateOverride = null) => {
    setLoadingRaw(true);
    try {
      const dKey = config.topPanel.find(f => f.type === "date")?.key;
      const d = dateOverride || formData[dKey];

      const res = await api.get("/raw", {
        params: { module, date: d }
      });

      setRawRows(res.data.rows || []);
    } catch {
      setRawRows([]);
    }
    setLoadingRaw(false);
  };

  // ======================================================================
  // HELPERS
  // ======================================================================
  const setField = (key, val) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  const setMatrix = (param, loc, val) =>
    setMatrixData(prev => ({
      ...prev,
      [param]: { ...prev[param], [loc]: val },
    }));

  // ======================================================================
  // SAVE ENTRY
  // ======================================================================
  const saveEntry = async () => {
    setSaving(true);

    try {
      const payload = buildPayload();
      const res = await api.post("/add", payload);

      alert(`Saved. Sample No: ${res.data.sample_no}`);

      initForm();
    } catch (err) {
      alert(err?.response?.data?.detail || "Save failed");
    }

    setSaving(false);
  };

  // ======================================================================
  // LOAD SAMPLE GROUP FOR EDITING
  // ======================================================================
  const loadSample = async (sn) => {
    try {
      const res = await api.get("/entry", { params: { sample_no: sn } });
      const rows = res.data.rows;

      setSampleNo(sn);
      setUpdateMode(true);

      let tmp = {};
      rows.forEach(r => {
        tmp.date = r.date;
        tmp.time = r.time;
        tmp.plant = r.plant;
        tmp.broad_area = r.broad_area;
        tmp.main_area = r.main_area;
        tmp.main_collection_area = r.main_collection_area;
        tmp.exact_collection_area = r.exact_collection_area;
        tmp.location = r.location;
        tmp[r.parameter] = r.value ?? "";
      });

      setFormData(tmp);
    } catch {
      alert("Failed to load sample.");
    }
  };

  // ======================================================================
  // UPDATE SAMPLE
  // ======================================================================
  const updateSample = async () => {
    if (!sampleNo) return alert("No sample selected");

    setSaving(true);
    try {
      const payload = buildPayload();
      payload.sample_no = sampleNo;

      const res = await api.post("/update", payload);

      alert(`Updated successfully: ${res.data.sample_no}`);
      initForm();
    } catch (err) {
      alert(err?.response?.data?.detail || "Update failed");
    }
    setSaving(false);
  };

  // ======================================================================
  // DELETE SAMPLE
  // ======================================================================
  const deleteSample = async () => {
    if (!sampleNo) return;
    if (!window.confirm(`Delete Sample No ${sampleNo}?`)) return;

    try {
      await api.delete("/delete", { params: { sample_no: sampleNo } });
      alert("Deleted.");
      initForm();
    } catch {
      alert("Delete failed");
    }
  };

  // ======================================================================
  // BUILD PAYLOAD
  // ======================================================================
  const buildPayload = () => {
    const payload = {
      module,
      ...formData,
      entries: []
    };

    if (!config.matrix) {
      config.parameterPanels?.forEach(panel =>
        panel.fields.forEach(f => {
          if (formData[f.key] !== "")
            payload.entries.push({
              parameter: f.key,
              value: Number(formData[f.key])
            });
        })
      );

      config.bottomPanel?.fields?.forEach(f => {
        if (formData[f.key] !== "")
          payload.entries.push({
            parameter: f.key,
            value: Number(formData[f.key])
          });
      });
    }

    return payload;
  };

  // ======================================================================
  // RENDER
  // ======================================================================
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-zinc-800 p-6 pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white 
                      px-6 py-5 rounded-lg shadow-sm border border-zinc-200">

        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-white border border-zinc-200 
                          flex items-center justify-center text-orange-600 shadow-sm">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">
              Lab<span className="text-orange-600">Entry</span>
            </h1>
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Universal PIMS Portal
            </p>
          </div>
        </div>

        {/* MODULE SELECT */}
        <div className="flex items-center bg-zinc-50 p-1.5 rounded-lg border border-zinc-200">
          <span className="px-3 text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
            <Settings size={12} /> Module:
          </span>

          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="bg-white text-zinc-800 text-sm font-bold py-2 pl-3 pr-8 rounded-md 
                     outline-none border border-zinc-200 hover:bg-zinc-50"
          >
            {MODULES.map(m => (
              <option key={m} value={m}>{PIMS_CONFIG[m].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-[1900px] mx-auto space-y-6">

        {/* CONTEXT BAR */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200">
          <SectionHeader title="Log Context" icon={Clock} />
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {config.topPanel.map(f => (
              <PimsInput
                key={f.key}
                {...f}
                value={formData[f.key] || ""}
                onChange={e => setField(f.key, e.target.value)}
              />
            ))}
          </div>
        </div>

        {/* LOCATION BAR */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-orange-600" />
              <h3 className="text-sm font-bold uppercase text-zinc-800">Location Details</h3>
            </div>

            {/* SAVE OR UPDATE BUTTON */}
            {!updateMode ? (
              <button
                onClick={saveEntry}
                className="bg-orange-600 text-white px-6 py-2 rounded shadow hover:bg-orange-700 flex items-center gap-2"
              >
                <Save size={16} /> Save Entry
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={deleteSample}
                  className="bg-red-600 text-white px-6 py-2 rounded shadow hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete
                </button>
                <button
                  onClick={updateSample}
                  className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save size={16} /> Update
                </button>
              </div>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {config.locationPanel.map(f => (
              <PimsInput
                key={f.key}
                {...f}
                value={formData[f.key] || ""}
                onChange={e => setField(f.key, e.target.value)}
              />
            ))}
          </div>
        </div>

        {/* PARAMETER PANELS */}
        {!config.matrix &&
          config.parameterPanels.map((panel, idx) => (
            <div key={idx} className="bg-white border border-zinc-200 shadow-sm rounded-lg">
              <SectionHeader title={panel.title} icon={Database} />
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {panel.fields.map(f => (
                  <PimsInput
                    key={f.key}
                    {...f}
                    value={formData[f.key] || ""}
                    onChange={e => setField(f.key, e.target.value)}
                  />
                ))}
              </div>
            </div>
          ))
        }

        {/* MATRIX PANEL */}
        {config.matrix && (
          <div className="bg-white border border-zinc-200 shadow-sm rounded-lg">
            <SectionHeader title={config.label} icon={Layers} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-t border-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-600 text-[11px] uppercase">
                    <th className="px-4 py-2 border-r">Parameter</th>
                    {config.matrix.locations.map(loc => (
                      <th key={loc} className="px-4 py-2 border-r">{loc}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.matrix.params.map(p => (
                    <tr key={p.key} className="border-t hover:bg-orange-50">
                      <td className="px-4 py-2 font-semibold border-r">{p.label}</td>
                      {config.matrix.locations.map(loc => (
                        <td key={loc} className="p-0 border-r">
                          <input
                            type="number"
                            value={matrixData[p.key]?.[loc] || ""}
                            onChange={e => setMatrix(p.key, loc, e.target.value)}
                            className="w-full px-2 h-[40px] text-center border-none outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOTTOM PANEL */}
        {config.bottomPanel && (
          <div className="bg-white border border-zinc-200 shadow-sm rounded-lg">
            <SectionHeader title={config.bottomPanel.title} icon={Layers} />
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {config.bottomPanel.fields.map(field => (
                <PimsInput
                  key={field.key}
                  {...field}
                  value={formData[field.key] || ""}
                  onChange={e => setField(field.key, e.target.value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* RAW TABLE */}
        <div className="bg-white border border-zinc-200 shadow-sm rounded-lg">
          
          <div className="px-6 py-4 border-b flex justify-between bg-zinc-50">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              <h3 className="text-sm font-bold uppercase">Raw Entries (Click to Edit)</h3>
            </div>

            <button
              onClick={() => fetchRaw()}
              className="flex items-center gap-2 px-3 py-1 text-xs border rounded hover:text-orange-600"
            >
              <RefreshCw size={14} className={loadingRaw ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="min-w-full text-xs">
              <thead className="bg-zinc-100 text-zinc-500">
                <tr>
                  <th className="px-6 py-3 border-b">Sample No</th>
                  <th className="px-6 py-3 border-b">Time</th>
                  <th className="px-6 py-3 border-b">Parameter</th>
                  <th className="px-6 py-3 border-b text-right">Value</th>
                  <th className="px-6 py-3 border-b">Location</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {rawRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-zinc-400 italic">
                      No records found
                    </td>
                  </tr>
                ) : (
                  rawRows.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-orange-50 cursor-pointer"
                      onClick={() => loadSample(r.sample_no)}
                    >
                      <td className="px-6 py-3">{r.sample_no}</td>
                      <td className="px-6 py-3">{r.time}</td>
                      <td className="px-6 py-3">{r.parameter}</td>
                      <td className="px-6 py-3 text-right">{r.value ?? "-"}</td>
                      <td className="px-6 py-3">{r.location ?? "-"}</td>
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
