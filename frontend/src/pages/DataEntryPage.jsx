// DataEntryPage.js
// Single-file React component — no 'clsx' dependency
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";




// Helpers
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

// Constants
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
];

const initialUnitFormState = {
  unit: "", totalizer_mu: "", prev_totalizer: "", generation_mu: "", plf_percent: "",
  running_hour: "", plant_availability_percent: "", planned_outage_hour: "", planned_outage_percent: "",
  forced_outage_hour: "", forced_outage_percent: "", strategic_outage_hour: "",
  coal_consumption_t: "", sp_coal_consumption_kg_kwh: "", avg_gcv_coal_kcal_kg: "", heat_rate: "",
  ldo_hsd_consumption_kl: "", sp_oil_consumption_ml_kwh: "", aux_power_consumption_mu: "", aux_power_percent: "",
  dm_water_consumption_cu_m: "", sp_dm_water_consumption_percent: "", steam_gen_t: "", sp_steam_consumption_kg_kwh: "",
  stack_emission_spm_mg_nm3: ""
};

const initialStationFormState = {
  avg_raw_water_used_cu_m_hr: "", total_raw_water_used_cu_m: "", sp_raw_water_used_ltr_kwh: "",
  ro_plant_running_hrs: "", ro_plant_il: "", ro_plant_ol: ""
};

// Main component
export default function DataEntryPage({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);
  const api = useMemo(() => axios.create({
    baseURL: API_URL,
    headers: { Authorization: authHeader, "Content-Type": "application/json" }
  }), [authHeader]);

  // user + role
  const [roleId, setRoleId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const isAdmin = roleId === 8;
  const [roleLoading, setRoleLoading] = useState(true);

  // permissions
  const [permissionMap, setPermissionMap] = useState({});
  const [permLoading, setPermLoading] = useState(false);

  // page state
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [loadingRow, setLoadingRow] = useState(false);

  // forms
  const [unitForms, setUnitForms] = useState({
    "Unit-1": { ...initialUnitFormState, unit: "Unit-1" },
    "Unit-2": { ...initialUnitFormState, unit: "Unit-2" }
  });
  const [originalUnitForms, setOriginalUnitForms] = useState({
    "Unit-1": { ...initialUnitFormState, unit: "Unit-1" },
    "Unit-2": { ...initialUnitFormState, unit: "Unit-2" }
  });
  const [isEditingForUnit, setIsEditingForUnit] = useState({ "Unit-1": false, "Unit-2": false });
  const [stationForm, setStationForm] = useState(initialStationFormState);

  // UI/submit
  const [submitting, setSubmitting] = useState({ "Unit-1": false, "Unit-2": false, station: false });
 
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [originalStationForm, setOriginalStationForm] = useState(initialStationFormState);


  // Role detection
  useEffect(() => {
    setRoleLoading(true);
    let cancelled = false;
    const payload = getTokenPayload(authHeader);
    if (payload) {
      if (!cancelled) {
        setRoleId(payload.role_id || payload.role || null);
        setCurrentUser(payload);
        setRoleLoading(false);
        const isAdmin = (payload.role_id === 8 || payload.role === 8);

      }
      return () => { cancelled = true; };
    }
    api.get("/auth/me").then(r => {
      if (r.data && r.data.role_id) setRoleId(Number(r.data.role_id));
      setCurrentUser(r.data);
    }).catch(()=>{}).finally(()=>setRoleLoading(false));
  }, [api, authHeader]);

  // Permissions fetch: try admin endpoint for role, fallback to /permissions/me
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
        if (e.response && (e.response.status === 403 || e.response.status === 401)) {
          try {
            const r2 = await api.get("/permissions/me");
            if (cancelled) return;
            const map2 = {};
            (r2.data || []).forEach(p => { map2[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view }; });
            setPermissionMap(map2);
          } catch { setPermissionMap({}); }
        } else { setPermissionMap({}); }
      } finally { if (!cancelled) setPermLoading(false); }
    }
    fetchPerms();
    return () => { cancelled = true; };
  }, [api, roleId, authHeader]);

  // Fetch data
  const fetchUnitData = async (unitKey) => {
    if (!unitKey) return;
    setLoadingRow(true);
    setMessage("");
    try {
      const res = await api.get(`/reports/single/${unitKey}/${reportDate}`);
      if (res.data) {
        const loaded = { ...initialUnitFormState, unit: unitKey };
        Object.keys(initialUnitFormState).forEach(k => { loaded[k] = res.data[k] ?? ""; });
        // prev totalizer from previous day
        try {
          const d = new Date(reportDate); d.setDate(d.getDate() - 1);
          const prevDateStr = d.toISOString().slice(0,10);
          const prevRes = await api.get(`/reports/single/${unitKey}/${prevDateStr}`);
          loaded.prev_totalizer = prevRes.data?.totalizer_mu ?? "";
        } catch { loaded.prev_totalizer = ""; }
        setUnitForms(s => ({ ...s, [unitKey]: loaded }));
        setOriginalUnitForms(s => ({ ...s, [unitKey]: { ...loaded } }));
        setIsEditingForUnit(s => ({ ...s, [unitKey]: true }));
        setMessage(`✅ Existing data loaded for ${unitKey}`);
      } else {
        setUnitForms(s => ({ ...s, [unitKey]: { ...initialUnitFormState, unit: unitKey } }));
        setOriginalUnitForms(s => ({ ...s, [unitKey]: { ...initialUnitFormState, unit: unitKey } }));
        setIsEditingForUnit(s => ({ ...s, [unitKey]: false }));
        setMessage("");
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setUnitForms(s => ({ ...s, [unitKey]: { ...initialUnitFormState, unit: unitKey } }));
        setOriginalUnitForms(s => ({ ...s, [unitKey]: { ...initialUnitFormState, unit: unitKey } }));
        setIsEditingForUnit(s => ({ ...s, [unitKey]: false }));
        setMessage("");
      } else setMessage("⚠️ Could not load unit data");
    } finally { setLoadingRow(false); }
  };

  const fetchStation = async () => {
    setLoadingRow(true);
    try {
      const res = await api.get(`/reports/station/${reportDate}`);
      if (res.data) {
        const ld = {}; Object.keys(initialStationFormState).forEach(k => ld[k] = res.data[k] ?? "");
        setStationForm(ld);
      } else setStationForm(initialStationFormState);
    } catch (e) {
      if (e.response?.status === 404) setStationForm(initialStationFormState);
      else setMessage("⚠️ Could not load station data");
    } finally { setLoadingRow(false); }
  };

  useEffect(() => {
    if (activeTab === "Station") fetchStation();
    else fetchUnitData(activeTab);
    // eslint-disable-next-line
  }, [activeTab, reportDate]);

  // Auto-calculation helpers
  const setUnitField = (unitKey, name, value) => {
    setUnitForms(prev => ({ ...prev, [unitKey]: { ...prev[unitKey], [name]: value } }));
  };

  // PLF
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const gen = parseFloat(unitForms[u].generation_mu);
      if (!isNaN(gen) && gen >= 0) {
        const plf = (gen / 3) * 100;
        const formatted = isFinite(plf) ? parseFloat(plf.toFixed(2)) : "";
        if (String(unitForms[u].plf_percent) !== String(formatted)) setUnitField(u, "plf_percent", formatted);
      }
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].generation_mu, unitForms["Unit-2"].generation_mu]);

  // Availability
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const rh = parseFloat(unitForms[u].running_hour);
      if (!isNaN(rh) && rh >= 0 && rh <= 24) {
        const av = (rh / 24) * 100;
        const f = parseFloat(av.toFixed(2));
        if (String(unitForms[u].plant_availability_percent) !== String(f)) setUnitField(u, "plant_availability_percent", f);
      }
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].running_hour, unitForms["Unit-2"].running_hour]);

  // Planned outage %
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const ph = parseFloat(unitForms[u].planned_outage_hour);
      if (!isNaN(ph) && ph >= 0) {
        const p = parseFloat(((ph/24)*100).toFixed(2));
        if (String(unitForms[u].planned_outage_percent) !== String(p)) setUnitField(u, "planned_outage_percent", p);
      }
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].planned_outage_hour, unitForms["Unit-2"].planned_outage_hour]);

  // Forced outage %
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const fh = parseFloat(unitForms[u].forced_outage_hour);
      if (!isNaN(fh) && fh >= 0) {
        const p = parseFloat(((fh/24)*100).toFixed(2));
        if (String(unitForms[u].forced_outage_percent) !== String(p)) setUnitField(u, "forced_outage_percent", p);
      }
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].forced_outage_hour, unitForms["Unit-2"].forced_outage_hour]);

  // sp_coal
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const coal = parseFloat(unitForms[u].coal_consumption_t);
      const gen = parseFloat(unitForms[u].generation_mu);
      let sp = "";
      if (!isNaN(coal) && !isNaN(gen) && gen > 0) sp = parseFloat((coal/gen).toFixed(3));
      if (String(unitForms[u].sp_coal_consumption_kg_kwh) !== String(sp)) setUnitField(u, "sp_coal_consumption_kg_kwh", sp);
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].coal_consumption_t, unitForms["Unit-1"].generation_mu, unitForms["Unit-2"].coal_consumption_t, unitForms["Unit-2"].generation_mu]);

  // sp_oil
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const oil = parseFloat(unitForms[u].ldo_hsd_consumption_kl);
      const gen = parseFloat(unitForms[u].generation_mu);
      let sp = "";
      if (!isNaN(oil) && !isNaN(gen) && gen > 0) sp = parseFloat((oil/gen).toFixed(2));
      if (String(unitForms[u].sp_oil_consumption_ml_kwh) !== String(sp)) setUnitField(u, "sp_oil_consumption_ml_kwh", sp);
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].ldo_hsd_consumption_kl, unitForms["Unit-1"].generation_mu, unitForms["Unit-2"].ldo_hsd_consumption_kl, unitForms["Unit-2"].generation_mu]);

  // aux %
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const aux = parseFloat(unitForms[u].aux_power_consumption_mu);
      const gen = parseFloat(unitForms[u].generation_mu);
      let p = "";
      if (!isNaN(aux) && !isNaN(gen) && gen > 0) p = parseFloat(((aux/gen)*100).toFixed(2));
      if (String(unitForms[u].aux_power_percent) !== String(p)) setUnitField(u, "aux_power_percent", p);
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].aux_power_consumption_mu, unitForms["Unit-1"].generation_mu, unitForms["Unit-2"].aux_power_consumption_mu, unitForms["Unit-2"].generation_mu]);

  // sp_steam
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const steam = parseFloat(unitForms[u].steam_gen_t);
      const gen = parseFloat(unitForms[u].generation_mu);
      let sp = "";
      if (!isNaN(steam) && !isNaN(gen) && gen > 0) sp = parseFloat((steam/gen).toFixed(2));
      if (String(unitForms[u].sp_steam_consumption_kg_kwh) !== String(sp)) setUnitField(u, "sp_steam_consumption_kg_kwh", sp);
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].steam_gen_t, unitForms["Unit-1"].generation_mu, unitForms["Unit-2"].steam_gen_t, unitForms["Unit-2"].generation_mu]);

  // generation from totalizer
  useEffect(() => {
    ["Unit-1","Unit-2"].forEach(u => {
      const prev = parseFloat(unitForms[u].prev_totalizer);
      const today = parseFloat(unitForms[u].totalizer_mu);
      if (!isNaN(prev) && !isNaN(today)) {
        const gen = today - prev;
        const formatted = isFinite(gen) && gen >= 0 ? parseFloat(gen.toFixed(3)) : "";
        if (String(unitForms[u].generation_mu) !== String(formatted)) setUnitField(u, "generation_mu", formatted);
      }
    });
    // eslint-disable-next-line
  }, [unitForms["Unit-1"].totalizer_mu, unitForms["Unit-1"].prev_totalizer, unitForms["Unit-2"].totalizer_mu, unitForms["Unit-2"].prev_totalizer]);

  // change detection
  const detectChangedFilledFieldsForUnit = (unitKey, candidate) => {
    const changed = [];
    Object.keys(initialUnitFormState).forEach(k => {
      if (k === "unit" || k === "prev_totalizer") return;
      if (AUTO_CALCULATED_FIELDS.includes(k)) return;
      const orig = originalUnitForms[unitKey]?.[k] ?? "";
      const curr = candidate?.[k] ?? unitForms[unitKey]?.[k] ?? "";
      if (String(orig) !== "" && String(orig) !== String(curr)) changed.push(k);
    });
    return changed;
  };

  // input handlers
  const handleUnitInputChange = (unitKey, e) => {
    const { name, value } = e.target;
    setUnitForms(prev => ({ ...prev, [unitKey]: { ...prev[unitKey], [name]: value } }));
  };
  const handleStationChange = (e) => {
    const { name, value } = e.target;
    setStationForm(s => ({ ...s, [name]: value }));
  };

  // submit handlers
  // replace your existing handleUnitSubmit with this
const handleUnitSubmit = (unitKey) => {
  if (!unitKey) return;

  console.log("[handleUnitSubmit] called for", unitKey, {
    isAdmin,
    isEditing: isEditingForUnit[unitKey],
  });

  const original = originalUnitForms[unitKey] || {};
  const current = unitForms[unitKey] || {};

  // ---------------------------------------------
  //  FIND ACTUAL CHANGED FIELDS
  // ---------------------------------------------
  const changedFields = [];

  Object.keys(current).forEach((field) => {
    if (field === "unit" || field === "prev_totalizer") return;
    if (AUTO_CALCULATED_FIELDS.includes(field)) return;

    const origVal = original[field] ?? "";
    const currVal = current[field] ?? "";

    if (String(origVal) !== String(currVal)) {
      changedFields.push(field);
    }
  });

  // ---------------------------------------------
  //  NO CHANGES → show message
  // ---------------------------------------------
  if (changedFields.length === 0) {
    setMessage("❌ No changes made to submit.");
    return;
  }

  // ---------------------------------------------
  //  NON-ADMIN FIELD VALIDATION
  // ---------------------------------------------
  if (!isAdmin) {
    for (let field of changedFields) {
      const origVal = original[field];

      const origIsEmpty =
        origVal === "" || origVal === null || origVal === undefined;

      // If the original field had a value, block editing
      if (!origIsEmpty) {
        setMessage(`❌ Only admin can edit existing field: ${field}`);
        return;
      }
    }
  }

  // ---------------------------------------------
  //  PASSED ALL CHECKS → show confirmation popup
  // ---------------------------------------------
  setShowConfirmPopup(true);
};



  // replace your existing handleConfirmUnitSubmit with this
const handleConfirmUnitSubmit = async (unitKey) => {
  const u = unitKey || activeTab;
  console.log("[handleConfirmUnitSubmit] starting for", u);

  // close popup immediately
  setShowConfirmPopup(false);
  setSubmitting(s => ({ ...s, [u]: true }));
  setMessage("");

  try {
    // Prepare payload
    const payload = { ...unitForms[u], report_date: reportDate };
    delete payload.prev_totalizer;

    // convert empty → null, numeric strings → number
    Object.keys(payload).forEach(k => {
      if (k === "unit" || k === "report_date") return;
      if (payload[k] === "" || payload[k] === undefined) {
        payload[k] = null;
      } else if (!isNaN(parseFloat(payload[k])) && isFinite(payload[k])) {
        payload[k] = parseFloat(payload[k]);
      }
    });

    // -----------------------------------------
    //  NON-ADMIN VALIDATION (field-by-field)
    // -----------------------------------------
    if (!isAdmin) {
      for (let field in payload) {
        if (field === "unit" || field === "report_date") continue;

        const orig = originalUnitForms[u]?.[field];
        const curr = payload[field];

        const origIsEmpty = orig === "" || orig === null || orig === undefined;

        // If original had value -> block non-admin
        if (!origIsEmpty && String(orig) !== String(curr)) {
          setMessage(`❌ Only admin can edit existing field: ${field}`);
          setSubmitting(s => ({ ...s, [u]: false }));
          return;
        }
      }
    }

    // -----------------------------------------
    //  SEND DATA
    // -----------------------------------------
    console.log("[handleConfirmUnitSubmit] posting payload:", payload);
    const resp = await api.post("/reports/", payload);
    console.log("[handleConfirmUnitSubmit] response:", resp?.data);

    setMessage(isEditingForUnit[u]
      ? "✅ Report updated successfully"
      : "✅ Report added successfully"
    );

    // -----------------------------------------
    //  NORMALIZE VALUES (IMPORTANT FIX)
    // -----------------------------------------
    const normalized = {};
    Object.keys(unitForms[u]).forEach(k => {
      const v = unitForms[u][k];
      if (v === "" || v === null || v === undefined) normalized[k] = "";
      else if (!isNaN(v)) normalized[k] = Number(v);
      else normalized[k] = v;
    });

    // Update original forms with normalized values
    setOriginalUnitForms(s => ({
      ...s,
      [u]: normalized
    }));

    // Also normalize unitForms so both sides always match
    setUnitForms(s => ({
      ...s,
      [u]: normalized
    }));

    // Mark row as editing mode going forward
    setIsEditingForUnit(s => ({ ...s, [u]: true }));

  } catch (e) {
    console.error("[handleConfirmUnitSubmit] error:", e);
    const det = e?.response?.data?.detail || e.message || "Error saving data";
    setMessage(`❌ ${det}`);
  } finally {
    setSubmitting(s => ({ ...s, [u]: false }));
  }
};



  const handleStationSubmit = async () => {
  setSubmitting(s => ({ ...s, station: true }));
  setMessage("");

  try {
    const original = originalStationForm || {};
    const current = stationForm || {};

    // ---------------------------------------------
    //  FIND CHANGED FIELDS
    // ---------------------------------------------
    const changedFields = [];

    Object.keys(current).forEach(field => {
      if (field === "report_date") return;

      const origVal = original[field] ?? "";
      const currVal = current[field] ?? "";

      if (String(origVal) !== String(currVal)) {
        changedFields.push(field);
      }
    });

    // ---------------------------------------------
    //  NO CHANGES → notify user
    // ---------------------------------------------
    if (changedFields.length === 0) {
      setMessage("❌ No changes made to submit.");
      return;
    }

    // ---------------------------------------------
    //  NON-ADMIN VALIDATION (field-level)
    // ---------------------------------------------
    if (!isAdmin) {
      for (let field of changedFields) {
        const origVal = original[field];

        const origIsEmpty =
          origVal === "" || origVal === null || origVal === undefined;

        // Non-admin cannot modify filled fields
        if (!origIsEmpty) {
          setMessage(`❌ Only admin can edit existing field: ${field}`);
          return;
        }
      }
    }

    // ---------------------------------------------
    //  BUILD PAYLOAD
    // ---------------------------------------------
    const payload = { ...current, report_date: reportDate };

    Object.keys(payload).forEach(k => {
      if (k === "report_date") return;

      if (payload[k] === "" || payload[k] === null || payload[k] === undefined) {
        payload[k] = null;
      } else if (!isNaN(parseFloat(payload[k])) && isFinite(payload[k])) {
        payload[k] = parseFloat(payload[k]);
      }
    });

    // ---------------------------------------------
    //  SEND API REQUEST
    // ---------------------------------------------
    await api.post("/reports/station/", payload);

    setMessage(
      Object.values(original).some(v => v !== "" && v !== null && v !== undefined)
        ? "✅ Station data updated successfully."
        : "✅ Station data added successfully."
    );

    // ---------------------------------------------
    //  NORMALIZE AND UPDATE ORIGINAL FORM
    // ---------------------------------------------
    const normalized = {};
    Object.keys(current).forEach(k => {
      const v = current[k];
      if (v === "" || v === null || v === undefined) normalized[k] = "";
      else if (!isNaN(v)) normalized[k] = Number(v);
      else normalized[k] = v;
    });

    setOriginalStationForm(normalized);

    // Keep UI consistent
    setStationForm(normalized);

  } catch (e) {
    const det = e.response?.data?.detail || "Error saving station data";
    setMessage(`❌ ${det}`);
  } finally {
    setSubmitting(s => ({ ...s, station: false }));
  }
};



  // permission helpers
  const canView = (fieldName) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[fieldName]; if (!p) return true; return !!p.can_view;
  };
  const canEdit = (fieldName) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[fieldName]; if (!p) return false; return !!p.can_edit;
  };

  // UI helpers
  const disabledClassForD3 = "bg-orange-50 text-orange-800 border-orange-200 cursor-not-allowed";



  const renderInput = (unitKey, name, label, type = "number", autoReadOnly = false) => {
  const hidden = !canView(name);
  if (hidden) return null;

  const value = unitForms[unitKey]?.[name] ?? "";
  const editableByPermission = canEdit(name);
  const isAutoCalc = AUTO_CALCULATED_FIELDS.includes(name);

  // 🚀 FIX: Check ORIGINAL value, not current typed value
  const originalHasValue =
    originalUnitForms[unitKey]?.[name] !== "" &&
    originalUnitForms[unitKey]?.[name] !== null &&
    originalUnitForms[unitKey]?.[name] !== undefined;

  const readOnly =
    autoReadOnly ||
    isAutoCalc ||
    !editableByPermission ||
    (!isAdmin && originalHasValue); // ✔ non-admin can edit only if original was empty

  const baseClass = "w-full p-2 rounded text-sm border transition";
  const finalClass = readOnly
    ? `${baseClass} bg-orange-50 text-orange-800 border-orange-200 cursor-not-allowed`
    : `${baseClass} bg-white border-gray-300 focus:border-orange-500`;

  return (
    <div key={name}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) => !readOnly && handleUnitInputChange(unitKey, e)}
        className={finalClass}
      />
    </div>
  );
};

 const renderStationInput = (name, label) => {
  const hidden = !canView(name);
  if (hidden) return null;

  const value = stationForm[name] ?? "";
  const editableByPermission = canEdit(name);

  // 🚀 FIX: Check original station value
  const originalHasValue =
    originalStationForm[name] !== "" &&
    originalStationForm[name] !== null &&
    originalStationForm[name] !== undefined;

  const readOnly =
    !editableByPermission ||
    (!isAdmin && originalHasValue); // ✔ same rule as unit

  const baseClass = "w-full p-2 rounded text-sm border transition";
  const finalClass = readOnly
    ? `${baseClass} bg-orange-50 text-orange-800 border-orange-200 cursor-not-allowed`
    : `${baseClass} bg-white border-gray-300 focus:border-orange-500`;

  return (
    <div key={name}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        name={name}
        type="number"
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) => !readOnly && handleStationChange(e)}
        className={finalClass}
      />
    </div>
  );
};

  // confirmation list
  const getChangedManualFieldsForDisplay = (unitKey) => {
    const skip = ["prev_totalizer", "unit"];
    const result = [];
    Object.keys(initialUnitFormState).forEach(k => {
      if (skip.includes(k)) return;
      if (AUTO_CALCULATED_FIELDS.includes(k)) return;
      const orig = originalUnitForms[unitKey]?.[k] ?? "";
      const curr = unitForms[unitKey]?.[k] ?? "";
      if (String(orig) !== String(curr) && String(curr) !== "") result.push({ key: k, label: prettify(k), value: String(curr) });
    });
    return result;
  };
  const prettify = (k) => k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // Render
  return (
    <div className="flex gap-6 p-6 max-w-7xl mx-auto">
      {/* Sidebar */}
      <aside className="w-64 bg-white rounded-lg shadow py-4 px-3 flex flex-col gap-4">
        <div>
          <label className="block text-xs text-gray-500">Date</label>
          <input type="date" className="w-full p-2 rounded border border-gray-300" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">Tabs</div>
          <div className="flex flex-col gap-2">
            {["Unit-1","Unit-2","Station"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`text-left p-2 rounded-md transition ${activeTab===t ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {t} {activeTab===t && <span className="ml-2 text-xs opacity-70">{loadingRow ? <Spinner size={12} /> : ""}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto text-xs text-gray-500">
          <div><strong>User Role:</strong> {roleLoading ? <Spinner size={12} /> : currentUser?.role_id || roleId || "Unknown"}</div>
          <div className="mt-1 text-sm text-orange-700">{message}</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{activeTab} Report</h2>
            <div className="text-sm text-gray-600">
              {permLoading ? <span className="inline-flex items-center gap-2"><Spinner size={14} /> Loading permissions</span> : <span className="text-green-600">Permissions loaded</span>}
            </div>
          </div>

          {/* Unit forms */}
          {activeTab === "Unit-1" || activeTab === "Unit-2" ? (
            <>
              <form onSubmit={(e)=>{e.preventDefault(); handleUnitSubmit(activeTab);}}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Prev Totalizer (MU)</label>
                    <input value={unitForms[activeTab].prev_totalizer ?? ""} readOnly className="w-full p-2 rounded border border-gray-200 bg-gray-100 text-sm" />
                  </div>

                  <div>{renderInput(activeTab,"totalizer_mu","Totalizer (MU) — today")}</div>
                  <div>{renderInput(activeTab,"generation_mu","Generation (MU)","number", true)}</div>
                  <div>{renderInput(activeTab,"plf_percent","PLF (%)","number", true)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div>{renderInput(activeTab,"running_hour","Running Hour")}</div>
                  <div>{renderInput(activeTab,"plant_availability_percent","Plant Availability (%)","number", true)}</div>
                  <div>{renderInput(activeTab,"planned_outage_hour","Planned Outage (Hr)")}</div>
                  <div>{renderInput(activeTab,"planned_outage_percent","Planned Outage (%)","number", true)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div>{renderInput(activeTab,"forced_outage_hour","Forced Outage (Hr)")}</div>
                  <div>{renderInput(activeTab,"forced_outage_percent","Forced Outage (%)","number", true)}</div>
                  <div>{renderInput(activeTab,"strategic_outage_hour","Strategic Outage (Hr)")}</div>
                  <div />
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Fuel & Efficiency</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>{renderInput(activeTab,"coal_consumption_t","Coal (T)")}</div>
                    <div>{renderInput(activeTab,"sp_coal_consumption_kg_kwh","Sp. Coal (kg/kwh)","number", true)}</div>
                    <div>{renderInput(activeTab,"avg_gcv_coal_kcal_kg","Avg GCV (kcal/kg)")}</div>
                    <div>{renderInput(activeTab,"heat_rate","Heat Rate")}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Auxiliary, Water, Steam & Emissions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>{renderInput(activeTab,"aux_power_consumption_mu","Aux. Power (MU)")}</div>
                    <div>{renderInput(activeTab,"aux_power_percent","Aux. Power (%)","number", true)}</div>
                    <div>{renderInput(activeTab,"dm_water_consumption_cu_m","DM Water (Cu.m)")}</div>
                    <div>{renderInput(activeTab,"sp_dm_water_consumption_percent","Sp. DM Water (%)","number", true)}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>{renderInput(activeTab,"steam_gen_t","Steam Gen (T)")}</div>
                    <div>{renderInput(activeTab,"sp_steam_consumption_kg_kwh","Sp. Steam (kg/kwh)","number", true)}</div>
                    <div>{renderInput(activeTab,"stack_emission_spm_mg_nm3","Stack Emission (mg/Nm3)")}</div>
                    <div />
                  </div>
                </div>

                <div className="mt-6">
                  <button
  type="submit"
  disabled={submitting[activeTab] || loadingRow}
  className={`px-4 py-2 rounded font-medium shadow ${
    submitting[activeTab]
      ? "bg-gray-300 text-gray-600"
      : isEditingForUnit[activeTab]
      ? "bg-yellow-500 text-white hover:bg-yellow-600"
      : "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:from-orange-600 hover:to-amber-500"
  }`}
>
  {submitting[activeTab]
    ? "Processing..."
    : isEditingForUnit[activeTab]
    ? "Update Unit Data"
    : "Submit Unit Report"}
</button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={(e)=>{e.preventDefault(); handleStationSubmit();}}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderStationInput("avg_raw_water_used_cu_m_hr","Avg. Raw Water (Cu.m/hr)")}
                {renderStationInput("total_raw_water_used_cu_m","Total Raw Water (Cu.m)")}
                {renderStationInput("sp_raw_water_used_ltr_kwh","Sp. Raw Water (Ltr/kWh)")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {renderStationInput("ro_plant_running_hrs","RO Plant Running (Hrs)")}
                {renderStationInput("ro_plant_il","RO Plant I/L")}
                {renderStationInput("ro_plant_ol","RO Plant O/L")}
              </div>

              <div className="mt-6">
                <button
  type="submit"
  disabled={submitting.station}
  className="px-4 py-2 rounded bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:from-orange-600 hover:to-amber-500"
>
  {submitting.station ? "Processing..." : "Save Station Data"}
</button>
              </div>
            </form>
          )}

         

          {/* Confirm popup */}
          {showConfirmPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-5 rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
                <h3 className="text-lg font-semibold mb-3 text-center text-orange-800">Confirm changed values</h3>
                <div className="space-y-2 mb-4">
                  {activeTab !== "Station" ? (
                    <>
                      {getChangedManualFieldsForDisplay(activeTab).length === 0 ? (
                        <div className="text-sm text-gray-600">No manual changes to confirm.</div>
                      ) : (
                        <ul className="list-disc ml-5 text-sm">
                          {getChangedManualFieldsForDisplay(activeTab).map(f => <li key={f.key} className="py-1"><span className="font-medium">{f.label}:</span> <span className="font-mono">{f.value}</span></li>)}
                        </ul>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-600">Confirm saving station data?</div>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button className="bg-gray-400 px-3 py-1 rounded text-white" onClick={()=>setShowConfirmPopup(false)}>Cancel</button>
                  <button className="bg-orange-600 px-3 py-1 rounded text-white" onClick={() => { if (activeTab==="Station") handleStationSubmit(); else handleConfirmUnitSubmit(activeTab); }}>Confirm & Submit</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
