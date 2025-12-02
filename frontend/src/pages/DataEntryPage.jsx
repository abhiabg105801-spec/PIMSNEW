// DataEntryPage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";

/**
 * Final DataEntryPage.js
 * - Option 1 naming:
 *    totalizer_mu, prev_totalizer
 *    totalizer_coal, prev_totalizer_coal
 *    totalizer_aux, prev_totalizer_aux
 * - Frontend computes:
 *    generation_mu = totalizer_mu - prev_totalizer
 *    coal_consumption_t = totalizer_coal - prev_totalizer_coal
 *    aux_power_consumption_mu = totalizer_aux - prev_totalizer_aux
 * - Auto results shown as tiny grey helper text under parent inputs.
 * - Preserves permissions + admin restrictions + confirmation popup.
 */

/* ----------------------------- Config ------------------------------ */
const API_URL = "http://localhost:8080/api";

const AUTO_CALCULATED_FIELDS = [
  "generation_mu",
  "plf_percent",
  "plant_availability_percent",
  "planned_outage_percent",
  "forced_outage_percent",
  "sp_coal_consumption_kg_kwh",
  "sp_oil_consumption_ml_kwh",
  "aux_power_percent",
  "sp_dm_water_consumption_percent",
  "sp_steam_consumption_kg_kwh",
  // including the computed storage fields (coal, aux, etc.)
  "coal_consumption_t",
  "aux_power_consumption_mu",
];

const PARENT_TO_AUTOS = {
  totalizer_mu: ["prev_totalizer", "generation_mu", "plf_percent"],
  totalizer_coal: ["prev_totalizer_coal", "coal_consumption_t", "sp_coal_consumption_kg_kwh"],
  totalizer_aux: ["prev_totalizer_aux", "aux_power_consumption_mu", "aux_power_percent"],
  running_hour: ["plant_availability_percent"],
  planned_outage_hour: ["planned_outage_percent"],
  forced_outage_hour: ["forced_outage_percent"],
  steam_gen_t: ["sp_steam_consumption_kg_kwh"],
  ldo_hsd_consumption_kl: ["sp_oil_consumption_ml_kwh"],
  dm_water_consumption_cu_m: ["sp_dm_water_consumption_percent"],
};

const initialUnitFormState = {
  unit: "",
  // generation totalizers
  totalizer_mu: "",
  prev_totalizer: "",
  generation_mu: "",
  plf_percent: "",
  // running / availability
  running_hour: "",
  plant_availability_percent: "",
  planned_outage_hour: "",
  planned_outage_percent: "",
  forced_outage_hour: "",
  forced_outage_percent: "",
  strategic_outage_hour: "",
  // coal totalizer + derived coal consumption
  totalizer_coal: "",
  prev_totalizer_coal: "",
  coal_consumption_t: "",
  sp_coal_consumption_kg_kwh: "",
  avg_gcv_coal_kcal_kg: "",
  heat_rate: "",
  // oil
  ldo_hsd_consumption_kl: "",
  sp_oil_consumption_ml_kwh: "",
  // aux totalizer + derived aux power
  totalizer_aux: "",
  prev_totalizer_aux: "",
  aux_power_consumption_mu: "",
  aux_power_percent: "",
  // water/steam/emissions
  dm_water_consumption_cu_m: "",
  sp_dm_water_consumption_percent: "",
  steam_gen_t: "",
  sp_steam_consumption_kg_kwh: "",
  stack_emission_spm_mg_nm3: "",
};

const initialStationFormState = {
  avg_raw_water_used_cu_m_hr: "",
  total_raw_water_used_cu_m: "",
  sp_raw_water_used_ltr_kwh: "",
  ro_plant_running_hrs: "",
  ro_plant_il: "",
  ro_plant_ol: "",
};

const AUTO_LABELS = {
  /* -------- Previous Day Totalizers -------- */
  prev_totalizer: "Prev MU",
  prev_totalizer_coal: "Prev Coal",
  prev_totalizer_aux: "Prev Aux",

  /* -------- Calculated Outputs -------- */
  generation_mu: "Gen (MU)",
  coal_consumption_t: "Coal Used (T)",
  aux_power_consumption_mu: "Aux Used (MU)",

  /* -------- Performance -------- */
  plf_percent: "PLF (%)",
  plant_availability_percent: "Availability (%)",
  planned_outage_percent: "Planned Out (%)",
  forced_outage_percent: "Forced Out (%)",

  /* -------- Specific Consumptions -------- */
  sp_coal_consumption_kg_kwh: "SP Coal (kg/kWh)",
  sp_oil_consumption_ml_kwh: "SP Oil (ml/kWh)",
  aux_power_percent: "Aux (%)",
  sp_dm_water_consumption_percent: "SP DM (%)",
  sp_steam_consumption_kg_kwh: "SP Steam (kg/kWh)",

  /* -------- Station Level -------- */
  sp_raw_water_used_ltr_kwh: "SP Raw Water (L/kWh)",
};

/* -------------------------- Utilities ------------------------------ */
const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};
const getTokenPayload = (authHeader) => {
  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json;
  } catch {
    return null;
  }
};
const Spinner = ({ size = 16 }) => (
  <div style={{ width: size, height: size }} className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current" />
);

/* ------------------------- Tiny Helper UI -------------------------- */
const AutoLine = ({ label, value }) => (
  <div className="text-[11px] text-gray-900 mt-1 ml-1">
    <span className="">{label}:</span>{" "}
    <span className="font-medium text-gray-900">{value === "" || value === null ? "—" : value}</span>
  </div>
);

/* ------------------------- Main Component -------------------------- */
export default function DataEntryPage({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);
  const api = useMemo(() => axios.create({
    baseURL: API_URL,
    headers: { Authorization: authHeader, "Content-Type": "application/json" }
  }), [authHeader]);

  // page / user state
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0,10));
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [message, setMessage] = useState("");
  const [loadingRow, setLoadingRow] = useState(false);

  // auth + role
  const [currentUser, setCurrentUser] = useState(null);
  const [roleId, setRoleId] = useState(null);
  const isAdmin = roleId === 8;
  const [roleLoading, setRoleLoading] = useState(true);

  // permissions
  const [permissionMap, setPermissionMap] = useState({});
  const [permLoading, setPermLoading] = useState(false);

  // forms + originals
  const [unitForms, setUnitForms] = useState({
    "Unit-1": { ...initialUnitFormState, unit: "Unit-1" },
    "Unit-2": { ...initialUnitFormState, unit: "Unit-2" },
  });
  const [originalUnitForms, setOriginalUnitForms] = useState({
    "Unit-1": { ...initialUnitFormState, unit: "Unit-1" },
    "Unit-2": { ...initialUnitFormState, unit: "Unit-2" },
  });
  const [isEditingForUnit, setIsEditingForUnit] = useState({ "Unit-1": false, "Unit-2": false });

  const [stationForm, setStationForm] = useState(initialStationFormState);
  const [originalStationForm, setOriginalStationForm] = useState(initialStationFormState);

  // UI state
  const [submitting, setSubmitting] = useState({ "Unit-1": false, "Unit-2": false, station: false });
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]); // list of changed manual fields for confirmation

  /* --------------------- Role & permission effects -------------------- */
  useEffect(() => {
    let cancelled = false;
    setRoleLoading(true);
    const payload = getTokenPayload(authHeader);
    if (payload) {
      if (!cancelled) {
        setRoleId(payload.role_id || payload.role || null);
        setCurrentUser(payload);
        setRoleLoading(false);
      }
      return () => { cancelled = true; };
    }
    api.get("/auth/me").then(r => {
      if (!cancelled) {
        setCurrentUser(r.data);
        if (r.data && r.data.role_id) setRoleId(Number(r.data.role_id));
      }
    }).catch(()=>{}).finally(()=> { if (!cancelled) setRoleLoading(false); });
    return () => { cancelled = true; };
  }, [api, authHeader]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPerms() {
      if (!authHeader) { setPermissionMap({}); return; }
      setPermLoading(true);
      try {
        if (roleId) {
          const r = await api.get(`/admin/permissions/${roleId}`);
          if (cancelled) return;
          const map = {};
          (r.data || []).forEach(p => { map[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view }; });
          setPermissionMap(map);
          setPermLoading(false);
          return;
        }
        const r2 = await api.get("/permissions/me");
        if (cancelled) return;
        const map2 = {};
        (r2.data || []).forEach(p => { map2[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view }; });
        setPermissionMap(map2);
      } catch (e) {
        try {
          const r2 = await api.get("/permissions/me");
          if (!cancelled) {
            const map2 = {}; (r2.data || []).forEach(p => { map2[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view }; });
            setPermissionMap(map2);
          }
        } catch {
          if (!cancelled) setPermissionMap({});
        }
      } finally { if (!cancelled) setPermLoading(false); }
    }
    fetchPerms();
    return () => { cancelled = true; };
  }, [api, roleId, authHeader]);

  /* ------------------------- Fetch helpers --------------------------- */
  const fetchReport = useCallback(async (unitKey, dateStr) => {
    try {
      const res = await api.get(`/reports/single/${unitKey}/${dateStr}`);
      return res.data ?? null;
    } catch (e) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }, [api]);

  const loadUnitForDate = useCallback(async (unitKey, dateStr) => {
    setLoadingRow(true);
    setMessage("");

    try {
      const data = await fetchReport(unitKey, dateStr);
      const loaded = { ...initialUnitFormState, unit: unitKey };
      if (data) {
        Object.keys(initialUnitFormState).forEach(k => {
          loaded[k] = data[k] ?? "";
        });
      }

      // Load prev_totalizer, prev_totalizer_coal, prev_totalizer_aux
      try {
        const d = new Date(dateStr);
        d.setDate(d.getDate() - 1);
        const prevDate = d.toISOString().slice(0, 10);
        const prev = await fetchReport(unitKey, prevDate);
        loaded.prev_totalizer = prev?.totalizer_mu ?? "";
        loaded.prev_totalizer_coal = prev?.totalizer_coal ?? "";
        loaded.prev_totalizer_aux = prev?.totalizer_aux ?? "";
      } catch {
        loaded.prev_totalizer = "";
        loaded.prev_totalizer_coal = "";
        loaded.prev_totalizer_aux = "";
      }

      setUnitForms(s => ({ ...s, [unitKey]: loaded }));
      setOriginalUnitForms(s => ({ ...s, [unitKey]: { ...loaded } }));
      setIsEditingForUnit(s => ({ ...s, [unitKey]: !!data }));

      setMessage(data ? `✅ Loaded existing report for ${unitKey}` : "");
    } catch {
      setMessage("⚠️ Error loading report");
    } finally {
      setLoadingRow(false);
    }
  }, [fetchReport]);

  const loadStationForDate = useCallback(async (dateStr) => {
    setLoadingRow(true);
    try {
      const res = await api.get(`/reports/station/${dateStr}`);
      if (res.data) {
        const ld = {};
        Object.keys(initialStationFormState).forEach(k => (ld[k] = res.data[k] ?? ""));
        setStationForm(ld);
        setOriginalStationForm(ld);
      } else {
        setStationForm(initialStationFormState);
        setOriginalStationForm(initialStationFormState);
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setStationForm(initialStationFormState);
        setOriginalStationForm(initialStationFormState);
      } else {
        setMessage("⚠️ Error loading station data");
      }
    } finally {
      setLoadingRow(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeTab === "Station") loadStationForDate(reportDate);
    else loadUnitForDate(activeTab, reportDate);
  }, [activeTab, reportDate, loadStationForDate, loadUnitForDate]);

  useEffect(() => {
  if (!message) return;
  const timer = setTimeout(() => setMessage(""), 4000);
  return () => clearTimeout(timer);
}, [message]);

useEffect(() => {
  setMessage("");
}, [activeTab]);

  /* ---------------------- Refresh prev totalizer --------------------- */
  const refreshPrevTotalizer = useCallback(async (unitKey) => {
    try {
      const d = new Date(reportDate);
      d.setDate(d.getDate() - 1);
      const prevDate = d.toISOString().slice(0, 10);

      const prev = await fetchReport(unitKey, prevDate);
      const prevVal = prev?.totalizer_mu ?? "";
      const prevCoal = prev?.totalizer_coal ?? "";
      const prevAux = prev?.totalizer_aux ?? "";

      setUnitForms(s => ({
        ...s,
        [unitKey]: {
          ...s[unitKey],
          prev_totalizer: prevVal,
          prev_totalizer_coal: prevCoal,
          prev_totalizer_aux: prevAux,
        },
      }));

      setOriginalUnitForms(s => ({
        ...s,
        [unitKey]: {
          ...s[unitKey],
          prev_totalizer: prevVal,
          prev_totalizer_coal: prevCoal,
          prev_totalizer_aux: prevAux,
        },
      }));
    } catch {
      // ignore
    }
  }, [fetchReport, reportDate]);

  /* ------------------------- Auto calculations ------------------------ */
  useEffect(() => {
  const updateIfDiff = (unitKey, field, value) => {
    setUnitForms(prev => {
      const cur = prev[unitKey] || {};
      if (String(cur[field] ?? "") === String(value ?? "")) return prev;
      return { ...prev, [unitKey]: { ...cur, [field]: value } };
    });
  };

  ["Unit-1", "Unit-2"].forEach(u => {
    const cur = unitForms[u] || {};

    /* -----------------------------------------------------------
       1) GENERATION (MU)
       Only calculate when today totalizer input is NOT empty
    ------------------------------------------------------------ */
    if (cur.totalizer_mu !== "" && cur.totalizer_mu !== null) {
      const prevGen = parseFloat(cur.prev_totalizer);
      const todayGen = parseFloat(cur.totalizer_mu);

      if (!isNaN(prevGen) && !isNaN(todayGen)) {
        const gen = todayGen - prevGen;
        updateIfDiff(
          u,
          "generation_mu",
          gen >= 0 && isFinite(gen) ? Number(gen.toFixed(3)) : ""
        );
      }
    } else {
      updateIfDiff(u, "generation_mu", "");
    }

    /* -----------------------------------------------------------
       2) COAL USAGE
       Only calculate when today coal totalizer is NOT empty
    ------------------------------------------------------------ */
    if (cur.totalizer_coal !== "" && cur.totalizer_coal !== null) {
      const prevCoal = parseFloat(cur.prev_totalizer_coal);
      const todayCoal = parseFloat(cur.totalizer_coal);

      if (!isNaN(prevCoal) && !isNaN(todayCoal)) {
        const diff = todayCoal - prevCoal;
        updateIfDiff(
          u,
          "coal_consumption_t",
          diff >= 0 && isFinite(diff) ? Number(diff.toFixed(3)) : ""
        );
      }
    } else {
      updateIfDiff(u, "coal_consumption_t", "");
    }

    /* -----------------------------------------------------------
       3) AUX USAGE
       Only calculate when today aux totalizer is NOT empty
    ------------------------------------------------------------ */
    if (cur.totalizer_aux !== "" && cur.totalizer_aux !== null) {
      const prevAux = parseFloat(cur.prev_totalizer_aux);
      const todayAux = parseFloat(cur.totalizer_aux);

      if (!isNaN(prevAux) && !isNaN(todayAux)) {
        const diff = todayAux - prevAux;
        updateIfDiff(
          u,
          "aux_power_consumption_mu",
          diff >= 0 && isFinite(diff) ? Number(diff.toFixed(3)) : ""
        );
      }
    } else {
      updateIfDiff(u, "aux_power_consumption_mu", "");
    }

    /* -----------------------------------------------------------
       DEPENDENT CALCULATIONS (ONLY when generation exists)
    ------------------------------------------------------------ */
    const genVal = parseFloat(cur.generation_mu);

    /* PLF */
    if (!isNaN(genVal) && genVal > 0) {
      updateIfDiff(u, "plf_percent", Number(((genVal / 3) * 100).toFixed(2)));
    } else {
      updateIfDiff(u, "plf_percent", "");
    }

    /* Availability */
    const rh = parseFloat(cur.running_hour);
    if (!isNaN(rh)) {
      updateIfDiff(u, "plant_availability_percent", Number(((rh / 24) * 100).toFixed(2)));
    } else {
      updateIfDiff(u, "plant_availability_percent", "");
    }

    /* Planned outage % */
    const ph = parseFloat(cur.planned_outage_hour);
    if (!isNaN(ph)) {
      updateIfDiff(u, "planned_outage_percent", Number(((ph / 24) * 100).toFixed(2)));
    } else {
      updateIfDiff(u, "planned_outage_percent", "");
    }

    /* Forced outage % */
    const fh = parseFloat(cur.forced_outage_hour);
    if (!isNaN(fh)) {
      updateIfDiff(u, "forced_outage_percent", Number(((fh / 24) * 100).toFixed(2)));
    } else {
      updateIfDiff(u, "forced_outage_percent", "");
    }

    /* -----------------------------------------------------------
       SPECIFIC COAL (coal_consumption_t / generation)
    ------------------------------------------------------------ */
    const coalT = parseFloat(cur.coal_consumption_t);
    if (!isNaN(coalT) && !isNaN(genVal) && genVal > 0) {
      updateIfDiff(u, "sp_coal_consumption_kg_kwh", Number((coalT / (genVal*1000)).toFixed(3)));
    } else {
      updateIfDiff(u, "sp_coal_consumption_kg_kwh", "");
    }

    /* SPECIFIC OIL */
    const oil = parseFloat(cur.ldo_hsd_consumption_kl);
    if (!isNaN(oil) && !isNaN(genVal) && genVal > 0) {
      updateIfDiff(u, "sp_oil_consumption_ml_kwh", Number((oil / genVal).toFixed(3)));
    } else {
      updateIfDiff(u, "sp_oil_consumption_ml_kwh", "");
    }

    /* AUX PERCENT */
    const auxMU = parseFloat(cur.aux_power_consumption_mu);
    if (!isNaN(auxMU) && !isNaN(genVal) && genVal > 0) {
      updateIfDiff(u, "aux_power_percent", Number(((auxMU / genVal) * 100).toFixed(3)));
    } else {
      updateIfDiff(u, "aux_power_percent", "");
    }

    /* SPECIFIC STEAM */
    const steam = parseFloat(cur.steam_gen_t);
    if (!isNaN(steam) && !isNaN(genVal) && genVal > 0) {
      updateIfDiff(u, "sp_steam_consumption_kg_kwh", Number((steam / (genVal*1000)).toFixed(3)));
    } else {
      updateIfDiff(u, "sp_steam_consumption_kg_kwh", "");
    }
  });
}, [unitForms["Unit-1"], unitForms["Unit-2"]]);

  /* ---------------------- Permission helpers ------------------------- */
  const canView = (field) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[field];
    return p ? p.can_view : true;
  };
  const canEdit = (field) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[field];
    return p ? p.can_edit : false;
  };

  /* -------------------------- Input renderers ------------------------ */
  const renderInput = (unitKey, name, label, type = "number") => {
  if (!canView(name)) return null;

  const value = unitForms[unitKey]?.[name] ?? "";
  const editable = canEdit(name);

  const originalHasValue =
    originalUnitForms[unitKey]?.[name] !== "" &&
    originalUnitForms[unitKey]?.[name] !== null &&
    originalUnitForms[unitKey]?.[name] !== undefined;

  // Avoid rendering derived fields
  if (AUTO_CALCULATED_FIELDS.includes(name)) return null;

  const readOnly = !editable || (!isAdmin && originalHasValue);

  return (
    <div
      key={name}
      className="
        bg-zinc-100 backdrop-blur-sm 
        p-2 rounded-xl border border-gray-200 
        shadow-sm hover:shadow-md
        transition-all duration-200
      "
    >
      {/* LABEL */}
      <label
        className="
          block text-xs font-semibold text-gray-700 
          tracking-wide mb-2
        "
      >
        {label}
      </label>

      {/* INPUT */}
      <input
        name={name}
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) =>
          !readOnly &&
          setUnitForms((s) => ({
            ...s,
            [unitKey]: { ...s[unitKey], [name]: e.target.value },
          }))
        }
        className={`
          w-full p-1 rounded-lg text-gray-800 font-medium
          border transition-all duration-200
          ${
            readOnly
              ? "bg-gray-100 border-gray-300 cursor-not-allowed text-gray-600"
              : "bg-white border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          }
        `}
      />

      {/* AUTO CALCULATED INFO */}
      {PARENT_TO_AUTOS[name]?.map((autoField) => {
        const pretty = AUTO_LABELS[autoField] || autoField.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const val = unitForms[unitKey]?.[autoField] ?? "";

        return (
          <div
            key={autoField}
            className="
              text-[11px] text-gray-600 mt-2 pl-1 
              border-l-4 border-orange-400/40 
              ml-1
            "
          >
            <span className="font-semibold text-gray-700">{pretty}:</span>{" "}
            <span className="font-semibold text-gray-900">{val || "—"}</span>
          </div>
        );
      })}
    </div>
  );
};

  const renderStationInput = (name, label) => {
  if (!canView(name)) return null;

  const value = stationForm[name] ?? "";
  const editable = canEdit(name);

  const originalHasValue =
    originalStationForm[name] !== "" &&
    originalStationForm[name] !== null &&
    originalStationForm[name] !== undefined;

  const readOnly = !editable || (!isAdmin && originalHasValue);

  return (
    <div
      key={name}
      className="
        bg-zinc-100 backdrop-blur-sm 
        p-2 rounded-xl border border-gray-200 
        shadow-sm hover:shadow-md
        transition-all duration-200
      "
    >
      <label className="block text-xs text-gray-700 font-semibold mb-2 tracking-wide">
        {label}
      </label>

      <input
        name={name}
        type="number"
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) =>
          !readOnly &&
          setStationForm((s) => ({ ...s, [name]: e.target.value }))
        }
        className={`
          w-full p-1 rounded-lg text-gray-800 font-medium
          border transition-all 
          ${
            readOnly
              ? "bg-gray-100 border-gray-300 cursor-not-allowed text-gray-600"
              : "bg-white border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          }
        `}
      />
    </div>
  );
};
  /* -------------------------- Submit Helpers ------------------------- */
  const getChangedManualFieldsForUnit = (unitKey) => {
    const skip = ["prev_totalizer", "prev_totalizer_coal", "prev_totalizer_aux", "unit"];
    const result = [];

    Object.keys(initialUnitFormState).forEach((k) => {
      if (skip.includes(k)) return;
      if (AUTO_CALCULATED_FIELDS.includes(k)) return;

      const orig = originalUnitForms[unitKey]?.[k] ?? "";
      const curr = unitForms[unitKey]?.[k] ?? "";

      if (String(orig) !== String(curr) && String(curr) !== "") {
        result.push({
          key: k,
          label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: curr,
        });
      }
    });

    return result;
  };

  const handleUnitSubmit = (unitKey) => {
    setMessage("");

    const changed = getChangedManualFieldsForUnit(unitKey);

    if (changed.length === 0) {
      setMessage("❌ No manual changes to submit.");
      return;
    }

    // Non-admin cannot modify fields that had values
    if (!isAdmin) {
      for (const f of changed) {
        const orig = originalUnitForms[unitKey]?.[f.key];
        const origEmpty =
          orig === "" || orig === null || orig === undefined;
        if (!origEmpty) {
          setMessage(`❌ Only admin can edit existing field: ${f.label}`);
          return;
        }
      }
    }

    // show confirmation popup
    setConfirmList(changed);
    setShowConfirmPopup(true);
  };

  const handleConfirmUnitSubmit = async (unitKey) => {
    const u = unitKey;
    setShowConfirmPopup(false);

    setSubmitting((s) => ({ ...s, [u]: true }));
    setMessage("");

    try {
      // Build payload: include today's totalizers and manual fields
      const payload = { ...unitForms[u], report_date: reportDate };

      // Remove prev_totalizer* fields (they are UI-only)
      delete payload.prev_totalizer;
      delete payload.prev_totalizer_coal;
      delete payload.prev_totalizer_aux;

      // normalize: "" => null, numeric strings => numbers
      Object.keys(payload).forEach((k) => {
        if (k === "unit" || k === "report_date") return;

        if (payload[k] === "" || payload[k] === undefined) {
          payload[k] = null;
        } else if (!isNaN(Number(payload[k]))) {
          payload[k] = Number(payload[k]);
        }
      });

      // Non-admin final validation
      if (!isAdmin) {
        for (let field in payload) {
          if (field === "unit" || field === "report_date") continue;

          const orig = originalUnitForms[u]?.[field];
          const curr = payload[field];
          const origEmpty = orig === "" || orig === null || orig === undefined;

          if (!origEmpty && String(orig) !== String(curr)) {
            setMessage(`❌ Only admin can edit existing field: ${field}`);
            setSubmitting((s) => ({ ...s, [u]: false }));
            return;
          }
        }
      }

      // Submit to backend (backend should store totalizer fields and any derived fields you want to persist)
      await api.post("/reports/", payload);

      setMessage(
        isEditingForUnit[u]
          ? "✅ Report updated successfully"
          : "✅ Report added successfully"
      );

      // normalize + update original forms
      const normalized = {};
      Object.keys(unitForms[u]).forEach((k) => {
        const v = unitForms[u][k];
        if (v === "" || v === null || v === undefined) normalized[k] = "";
        else if (!isNaN(Number(v))) normalized[k] = Number(v);
        else normalized[k] = v;
      });

      setUnitForms((s) => ({ ...s, [u]: normalized }));
      setOriginalUnitForms((s) => ({ ...s, [u]: normalized }));
      setIsEditingForUnit((s) => ({ ...s, [u]: true }));

      // Refresh prev_totalizer values so UI stays consistent (pulls yesterday's totalizer again)
      await refreshPrevTotalizer(u);
    } catch (e) {
      const det = e?.response?.data?.detail || e.message || "Error saving data";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting((s) => ({ ...s, [u]: false }));
    }
  };

  /* ------------------------ Station Submit --------------------------- */
  const handleStationSubmit = async () => {
    setSubmitting((s) => ({ ...s, station: true }));
    setMessage("");

    try {
      const changed = [];
      Object.keys(stationForm).forEach((field) => {
        const orig = originalStationForm[field] ?? "";
        const curr = stationForm[field] ?? "";
        if (String(orig) !== String(curr)) changed.push(field);
      });

      if (changed.length === 0) {
        setMessage("❌ No changes to submit.");
        setSubmitting((s) => ({ ...s, station: false }));
        return;
      }

      if (!isAdmin) {
        for (let f of changed) {
          const orig = originalStationForm[f];
          const empty = orig === "" || orig === null || orig === undefined;
          if (!empty) {
            setMessage(`❌ Only admin can edit existing field: ${f}`);
            setSubmitting((s) => ({ ...s, station: false }));
            return;
          }
        }
      }

      const payload = { ...stationForm, report_date: reportDate };
      Object.keys(payload).forEach((k) => {
        if (k === "report_date") return;
        if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
        else if (!isNaN(Number(payload[k]))) payload[k] = Number(payload[k]);
      });

      await api.post("/reports/station/", payload);

      setMessage(
        Object.values(originalStationForm).some(
          (v) => v !== "" && v !== null && v !== undefined
        )
          ? "✅ Station data updated successfully."
          : "✅ Station data added successfully."
      );

      const normalized = {};
      Object.keys(stationForm).forEach((k) => {
        const v = stationForm[k];
        if (v === "" || v === null || v === undefined) normalized[k] = "";
        else if (!isNaN(Number(v))) normalized[k] = Number(v);
        else normalized[k] = v;
      });

      setStationForm(normalized);
      setOriginalStationForm(normalized);
    } catch (e) {
      const det = e?.response?.data?.detail || "Error saving station data";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting((s) => ({ ...s, station: false }));
    }
  };

  /* ------------------------------ UI -------------------------------- */
  return (
  <div className="flex gap-6  max-w-7xl mx-auto">

    {/* SIDEBAR */}
    <aside
      className="
        w-48 bg-white 
        rounded-xl border border-gray-200 
        shadow-[0_4px_10px_rgba(0,0,0,0.08)]
        p-2 flex flex-col gap-6
        min-h-[560px]
      "
    >
      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Select Date</label>
        <input
          type="date"
          className="
            w-full p-2 rounded-md border border-gray-300 
            bg-gray-50 text-gray-700 
            focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm
          "
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div>
        <div className="text-xs text-gray-500 mb-2 font-medium">Tabs</div>

        <div className="flex flex-col gap-2">
          {["Unit-1", "Unit-2", "Station"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`
                p-2 rounded-lg text-left font-medium transition-all 
                border shadow-sm relative overflow-hidden group
                ${
                  activeTab === t
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 border-orange-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                }
              `}
            >
              {/* left highlight */}
              <span
                className={`
                  absolute left-0 top-0 h-full w-1 
                  transition-all duration-300
                  ${
                    activeTab === t
                      ? "bg-orange-500"
                      : "bg-transparent group-hover:bg-orange-300"
                  }
                `}
              ></span>

              {t}

              {activeTab === t && loadingRow && (
                <span className="ml-2 text-xs opacity-70">
                  <Spinner size={12} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>

    {/* MAIN CONTENT PANEL */}
    <main className="flex-1">

      {/* OUTER PANEL: Clean white card instead of layered glass */}
      <div
        className="
          relative rounded-xl border border-gray-200 
          bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)]
          p-1 overflow-hidden
          min-h-[560px]
        "
      >

        {/* HEADER */}
        <div className="w-full flex items-center justify-between py-1 mb-3">

          <h3 className="text-xl px-5 py-2 font-semibold tracking-wide text-gray-500">
            {activeTab} Report
          </h3>

          <div className="flex-grow flex justify-center">
            {message && (
              <div
                className={`
                  text-xl font-medium px-3 py-1 rounded-md 
                  shadow-sm border
                  ${
                    message.startsWith("❌")
                      ? "bg-red-50 text-red-700 border-red-300"
                      : "bg-green-50 text-green-700 border-green-300"
                  }
                `}
              >
                {message}
              </div>
            )}
          </div>

          
        </div>

        {/* Thin underline */}
        <div className="w-full h-px bg-gradient-to-r from-orange-500 via-orange-400 to-gray-300 mb-2"></div>

        {/* FORM PANEL — animation fixes */}
        <div key={activeTab} className="slide-in-left min-h-[520px]">

          {/* ---------- UNIT FORM ---------- */}
          {["Unit-1", "Unit-2"].includes(activeTab) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUnitSubmit(activeTab);
              }}
            >
              <div className="grid grid-cols-4 gap-4 mb-4">
                {renderInput(activeTab, "totalizer_mu", "Totalizer (MU)")}
                {renderInput(activeTab, "totalizer_coal", "Coal Totalizer")}
                {renderInput(activeTab, "totalizer_aux", "Aux Totalizer")}
                {renderInput(activeTab, "running_hour", "Running Hour")}
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                {renderInput(activeTab, "planned_outage_hour", "Planned Outage (Hr)")}
                {renderInput(activeTab, "forced_outage_hour", "Forced Outage (Hr)")}
                {renderInput(activeTab, "strategic_outage_hour", "Strategic Outage (Hr)")}
                {renderInput(activeTab, "avg_gcv_coal_kcal_kg", "Avg GCV (kcal/kg)")}
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                {renderInput(activeTab, "ldo_hsd_consumption_kl", "LDO/HSD (KL)")}
                {renderInput(activeTab, "steam_gen_t", "Steam Gen (T)")}
                {renderInput(activeTab, "dm_water_consumption_cu_m", "DM Water (Cu.m)")}
                {renderInput(activeTab, "stack_emission_spm_mg_nm3", "SPM (mg/Nm3)")}
              </div>
              
             <div className="w-full  h-px bg-gradient-to-r from-orange-500 via-orange-400 to-gray-300 mb-2 mt-5"></div>

              <button
    type="submit"
    disabled={submitting[activeTab] || loadingRow}
    className={`
      px-6 py-2 rounded-lg font-semibold text-white shadow-sm
      transition-all active:scale-95
      ${
        loadingRow
          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
          : "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500"
      }
    `}
  >
    {loadingRow
      ? "Loading..."
      : submitting[activeTab]
      ? "Processing..."
      : isEditingForUnit[activeTab]
      ? "Update"
      : "Submit"}
  </button>
            </form>
          )}

          {/* ---------- STATION FORM ---------- */}
          {activeTab === "Station" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStationSubmit();
              }}
            >
              <div className="grid grid-cols-3 gap-4">
                {renderStationInput("avg_raw_water_used_cu_m_hr", "Avg Raw Water (Cu.m/hr)")}
                {renderStationInput("total_raw_water_used_cu_m", "Total Raw Water (Cu.m)")}
                {renderStationInput("sp_raw_water_used_ltr_kwh", "SP Raw Water (L/kWh)")}
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                {renderStationInput("ro_plant_running_hrs", "RO Running (Hrs)")}
                {renderStationInput("ro_plant_il", "RO I/L")}
                {renderStationInput("ro_plant_ol", "RO O/L")}
              </div>
              <div className="w-full  h-px bg-gradient-to-r from-orange-500 via-orange-400 to-gray-300 mb-2 mt-5"></div>
              <button
    type="submit"
    disabled={submitting.station || loadingRow}
    className={`
      px-6 py-2 rounded-lg font-semibold text-white shadow-sm
      transition-all active:scale-95
      ${
        loadingRow
          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
          : "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500"
      }
    `}
  >
    {loadingRow
      ? "Loading..."
      : submitting.station
      ? "Processing..."
      : "Submit"}
  </button>
            </form>
          )}

        </div>

        {/* POPUP */}
        {showConfirmPopup && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-5 rounded-xl shadow-lg w-full max-w-xl max-h-[80vh] overflow-auto">
              <h3 className="text-lg font-semibold text-center text-orange-700 mb-3">
                Confirm manual changes
              </h3>

              {confirmList.length === 0 ? (
                <div className="text-sm text-gray-700">No manual changes detected.</div>
              ) : (
                <ul className="list-disc ml-5 text-sm">
                  {confirmList.map((f) => (
                    <li key={f.key} className="py-1">
                      <span className="font-medium">{f.label}:</span>{" "}
                      <span className="font-mono">{f.value}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setShowConfirmPopup(false)}
                  className="px-3 py-1 rounded bg-gray-400 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmUnitSubmit(activeTab)}
                  className="px-3 py-1 rounded bg-orange-600 text-white"
                >
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  </div>
);

}
