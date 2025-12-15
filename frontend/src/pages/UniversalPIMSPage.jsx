// ======================================================================
// UNIVERSAL PIMS PAGE — ROBUST FIXED LAYOUT (FIXED SIDEBAR + MARGIN)
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import PIMS_CONFIG from "../config/pims_config";
import {
  Save,
  RefreshCw,
  Trash2,
  Copy,
  FileText,
  Activity,
  Clock,
  MapPin,
  Database,
  Settings,
  Download,
  ChevronRight,
  Menu,
} from "lucide-react";

/* ================= STYLISH TABLE ROW INPUT ================= */
// Transforms standard inputs into a "Label | Input" table row style
const PimsTableInput = ({
  label,
  type = "text",
  value,
  onChange,
  options = [],
  isLast,
}) => (
  <div
    className={`flex group items-stretch ${
      !isLast ? "border-b border-zinc-200" : ""
    }`}
  >
    {/* Left Label Side */}
    <div className="w-[140px] shrink-0 bg-zinc-50 border-r border-zinc-200 px-3 py-2 flex items-center">
      <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wide leading-tight">
        {label}
      </span>
    </div>

    {/* Right Input Side */}
    <div className="flex-1 bg-white relative">
      {type === "select" ? (
        <select
          value={value ?? ""}
          onChange={onChange}
          className="w-full h-full px-3 py-2 text-sm text-zinc-800 bg-transparent outline-none
                      focus:bg-orange-50 focus:text-orange-900 transition-colors"
        >
          <option value="">-- Select --</option>
          {options.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={onChange}
          className="w-full h-full px-3 py-2 text-sm text-zinc-800 bg-transparent outline-none
                      focus:bg-orange-50 focus:text-orange-900 transition-colors
                      placeholder-zinc-300"
          placeholder="..."
        />
      )}
    </div>
  </div>
);

/* ================= SECTION HEADER ================= */
const SectionHeader = ({ title, icon: Icon, right }) => (
  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 bg-white border border-zinc-200 shadow-sm text-orange-600 rounded-md">
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <h3 className="text-xs font-bold uppercase text-zinc-700 tracking-wider">
        {title}
      </h3>
    </div>
    {right}
  </div>
);

/* ================= RAW HELPERS ================= */
const pivotRawData = (rows) => {
  const params = new Set();
  const map = {};

  rows.forEach((r) => {
    params.add(r.parameter);
    if (!map[r.sample_no]) {
      map[r.sample_no] = {
        sample_no: r.sample_no,
        date: r.date,
        time: r.time?.slice(0, 5),
        plant: r.plant,
        main_area: r.main_area,
        location: r.location,
      };
    }
    map[r.sample_no][r.parameter] = r.value;
  });

  return { columns: [...params], data: Object.values(map) };
};

const calcStats = (data, cols) => {
  const stats = {};
  cols.forEach((c) => {
    const nums = data.map((r) => Number(r[c])).filter((v) => !isNaN(v));
    stats[c] = {
      avg: nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : "",
      min: nums.length ? Math.min(...nums) : "",
      max: nums.length ? Math.max(...nums) : "",
    };
  });
  return stats;
};

/* ================= MAIN COMPONENT ================= */
export default function UniversalPIMSPage({ auth }) {
  const MODULE_KEYS = Object.keys(PIMS_CONFIG);
  const [module, setModule] = useState(MODULE_KEYS[0]);
  const config = PIMS_CONFIG[module];

  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({});
  const [rawRows, setRawRows] = useState([]);
  const [sampleNo, setSampleNo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [visibleCols, setVisibleCols] = useState({});
  const [showCols, setShowCols] = useState(false);
  const [matrixData, setMatrixData] = useState({});
  /* ================= API ================= */
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "/api/dm",
        headers: {
          Authorization:
            auth || localStorage.getItem("authToken")
              ? `Bearer ${localStorage.getItem("authToken")}`
              : "",
        },
      }),
    [auth]
  );

  /* ================= INIT ================= */
  useEffect(() => {
    initForm();
    // eslint-disable-next-line
  }, [module]);

  const initForm = () => {
    setEditMode(false);
    setSampleNo(null);

    const now = new Date();
    const fd = {};

    config.topPanel?.forEach((f) => {
      fd[f.key] =
        f.type === "date"
          ? now.toISOString().slice(0, 10)
          : f.type === "time"
          ? now.toTimeString().slice(0, 5)
          : "";
    });

    config.locationPanel?.forEach((f) => (fd[f.key] = ""));
    config.parameterPanels?.forEach((p) =>
      p.fields.forEach((f) => (fd[f.key] = ""))
    );

    if (config.matrix) {
  const md = {};
  config.matrix.params.forEach((p) => {
    md[p.key] = {};
    config.matrix.locations.forEach((l) => {
      md[p.key][l] = "";
    });
  });
  setMatrixData(md);
} else {
  setMatrixData({});
}

    setFormData(fd);
    fetchRange();
  };

  /* ================= RAW DATA OPS ================= */
  const fetchRange = async () => {
    const res = await api.get("/raw-range", {
      params: { start: fromDate, end: toDate, module },
    });
    setRawRows(res.data.rows || []);
  };

  const copyPrevious = async () => {
    const last = await api.get("/last", { params: { module } });
    if (!last.data.sample_no) {
      alert("No previous entry found");
      return;
    }
    const res = await api.get("/entry", {
      params: { sample_no: last.data.sample_no },
    });
    const rows = res.data.rows;
    if (!rows?.length) return;

    const now = new Date();
    const fd = {};
    config.topPanel?.forEach((f) => {
      fd[f.key] =
        f.type === "date"
          ? now.toISOString().slice(0, 10)
          : f.type === "time"
          ? now.toTimeString().slice(0, 5)
          : "";
    });
    config.locationPanel?.forEach((f) => (fd[f.key] = rows[0][f.key] ?? ""));
    config.parameterPanels?.forEach((p) =>
      p.fields.forEach((f) => (fd[f.key] = ""))
    );
    rows.forEach((r) => (fd[r.parameter] = r.value ?? ""));

    setFormData(fd);
    setEditMode(false);
    setSampleNo(null);
    // Note: Scroll to top is handled by browser behavior or manual window.scrollTo
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      const dateValue =
        formData.sampling_date ?? formData.entry_date ?? formData.date;
      if (!dateValue) {
        alert("Date is required");
        setSaving(false);
        return;
      }
      const timeValue =
        formData.sampling_time ??
        formData.entry_time ??
        formData.time ??
        "00:00";

      const payload = {
        module,
        date: dateValue,
        time: timeValue,
        plant: formData.plant || null,
        broad_area: formData.broad_area || null,
        main_area: formData.main_area || null,
        main_collection_area: formData.main_collection_area || null,
        exact_collection_area:
          formData.exact_area || formData.exact_collection_area || null,
        location: formData.location || null,
        sample_no: editMode ? sampleNo : undefined,
        entries: [],
      };

      config.parameterPanels?.forEach((p) =>
        p.fields.forEach((f) => {
          const v = formData[f.key];
          if (v !== "" && v !== null && v !== undefined) {
            payload.entries.push({
              parameter: f.key,
              value: Number(v),
            });
          }
        })
      );

      

      if (config.matrix) {
  config.matrix.params.forEach((p) => {
    config.matrix.locations.forEach((loc) => {
      const v = matrixData[p.key]?.[loc];
      if (v !== "") {
        payload.entries.push({
          parameter: `${p.key}__${loc}`,
          value: Number(v),
        });
      }
    });
  });
}

if (payload.entries.length === 0) {
        alert("Enter at least one parameter value");
        setSaving(false);
        return;
      }

      if (editMode) {
        await api.post("/update", payload);
        alert("Sample updated successfully");
      } else {
        const res = await api.post("/add", payload);
        alert(`Saved successfully\nSample No: ${res.data.sample_no}`);
      }
      fetchRange();
      initForm();
    } catch (e) {
      console.error(e);
      alert("Save failed");
    }
    setSaving(false);
  };

  const loadSample = async (sn) => {
  const res = await api.get("/entry", { params: { sample_no: sn } });
  const rows = res.data.rows;
  if (!rows?.length) return;

  const first = rows[0];
  const fd = {};

  // ---------------- TOP PANEL ----------------
  config.topPanel?.forEach((f) => {
    fd[f.key] =
      f.type === "date"
        ? first.date
        : f.type === "time"
        ? first.time?.slice(0, 5)
        : first[f.key] ?? "";
  });

  // ---------------- LOCATION PANEL ----------------
  config.locationPanel?.forEach((f) => {
    fd[f.key] = first[f.key] ?? "";
  });

  // ---------------- PARAMETER PANELS (RESET) ----------------
  config.parameterPanels?.forEach((p) =>
    p.fields.forEach((f) => {
      fd[f.key] = "";
    })
  );

  // ---------------- MATRIX INIT (CRITICAL) ----------------
  let md = {};
  if (config.matrix) {
    config.matrix.params.forEach((p) => {
      md[p.key] = {};
      config.matrix.locations.forEach((loc) => {
        md[p.key][loc] = "";
      });
    });
  }

  // ---------------- LOAD VALUES ----------------
  rows.forEach((r) => {
    // 🔹 MATRIX PARAMETER (ph__Condensate)
    if (config.matrix && r.parameter.includes("__")) {
      const [paramKey, loc] = r.parameter.split("__");

      if (md[paramKey] && md[paramKey][loc] !== undefined) {
        md[paramKey][loc] = r.value ?? "";
      }
    }
    // 🔹 NORMAL PARAMETER
    else {
      fd[r.parameter] = r.value ?? "";
    }
  });

  // ---------------- APPLY STATE ----------------
  setFormData(fd);

  if (config.matrix) {
    setMatrixData(md);
  }

  setSampleNo(sn);
  setEditMode(true);
};


  const deleteSample = async (e, sn) => {
    e.stopPropagation();
    if (!window.confirm(`Delete sample ${sn}?`)) return;
    await api.delete("/delete", { params: { sample_no: sn } });
    fetchRange();
  };

  const { columns, data } = useMemo(() => pivotRawData(rawRows), [rawRows]);

  useEffect(() => {
    const init = {};
    columns.forEach((c) => (init[c] = true));
    setVisibleCols(init);
  }, [columns]);

  const shownCols = columns.filter((c) => visibleCols[c]);
  const stats = calcStats(data, shownCols);

  const exportCSV = () => {};
  const exportExcel = () => {};

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-800">
      
      {/* 1. LEFT SIDEBAR: FIXED POSITION 
        - 'fixed top-0 left-0 h-screen': This forces the sidebar to stay 
          anchored to the viewport even when the body scrolls.
      */}
      <div className="fixed top-19 left-0 w-60 h-screen bg-white border-r border-zinc-200 flex flex-col shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-50">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2 flex-shrink-0">
          <Menu className="text-orange-600" size={18} />
          <h2 className="text-sm font-black text-zinc-700 uppercase tracking-widest">
            PIMS Modules
          </h2>
        </div>

        {/* Sidebar Internal Scroll */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-zinc-200">
          {MODULE_KEYS.map((m) => (
            <button
              key={m}
              onClick={() => setModule(m)}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-between group ${
                module === m
                  ? "bg-gradient-to-r from-orange-50 to-white text-orange-700 border border-orange-200 shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 border border-transparent"
              }`}
            >
              <span>{PIMS_CONFIG[m].label}</span>
              {module === m && <ChevronRight size={14} />}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 text-[10px] text-center text-zinc-400 flex-shrink-0">
          PIMS System v2.0
        </div>
      </div>

      {/* 2. MAIN CONTENT WRAPPER 
        - 'ml-60': Pushes content to the right to clear the fixed sidebar.
        - 'flex flex-col min-h-screen': Ensures proper vertical stacking.
      */}
      <div className="ml-60 flex flex-col min-h-screen">
        
        {/* TOP BAR: STICKY 
          - 'sticky top-0': Ensures the header stays visible when scrolling down the page.
          - 'z-40': Keeps it above content but below sidebar (z-50).
        */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 shadow-sm flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg text-white shadow-md">
              <Activity size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-800 leading-none">
                Universal Entry
              </h1>
              <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">
                {PIMS_CONFIG[module].label}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyPrevious}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded border border-zinc-300 transition-colors"
            >
              <Copy size={14} /> Copy Prev
            </button>
            <button
              onClick={initForm}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded border border-zinc-300 transition-colors"
            >
              <RefreshCw size={14} /> Reset
            </button>
            <button
              onClick={saveEntry}
              disabled={saving}
              className={`flex items-center gap-1 px-4 py-1.5 text-white text-xs font-bold rounded shadow-md transition-transform active:scale-95 ${
                editMode
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              <Save size={14} />
              {editMode ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="p-6 space-y-6">
          {/* 3. LOG CONTEXT & LOCATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Log Context */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
              <SectionHeader title="Log Context" icon={Clock} />
              <div className="flex flex-col">
                {config.topPanel?.map((f, i, arr) => (
                  <PimsTableInput
                    key={f.key}
                    label={f.label}
                    value={formData[f.key]}
                    type={f.type || "text"}
                    isLast={i === arr.length - 1}
                    onChange={(e) =>
                      setFormData({ ...formData, [f.key]: e.target.value })
                    }
                  />
                ))}
              </div>
            </div>

            {/* Right: Location Details */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
              <SectionHeader title="Location Details" icon={MapPin} />
              <div className="flex flex-col">
                {config.locationPanel.map((f, idx) => (
                  <PimsTableInput
                    key={f.key}
                    label={f.label}
                    type={f.type}
                    options={f.options || []}
                    value={formData[f.key]}
                    isLast={idx === config.locationPanel.length - 1}
                    onChange={(e) =>
                      setFormData({ ...formData, [f.key]: e.target.value })
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* PARAMETER PANELS */}
          {config.parameterPanels?.map((p, i) => (
            <div
              key={i}
              className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden"
            >
              <SectionHeader title={p.title} icon={Database} />
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 lg:bg-zinc-50 border-t border-zinc-200">
                <div className="flex flex-col bg-white border-r-0 lg:border-r border-zinc-200">
                  {p.fields
                    .slice(0, Math.ceil(p.fields.length / 2))
                    .map((f, idx, subArr) => (
                      <PimsTableInput
                        key={f.key}
                        label={f.label}
                        value={formData[f.key]}
                        isLast={idx === subArr.length - 1}
                        onChange={(e) =>
                          setFormData({ ...formData, [f.key]: e.target.value })
                        }
                      />
                    ))}
                </div>
                <div className="flex flex-col bg-white border-t lg:border-t-0 border-zinc-200">
                  {p.fields
                    .slice(Math.ceil(p.fields.length / 2))
                    .map((f, idx, subArr) => (
                      <PimsTableInput
                        key={f.key}
                        label={f.label}
                        value={formData[f.key]}
                        isLast={idx === subArr.length - 1}
                        onChange={(e) =>
                          setFormData({ ...formData, [f.key]: e.target.value })
                        }
                      />
                    ))}
                </div>
              </div>
            </div>
          ))}

          {/* ================= CHEMICAL MATRIX ================= */}
{config.matrix && (
  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
    <SectionHeader title="Chemical Matrix Parameters" icon={Database} />

    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-xs border-collapse">
        <thead className="bg-zinc-100">
          <tr>
            <th className="p-2 border">Parameter</th>
            {config.matrix.locations.map((loc) => (
              <th key={loc} className="p-2 border text-center">
                {loc}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {config.matrix.params.map((p) => (
            <tr key={p.key}>
              <td className="p-2 border font-bold bg-zinc-50">
                {p.label}
              </td>

              {config.matrix.locations.map((loc) => (
                <td key={loc} className="p-2 border">
                  <input
                    type="number"
                    value={matrixData[p.key]?.[loc] ?? ""}
                    onChange={(e) =>
                      setMatrixData({
                        ...matrixData,
                        [p.key]: {
                          ...matrixData[p.key],
                          [loc]: e.target.value,
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-xs border rounded focus:bg-orange-50"
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

          {/* RAW ENTRIES TABLE */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
            <SectionHeader
              title="Raw Data Log"
              icon={FileText}
              right={
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCols(!showCols)}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={exportCSV}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500"
                  >
                    <Download size={14} />
                  </button>
                </div>
              }
            />

            {/* Filter Bar */}
            <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">
                  Range:
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                />
                <span className="text-zinc-400">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                />
              </div>
              <button
                onClick={fetchRange}
                className="px-3 py-1 bg-zinc-800 text-white text-xs font-bold rounded hover:bg-zinc-900"
              >
                Load Data
              </button>
            </div>

            {/* Column Toggle (Optional) */}
            {showCols && (
              <div className="p-3 bg-white grid grid-cols-4 gap-2 border-b border-zinc-200 shadow-inner">
                {columns.map((c) => (
                  <label
                    key={c}
                    className="text-[10px] uppercase font-bold text-zinc-600 flex gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[c]}
                      onChange={() =>
                        setVisibleCols({ ...visibleCols, [c]: !visibleCols[c] })
                      }
                      className="accent-orange-600"
                    />
                    {c}
                  </label>
                ))}
              </div>
            )}

            <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead className="bg-zinc-100 sticky top-0 z-30 shadow-sm">
                  <tr>
                    <th className="p-2 border-b border-r border-zinc-300 sticky left-0 z-40 bg-zinc-100 w-10"></th>
                    <th className="p-2 border-b border-r border-zinc-300 sticky left-[40px] z-40 bg-zinc-100 text-zinc-600 font-bold uppercase w-24 text-left">
                      Sample
                    </th>
                    <th className="p-2 border-b border-r border-zinc-300 sticky left-[136px] z-40 bg-zinc-100 text-zinc-600 font-bold uppercase w-24 text-left">
                      Date
                    </th>
                    <th className="p-2 border-b border-r border-zinc-300 sticky left-[232px] z-40 bg-zinc-100 text-zinc-600 font-bold uppercase w-16 text-left">
                      Time
                    </th>

                    <th className="p-2 border-b border-r border-zinc-200 text-zinc-500 font-semibold text-left">
                      Plant
                    </th>
                    <th className="p-2 border-b border-r border-zinc-200 text-zinc-500 font-semibold text-left">
                      Area
                    </th>

                    {shownCols.map((c) => (
                      <th
                        key={c}
                        className="p-2 border-b border-r border-zinc-200 bg-orange-50/50 text-orange-800 font-bold text-center min-w-[80px]"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {data.map((r) => (
                    <tr
                      key={r.sample_no}
                      onClick={() => loadSample(r.sample_no)}
                      className="cursor-pointer hover:bg-orange-50 transition-colors group"
                    >
                      <td className="p-2 border-b border-r border-zinc-200 sticky left-0 bg-white group-hover:bg-orange-50 z-20 text-center">
                        <button
                          onClick={(e) => deleteSample(e, r.sample_no)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2
                            size={12}
                            className="text-red-500 hover:text-red-700"
                          />
                        </button>
                      </td>
                      <td className="p-2 border-b border-r border-zinc-200 sticky left-[40px] bg-white group-hover:bg-orange-50 z-20 font-bold text-zinc-700">
                        {r.sample_no}
                      </td>
                      <td className="p-2 border-b border-r border-zinc-200 sticky left-[136px] bg-white group-hover:bg-orange-50 z-20 text-zinc-500">
                        {r.date}
                      </td>
                      <td className="p-2 border-b border-r border-zinc-200 sticky left-[232px] bg-white group-hover:bg-orange-50 z-20 text-zinc-500">
                        {r.time}
                      </td>

                      <td className="p-2 border-b border-r border-zinc-100 text-zinc-600 truncate max-w-[100px]">
                        {r.plant}
                      </td>
                      <td className="p-2 border-b border-r border-zinc-100 text-zinc-600 truncate max-w-[100px]">
                        {r.main_area}
                      </td>

                      {shownCols.map((c) => (
                        <td
                          key={c}
                          className="p-2 border-b border-r border-zinc-100 text-center font-mono text-zinc-800"
                        >
                          {r[c] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                <tfoot className="bg-zinc-50 font-bold sticky bottom-0 z-20 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                  <tr>
                    <td
                      colSpan={6}
                      className="p-2 border-r border-zinc-300 text-right text-zinc-400 uppercase text-[10px]"
                    >
                      Average
                    </td>
                    {shownCols.map((c) => (
                      <td
                        key={c}
                        className="p-2 border-r border-zinc-200 text-center text-orange-700"
                      >
                        {stats[c].avg}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}