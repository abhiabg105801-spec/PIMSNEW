// ======================================================================
// UNIVERSAL PIMS PAGE — FINAL STABLE VERSION (LIGHT UI)
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PIMS_CONFIG from "../config/pims_config";
import {
  Save,
  RefreshCw,
  FileText,
  Activity,
  Clock,
  MapPin,
  Database,
  Layers,
  Settings,
} from "lucide-react";

/* =========================================================
   BASIC INPUT
   ========================================================= */
const PimsInput = ({
  label,
  type = "text",
  value,
  onChange,
  options = [],
  readOnly = false,
}) => (
  <div className="w-full">
    <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">
      {label}
    </label>

    {type === "textarea" ? (
      <textarea
        rows={2}
        value={value ?? ""}
        readOnly={readOnly}
        onChange={onChange}
        className="w-full bg-zinc-50 border border-zinc-300 px-3 py-2 text-sm rounded"
      />
    ) : type === "select" ? (
      <select
        value={value ?? ""}
        disabled={readOnly}
        onChange={onChange}
        className="w-full bg-zinc-50 border border-zinc-300 px-3 py-2 text-sm rounded"
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
        readOnly={readOnly}
        onChange={onChange}
        className="w-full bg-zinc-50 border border-zinc-300 px-3 py-2 text-sm rounded"
      />
    )}
  </div>
);

/* =========================================================
   SECTION HEADER
   ========================================================= */
const SectionHeader = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-3 px-6 py-4 border-b bg-white">
    <div className="p-1.5 bg-orange-50 text-orange-600 rounded">
      <Icon size={18} />
    </div>
    <h3 className="text-sm font-bold uppercase">{title}</h3>
  </div>
);

/* =========================================================
   MAIN COMPONENT
   ========================================================= */
export default function UniversalPIMSPage({ auth }) {
  const MODULE_KEYS = Object.keys(PIMS_CONFIG);
  const [module, setModule] = useState(MODULE_KEYS[0]);
  const config = PIMS_CONFIG[module];

  const [formData, setFormData] = useState({});
  const [matrixData, setMatrixData] = useState({});
  const [rawRows, setRawRows] = useState([]);
  const [sampleNo, setSampleNo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRaw, setLoadingRaw] = useState(false);

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
    const isoDate = now.toISOString().slice(0, 10);
    const isoTime = now.toTimeString().slice(0, 5);

    const fd = {};

    config.topPanel?.forEach((f) => {
      if (f.type === "date") fd[f.key] = isoDate;
      else if (f.type === "time") fd[f.key] = isoTime;
      else fd[f.key] = "";
    });

    config.locationPanel?.forEach((f) => (fd[f.key] = ""));
    config.parameterPanels?.forEach((p) =>
      p.fields.forEach((f) => (fd[f.key] = ""))
    );
    config.bottomPanel?.fields?.forEach((f) => (fd[f.key] = ""));

    setFormData(fd);

    if (config.matrix) {
      const md = {};
      config.matrix.params.forEach((p) => {
        md[p.key] = {};
        config.matrix.locations.forEach((l) => (md[p.key][l] = ""));
      });
      setMatrixData(md);
    } else {
      setMatrixData({});
    }

    fetchRaw(isoDate);
  };

  /* ================= RAW TABLE ================= */
  const fetchRaw = async (dateOverride) => {
    setLoadingRaw(true);
    try {
      const dateKey =
        config.topPanel?.find((x) => x.type === "date")?.key ||
        "sampling_date";
      const date = dateOverride || formData[dateKey];

      const res = await api.get("/raw", {
        params: { module, date },
      });
      setRawRows(res.data.rows || []);
    } catch {
      setRawRows([]);
    }
    setLoadingRaw(false);
  };

  /* ================= BUILD PAYLOAD (FIXED) ================= */
  const buildPayload = () => {
    const payload = {
      module,
      date:
        formData.sampling_date ||
        formData.entry_date ||
        formData.date,
      time:
        formData.sampling_time ||
        formData.entry_time ||
        formData.time,

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

    if (!config.matrix) {
      config.parameterPanels?.forEach((p) =>
        p.fields.forEach((f) => {
          if (formData[f.key] !== "") {
            payload.entries.push({
              parameter: f.key,
              value: Number(formData[f.key]),
            });
          }
        })
      );

      config.bottomPanel?.fields?.forEach((f) => {
        if (formData[f.key] !== "") {
          payload.entries.push({
            parameter: f.key,
            value: Number(formData[f.key]),
          });
        }
      });
    } else {
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

    return payload;
  };

  /* ================= SAVE / UPDATE ================= */
  const saveEntry = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editMode) {
        await api.post("/update", payload);
        alert("Sample updated successfully");
      } else {
        const res = await api.post("/add", payload);
        alert(`Saved successfully\nSample No: ${res.data.sample_no}`);
      }
      initForm();
    } catch (e) {
      alert(e.response?.data?.detail || "Save failed");
    }
    setSaving(false);
  };

  /* ================= LOAD SAMPLE ================= */
  const loadSample = async (selectedSampleNo) => {
  try {
    const res = await api.get("/entry", {
      params: { sample_no: selectedSampleNo },
    });

    const rows = res.data.rows;
    if (!rows || rows.length === 0) {
      alert("Sample not found");
      return;
    }

    const first = rows[0];

    // ---------- 1. BASE FORM DATA ----------
    const fd = {};

    // Map TOP PANEL correctly
    config.topPanel?.forEach((f) => {
      if (f.key.includes("date")) {
        fd[f.key] = first.date; // YYYY-MM-DD
      } else if (f.key.includes("time")) {
        fd[f.key] = first.time?.slice(0, 5); // HH:MM
      } else {
        fd[f.key] = first[f.key] ?? "";
      }
    });

    // Map LOCATION PANEL correctly
    fd.plant = first.plant ?? "";
    fd.broad_area = first.broad_area ?? "";
    fd.main_area = first.main_area ?? "";
    fd.main_collection_area = first.main_collection_area ?? "";
    fd.exact_area = first.exact_collection_area ?? "";
    fd.location = first.location ?? "";

    // ---------- 2. CLEAR PARAMETER FIELDS ----------
    config.parameterPanels?.forEach((p) =>
      p.fields.forEach((f) => (fd[f.key] = ""))
    );
    config.bottomPanel?.fields?.forEach((f) => (fd[f.key] = ""));

    // ---------- 3. LOAD VALUES ----------
    if (!config.matrix) {
      rows.forEach((r) => {
        fd[r.parameter] = r.value ?? "";
      });
      setMatrixData({});
    } else {
      // MATRIX MODULE
      const md = {};
      config.matrix.params.forEach((p) => {
        md[p.key] = {};
        config.matrix.locations.forEach((l) => (md[p.key][l] = ""));
      });

      rows.forEach((r) => {
        const [p, loc] = r.parameter.split("__");
        if (md[p] && loc) md[p][loc] = r.value ?? "";
      });

      setMatrixData(md);
    }

    // ---------- 4. FINAL STATE ----------
    setFormData(fd);
    setSampleNo(selectedSampleNo);
    setEditMode(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    alert("Failed to load sample");
  }
};


  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-white p-5 rounded-lg border flex justify-between">
        <div className="flex items-center gap-4">
          <Activity className="text-orange-600" />
          <h1 className="text-xl font-bold">Universal PIMS</h1>
        </div>

        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          {MODULE_KEYS.map((k) => (
            <option key={k} value={k}>
              {PIMS_CONFIG[k].label}
            </option>
          ))}
        </select>
      </div>

      {/* TOP PANEL */}
      <div className="bg-white border rounded-lg">
        <SectionHeader title="Log Context" icon={Clock} />
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {config.topPanel?.map((f) => (
            <PimsInput
              key={f.key}
              label={f.label}
              type={f.type}
              options={f.options}
              value={formData[f.key]}
              onChange={(e) =>
                setFormData({ ...formData, [f.key]: e.target.value })
              }
            />
          ))}
        </div>
      </div>

      {/* LOCATION */}
      <div className="bg-white border rounded-lg">
        <SectionHeader title="Location Details" icon={MapPin} />
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {config.locationPanel?.map((f) => (
            <PimsInput
              key={f.key}
              label={f.label}
              value={formData[f.key]}
              onChange={(e) =>
                setFormData({ ...formData, [f.key]: e.target.value })
              }
            />
          ))}
        </div>
      </div>

      {/* PARAMETERS */}
      {config.parameterPanels?.map((p, i) => (
        <div key={i} className="bg-white border rounded-lg">
          <SectionHeader title={p.title} icon={Database} />
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {p.fields.map((f) => (
              <PimsInput
                key={f.key}
                label={f.label}
                type={f.type}
                value={formData[f.key]}
                onChange={(e) =>
                  setFormData({ ...formData, [f.key]: e.target.value })
                }
              />
            ))}
          </div>
        </div>
      ))}

      {/* SAVE */}
      <button
        onClick={saveEntry}
        disabled={saving}
        className={`fixed bottom-6 right-6 px-6 py-3 rounded-full text-white shadow ${
          editMode ? "bg-blue-600" : "bg-orange-600"
        }`}
      >
        <Save className="inline mr-2" />
        {editMode ? "Update Sample" : "Save Entry"}
      </button>

      {/* RAW TABLE */}
      <div className="bg-white border rounded-lg">
        <SectionHeader title="Raw Entries" icon={FileText} />
        <table className="w-full text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="p-2">Sample No</th>
              <th className="p-2">Parameter</th>
              <th className="p-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {rawRows.map((r, i) => (
              <tr
                key={i}
                onClick={() => loadSample(r.sample_no)}
                className="cursor-pointer hover:bg-orange-50"
              >
                <td className="p-2">{r.sample_no}</td>
                <td className="p-2">{r.parameter}</td>
                <td className="p-2">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
