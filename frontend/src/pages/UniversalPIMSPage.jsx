// ======================================================================
// UNIVERSAL PIMS PAGE — IMPROVED STYLING & FIXED Z-INDEX LAYERS
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
  X,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";

/* ================= STYLISH TABLE ROW INPUT ================= */
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
      !isLast ? "border-b border-gray-200" : ""
    }`}
  >
    {/* Left Label Side */}
    <div className="w-[160px] shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 border-r border-gray-200 px-4 py-3 flex items-center">
      <span className="text-xs font-semibold text-gray-700 leading-tight">
        {label}
      </span>
    </div>

    {/* Right Input Side */}
    <div className="flex-1 bg-white relative">
      {type === "select" ? (
        <select
          value={value ?? ""}
          onChange={onChange}
          className="w-full h-full px-4 py-3 text-sm text-gray-800 bg-transparent outline-none
                      focus:bg-orange-50 focus:ring-2 focus:ring-inset focus:ring-orange-400 transition-all"
        >
          <option value="">-- Select --</option>
          {options.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={onChange}
          rows={3}
          className="w-full h-full px-4 py-3 text-sm text-gray-800 bg-transparent outline-none resize-none
                      focus:bg-orange-50 focus:ring-2 focus:ring-inset focus:ring-orange-400 transition-all
                      placeholder-gray-400"
          placeholder="Enter remarks..."
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={onChange}
          className="w-full h-full px-4 py-3 text-sm text-gray-800 bg-transparent outline-none
                      focus:bg-orange-50 focus:ring-2 focus:ring-inset focus:ring-orange-400 transition-all
                      placeholder-gray-400"
          placeholder="..."
        />
      )}
    </div>
  </div>
);

/* ================= SECTION HEADER ================= */
const SectionHeader = ({ title, icon: Icon, right }) => (
  <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-800 to-gray-700 border-b-2 border-orange-500">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-orange-500 text-white rounded-lg shadow-md">
        <Icon size={16} strokeWidth={2.5} />
      </div>
      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
        {title}
      </h3>
    </div>
    {right}
  </div>
);

/* ================= RAW HELPERS ================= */
const pivotRawData = (rows, config) => {
  const cols = new Set();
  const map = {};

  rows.forEach((r) => {
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

    if (config.matrix && r.parameter.includes("__")) {
      const [param, loc] = r.parameter.split("__");
      const colKey = `${param} (${loc})`;
      cols.add(colKey);
      map[r.sample_no][colKey] = r.value;
    } else {
      cols.add(r.parameter);
      map[r.sample_no][r.parameter] = r.value;
    }
  });

  return {
    columns: Array.from(cols),
    data: Object.values(map),
  };
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

    config.topPanel?.forEach((f) => {
      fd[f.key] =
        f.type === "date"
          ? first.date
          : f.type === "time"
          ? first.time?.slice(0, 5)
          : first[f.key] ?? "";
    });

    config.locationPanel?.forEach((f) => {
      fd[f.key] = first[f.key] ?? "";
    });

    config.parameterPanels?.forEach((p) =>
      p.fields.forEach((f) => {
        fd[f.key] = "";
      })
    );

    let md = {};
    if (config.matrix) {
      config.matrix.params.forEach((p) => {
        md[p.key] = {};
        config.matrix.locations.forEach((loc) => {
          md[p.key][loc] = "";
        });
      });
    }

    rows.forEach((r) => {
      if (config.matrix && r.parameter.includes("__")) {
        const [paramKey, loc] = r.parameter.split("__");
        if (md[paramKey] && md[paramKey][loc] !== undefined) {
          md[paramKey][loc] = r.value ?? "";
        }
      } else {
        fd[r.parameter] = r.value ?? "";
      }
    });

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

  const { columns, data } = useMemo(
    () => pivotRawData(rawRows, config),
    [rawRows, config]
  );

  useEffect(() => {
    const init = {};
    columns.forEach((c) => (init[c] = true));
    setVisibleCols(init);
  }, [columns]);

  const shownCols = columns.filter((c) => visibleCols[c]);
  const stats = calcStats(data, shownCols);

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* SIDEBAR - Fixed with proper z-index (below nav dropdowns) */}
      <div
        className={`fixed top-10 left-0 h-screen bg-white border-r border-gray-200 flex flex-col shadow-xl transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-0"
        } z-30 overflow-hidden`}
        style={{ marginTop: '64px' }} // Adjust based on your navbar height
      >
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Menu className="text-orange-600" size={20} />
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
              Modules
            </h2>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors lg:hidden"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {MODULE_KEYS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setModule(m);
                // Auto-close sidebar on mobile after selection
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center justify-between group ${
                module === m
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-transparent hover:border-gray-200"
              }`}
            >
              <span className="truncate">{PIMS_CONFIG[m].label}</span>
              {module === m && <ChevronRight size={16} className="flex-shrink-0" />}
            </button>
          ))}
        </div>

        
      </div>

      {/* MAIN CONTENT - with left margin and proper stacking */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : "ml-0"
        } flex flex-col min-h-screen`}
        style={{ marginTop: '64px' }} // Adjust based on your navbar height
      >
        
        {/* TOP BAR - Sticky with proper z-index (below nav) */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={20} className="text-gray-600" />
              </button>
            )}
            
            <div className="flex items-center gap-1">
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white shadow-lg">
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-none">
                  DM Plant Data Entry
                </h1>
                <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                  {PIMS_CONFIG[module].label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 transition-all shadow-sm hover:shadow"
            >
              <Copy size={16} /> Copy Previous
            </button>
            <button
              onClick={initForm}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 transition-all shadow-sm hover:shadow"
            >
              <RefreshCw size={16} /> Reset Form
            </button>
            <button
              onClick={saveEntry}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-2 text-white text-sm font-bold rounded-lg shadow-lg transition-all ${
                editMode
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              } disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl active:scale-95`}
            >
              <Save size={16} />
              {saving ? "Saving..." : editMode ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="p-6 space-y-6">
          
          {/* LOG CONTEXT & LOCATION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Log Context */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <SectionHeader title="Log Context" icon={Clock} />
              <div className="divide-y divide-gray-200">
                {config.topPanel?.map((f, i, arr) => (
                  <PimsTableInput
                    key={f.key}
                    label={f.label}
                    value={formData[f.key]}
                    type={f.type || "text"}
                    options={f.options}
                    isLast={i === arr.length - 1}
                    onChange={(e) =>
                      setFormData({ ...formData, [f.key]: e.target.value })
                    }
                  />
                ))}
              </div>
            </div>

            {/* Location Details */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <SectionHeader title="Location Details" icon={MapPin} />
              <div className="divide-y divide-gray-200">
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
              className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
            >
              <SectionHeader title={p.title} icon={Database} />
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="divide-y divide-gray-200 border-r border-gray-200">
                  {p.fields
                    .slice(0, Math.ceil(p.fields.length / 2))
                    .map((f, idx, subArr) => (
                      <PimsTableInput
                        key={f.key}
                        label={f.label}
                        type={f.type}
                        value={formData[f.key]}
                        isLast={idx === subArr.length - 1}
                        onChange={(e) =>
                          setFormData({ ...formData, [f.key]: e.target.value })
                        }
                      />
                    ))}
                </div>
                <div className="divide-y divide-gray-200">
                  {p.fields
                    .slice(Math.ceil(p.fields.length / 2))
                    .map((f, idx, subArr) => (
                      <PimsTableInput
                        key={f.key}
                        label={f.label}
                        type={f.type}
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

          {/* CHEMICAL MATRIX */}
          {config.matrix && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <SectionHeader title="Chemical Matrix Parameters" icon={Database} />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                    <tr>
                      <th className="p-3 border border-gray-200 text-left font-bold text-gray-700">
                        Parameter
                      </th>
                      {config.matrix.locations.map((loc) => (
                        <th key={loc} className="p-3 border border-gray-200 text-center font-bold text-gray-700">
                          {loc}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {config.matrix.params.map((p, idx) => (
                      <tr key={p.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-3 border border-gray-200 font-semibold text-gray-700">
                          {p.label}
                        </td>
                        {config.matrix.locations.map((loc) => (
                          <td key={loc} className="p-3 border border-gray-200">
                            <input
                              type="number"
                              step="0.01"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:bg-orange-50 focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                              placeholder="0.00"
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
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader
              title="Raw Data Log"
              icon={FileText}
              right={
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCols(!showCols)}
                    className={`p-2 rounded-lg transition-all ${
                      showCols
                        ? "bg-orange-500 text-white"
                        : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                  >
                    {showCols ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => {}}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
                  >
                    <Download size={16} />
                  </button>
                </div>
              }
            />

            {/* Filter Bar */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-600 uppercase">
                  Date Range:
                </span>
              </div>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <button
                onClick={fetchRange}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all"
              >
                Load Data
              </button>
            </div>

            {/* Column Toggle */}
            {showCols && (
              <div className="p-4 bg-orange-50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 border-b border-orange-200">
                {columns.map((c) => (
                  <label
                    key={c}
                    className="text-xs font-medium text-gray-700 flex items-center gap-2 cursor-pointer hover:text-orange-600 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[c]}
                      onChange={() =>
                        setVisibleCols({ ...visibleCols, [c]: !visibleCols[c] })
                      }
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="truncate">{c}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Data Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 border-b-2 border-r border-gray-300 sticky left-0 z-20 bg-gray-100 w-12"></th>
                    <th className="p-3 border-b-2 border-r border-gray-300 sticky left-[48px] z-20 bg-gray-100 text-gray-700 font-bold uppercase text-left min-w-[100px]">
                      Sample
                    </th>
                    <th className="p-3 border-b-2 border-r border-gray-300 sticky left-[148px] z-20 bg-gray-100 text-gray-700 font-bold uppercase text-left min-w-[100px]">
                      Date
                    </th>
                    <th className="p-3 border-b-2 border-r border-gray-300 sticky left-[248px] z-20 bg-gray-100 text-gray-700 font-bold uppercase text-left min-w-[80px]">
                      Time
                    </th>
                    <th className="p-3 border-b-2 border-r border-gray-200 text-gray-600 font-semibold text-left">
                      Plant
                    </th>
                    <th className="p-3 border-b-2 border-r border-gray-200 text-gray-600 font-semibold text-left">
                      Area
                    </th>
                    {shownCols.map((c) => (
                      <th
                        key={c}
                        className="p-3 border-b-2 border-r border-gray-200 bg-gradient-to-br from-orange-50 to-orange-100 text-orange-800 font-bold text-center min-w-[100px]"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {data.map((r, idx) => (
                    <tr
                      key={r.sample_no}
                      onClick={() => loadSample(r.sample_no)}
                      className={`cursor-pointer hover:bg-orange-50 transition-all group border-b border-gray-100 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="p-3 border-r border-gray-200 sticky left-0 bg-inherit group-hover:bg-orange-50 z-10 text-center">
                        <button
                          onClick={(e) => deleteSample(e, r.sample_no)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 size={14} className="text-red-500 hover:text-red-700" />
                        </button>
                      </td>
                      <td className="p-3 border-r border-gray-200 sticky left-[48px] bg-inherit group-hover:bg-orange-50 z-10 font-bold text-gray-800">
                        {r.sample_no}
                      </td>
                      <td className="p-3 border-r border-gray-200 sticky left-[148px] bg-inherit group-hover:bg-orange-50 z-10 text-gray-600">
                        {r.date}
                      </td>
                      <td className="p-3 border-r border-gray-200 sticky left-[248px] bg-inherit group-hover:bg-orange-50 z-10 text-gray-600">
                        {r.time}
                      </td>
                      <td className="p-3 border-r border-gray-100 text-gray-700 truncate max-w-[120px]">
                        {r.plant}
                      </td>
                      <td className="p-3 border-r border-gray-100 text-gray-700 truncate max-w-[120px]">
                        {r.main_area}
                      </td>
                      {shownCols.map((c) => (
                        <td
                          key={c}
                          className="p-3 border-r border-gray-100 text-center font-mono text-gray-800"
                        >
                          {r[c] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                <tfoot className="bg-gradient-to-r from-orange-100 to-orange-50 font-bold sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                  <tr>
                    <td
                      colSpan={6}
                      className="p-3 border-r border-orange-300 text-right text-orange-800 uppercase text-xs font-black"
                    >
                      Average
                    </td>
                    {shownCols.map((c) => (
                      <td
                        key={c}
                        className="p-3 border-r border-orange-200 text-center text-orange-700 font-bold"
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

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}