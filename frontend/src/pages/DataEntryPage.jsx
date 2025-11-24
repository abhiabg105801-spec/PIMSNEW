import React, { useState, useEffect } from "react";
import axios from "axios";

// Compact numeric input component
const InputField = ({ label, name, value, onChange, readOnly = false, className = "" }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600">{label}</label>
    <input
      type="number"
      name={name}
      value={value ?? ""}
      onChange={onChange}
      readOnly={readOnly}
      className={`mt-1 block w-full border rounded-md p-1.5 text-sm border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 transition duration-150 ease-in-out ${
        readOnly ? "bg-gray-100 cursor-not-allowed" : ""
      }`}
      step="any"
    />
  </div>
);

// --- FORM STATES ---
const initialUnitFormState = {
  unit: "",
  totalizer_mu: "",
  prev_totalizer: "",
  generation_mu: "",
  plf_percent: "",
  running_hour: "",
  plant_availability_percent: "",
  planned_outage_hour: "",
  planned_outage_percent: "",
  forced_outage_hour: "",
  forced_outage_percent: "",
  strategic_outage_hour: "",
  coal_consumption_t: "",
  sp_coal_consumption_kg_kwh: "",
  avg_gcv_coal_kcal_kg: "",
  heat_rate: "",
  ldo_hsd_consumption_kl: "",
  sp_oil_consumption_ml_kwh: "",
  aux_power_consumption_mu: "",
  aux_power_percent: "",
  dm_water_consumption_cu_m: "",
  sp_dm_water_consumption_percent: "",
  steam_gen_t: "",
  sp_steam_consumption_kg_kwh: "",
  stack_emission_spm_mg_nm3: ""
};
const initialStationFormState = {
  avg_raw_water_used_cu_m_hr: "",
  total_raw_water_used_cu_m: "",
  sp_raw_water_used_ltr_kwh: "",
  ro_plant_running_hrs: "",
  ro_plant_il: "",
  ro_plant_ol: ""
};

// Fields that are auto-calculated (exclude from confirmation popup)
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
  "sp_steam_consumption_kg_kwh"
];

export default function DataEntryPage({ auth }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  // Unit form state
  const [unitForm, setUnitForm] = useState(initialUnitFormState);
  const [originalUnitForm, setOriginalUnitForm] = useState(initialUnitFormState); // snapshot of last saved values
  const [isEditing, setIsEditing] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unitMessage, setUnitMessage] = useState("");
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitFetching, setUnitFetching] = useState(false);

  // Confirmation popup
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  // keys of originally-filled fields that were changed (used to decide password requirement)
  const [changedFilledFields, setChangedFilledFields] = useState([]);

  // Station form state
  const [stationForm, setStationForm] = useState(initialStationFormState);
  const [stationMessage, setStationMessage] = useState("");
  const [stationSubmitting, setStationSubmitting] = useState(false);
  const [stationFetching, setStationFetching] = useState(false);

  const API_URL = "http://localhost:8080/api";


  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: auth,  // "Bearer <jwt>"
    },
  });

  // Auto-logout if JWT expired → backend returns 401
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem("authToken");
        window.location.reload(); // force logout
      }
      return Promise.reject(err);
    }
  );

  // --- EFFECTS ---

  useEffect(() => {
    if (unitForm.unit && reportDate) {
      checkExistingUnitData();
    } else {
      setUnitForm((prev) => ({ ...initialUnitFormState, unit: prev.unit }));
      setOriginalUnitForm(initialUnitFormState);
      setIsEditing(false);
      setUnitMessage("");
      setChangedFilledFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitForm.unit, reportDate]);

  useEffect(() => {
    if (reportDate) {
      checkExistingStationData();
      if (unitForm.unit) {
        checkExistingUnitData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate]);

  // Auto-calculations (unchanged logic)
  useEffect(() => {
    const generation = parseFloat(unitForm.generation_mu);
    if (!isNaN(generation) && generation >= 0) {
      const plf = (generation / 3) * 100;
      const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
      const formattedPlf = formatCalc(plf, 2);
      if (unitForm.plf_percent !== formattedPlf) {
        setUnitForm((prev) => ({ ...prev, plf_percent: formattedPlf }));
      }
    } else {
      if (unitForm.plf_percent !== "") setUnitForm((prev) => ({ ...prev, plf_percent: "" }));
    }
  }, [unitForm.generation_mu]);

  useEffect(() => {
    const runningHour = parseFloat(unitForm.running_hour);
    if (!isNaN(runningHour) && runningHour >= 0 && runningHour <= 24) {
      const availability = (runningHour / 24) * 100;
      const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
      const formattedAvailability = formatCalc(availability, 2);
      if (unitForm.plant_availability_percent !== formattedAvailability) {
        setUnitForm((prev) => ({ ...prev, plant_availability_percent: formattedAvailability }));
      }
    } else {
      if (unitForm.plant_availability_percent !== "") setUnitForm((prev) => ({ ...prev, plant_availability_percent: "" }));
    }
  }, [unitForm.running_hour]);

  useEffect(() => {
    const plannedHour = parseFloat(unitForm.planned_outage_hour);
    if (!isNaN(plannedHour) && plannedHour >= 0) {
      const percentage = (plannedHour / 24) * 100;
      const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
      const formattedPercentage = formatCalc(percentage, 2);
      if (unitForm.planned_outage_percent !== formattedPercentage) {
        setUnitForm((prev) => ({ ...prev, planned_outage_percent: formattedPercentage }));
      }
    } else {
      if (unitForm.planned_outage_percent !== "") setUnitForm((prev) => ({ ...prev, planned_outage_percent: "" }));
    }
  }, [unitForm.planned_outage_hour]);

  useEffect(() => {
    const forcedHour = parseFloat(unitForm.forced_outage_hour);
    if (!isNaN(forcedHour) && forcedHour >= 0) {
      const percentage = (forcedHour / 24) * 100;
      const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
      const formattedPercentage = formatCalc(percentage, 2);
      if (unitForm.forced_outage_percent !== formattedPercentage) {
        setUnitForm((prev) => ({ ...prev, forced_outage_percent: formattedPercentage }));
      }
    } else {
      if (unitForm.forced_outage_percent !== "") setUnitForm((prev) => ({ ...prev, forced_outage_percent: "" }));
    }
  }, [unitForm.forced_outage_hour]);

  useEffect(() => {
    const coal = parseFloat(unitForm.coal_consumption_t);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
    let formattedSpCoal = "";
    if (!isNaN(coal) && coal >= 0 && !isNaN(generation) && generation > 0) {
      const spCoal = coal / generation;
      formattedSpCoal = formatCalc(spCoal, 3);
    }
    if (unitForm.sp_coal_consumption_kg_kwh !== formattedSpCoal) {
      setUnitForm((prev) => ({ ...prev, sp_coal_consumption_kg_kwh: formattedSpCoal }));
    }
  }, [unitForm.coal_consumption_t, unitForm.generation_mu]);

  useEffect(() => {
    const oil = parseFloat(unitForm.ldo_hsd_consumption_kl);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, decimals = 2) => (isNaN(num) ? "" : parseFloat(num.toFixed(decimals)));
    let formattedSpOil = "";
    if (!isNaN(oil) && oil >= 0 && !isNaN(generation) && generation > 0) {
      const spOil = oil / generation;
      formattedSpOil = formatCalc(spOil, 2);
    }
    if (unitForm.sp_oil_consumption_ml_kwh !== formattedSpOil) {
      setUnitForm((prev) => ({ ...prev, sp_oil_consumption_ml_kwh: formattedSpOil }));
    }
  }, [unitForm.ldo_hsd_consumption_kl, unitForm.generation_mu]);

  useEffect(() => {
    const auxPower = parseFloat(unitForm.aux_power_consumption_mu);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, places = 2) => {
      if (isNaN(num) || !isFinite(num)) return "";
      const factor = Math.pow(10, places);
      return (Math.round(num * factor) / factor).toFixed(places);
    };
    let formattedAuxPerc = "";
    if (!isNaN(auxPower) && auxPower >= 0 && !isNaN(generation) && generation > 0) {
      const auxPerc = (auxPower / generation) * 100;
      formattedAuxPerc = formatCalc(auxPerc, 2);
    }
    if (unitForm.aux_power_percent !== formattedAuxPerc) {
      setUnitForm((prev) => ({ ...prev, aux_power_percent: formattedAuxPerc }));
    }
  }, [unitForm.aux_power_consumption_mu, unitForm.generation_mu]);

  useEffect(() => {
    const steam = parseFloat(unitForm.steam_gen_t);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, places = 2) => {
      if (isNaN(num) || !isFinite(num)) return "";
      const factor = Math.pow(10, places);
      return (Math.round(num * factor) / factor).toFixed(places);
    };
    let formattedSpSteam = "";
    if (!isNaN(steam) && steam >= 0 && !isNaN(generation) && generation > 0) {
      const spSteam = steam / generation;
      formattedSpSteam = formatCalc(spSteam, 2);
    }
    if (unitForm.sp_steam_consumption_kg_kwh !== formattedSpSteam) {
      setUnitForm((prev) => ({ ...prev, sp_steam_consumption_kg_kwh: formattedSpSteam }));
    }
  }, [unitForm.steam_gen_t, unitForm.generation_mu]);

  // Auto-calc generation based on today's totalizer (totalizer_mu) and prev_totalizer
  useEffect(() => {
    const prev = parseFloat(unitForm.prev_totalizer);
    const today = parseFloat(unitForm.totalizer_mu);
    if (!isNaN(prev) && !isNaN(today)) {
      const gen = today - prev;
      if (!isNaN(gen) && isFinite(gen) && gen >= 0) {
        const formatted = parseFloat(gen.toFixed(3));
        if (unitForm.generation_mu !== String(formatted)) {
          setUnitForm((prevState) => ({ ...prevState, generation_mu: String(formatted) }));
        }
      } else {
        if (unitForm.generation_mu !== "") setUnitForm((prevState) => ({ ...prevState, generation_mu: "" }));
      }
    } else {
      if (unitForm.generation_mu !== "") setUnitForm((prevState) => ({ ...prevState, generation_mu: "" }));
    }
  }, [unitForm.totalizer_mu, unitForm.prev_totalizer]);

  // --- Data Fetching Functions ---
  const checkExistingUnitData = async () => {
    if (!unitForm.unit || !reportDate) return;
    setUnitFetching(true);
    setUnitMessage("");
    try {
      const res = await api.get(`/reports/single/${unitForm.unit}/${reportDate}`);

      if (res.data) {
        const loadedData = { ...initialUnitFormState, unit: unitForm.unit };

        Object.keys(initialUnitFormState).forEach((key) => {
          if (key === "totalizer_mu") {
            loadedData.totalizer_mu = res.data.totalizer_mu ?? "";
          } else {
            loadedData[key] = res.data[key] ?? "";
          }
        });

        setUnitForm(loadedData);
        // store original snapshot for change detection
        setOriginalUnitForm(loadedData);
        setIsEditing(true);
        setUnitMessage(`✅ Existing data loaded for ${unitForm.unit}`);
        setChangedFilledFields([]);
      } else {
        setIsEditing(false);
        setUnitForm((prev) => ({ ...initialUnitFormState, unit: prev.unit }));
        setOriginalUnitForm(initialUnitFormState);
        setUnitMessage("No existing data found for this unit/date.");
      }
    } catch (err) {
      setIsEditing(false);
      setUnitForm((prev) => ({ ...initialUnitFormState, unit: prev.unit }));
      setOriginalUnitForm(initialUnitFormState);
      if (err.response?.status !== 404) {
        setUnitMessage("⚠️ Could not load unit data.");
      } else {
        setUnitMessage("");
      }
    }

    // previous day's totalizer
    try {
      const d = new Date(reportDate);
      d.setDate(d.getDate() - 1);
      const prevDateStr = d.toISOString().slice(0, 10);

      const prevRes = await api.get(`/reports/single/${unitForm.unit}/${prevDateStr}`);

      const prevTotal = prevRes.data?.totalizer_mu ?? "";
      setUnitForm((prev) => ({ ...prev, prev_totalizer: prevTotal }));
      setOriginalUnitForm((prev) => ({ ...prev, prev_totalizer: prevTotal }));
    } catch (err) {
      setUnitForm((prev) => ({ ...prev, prev_totalizer: "" }));
      setOriginalUnitForm((prev) => ({ ...prev, prev_totalizer: "" }));
    } finally {
      setUnitFetching(false);
    }
  };

  const checkExistingStationData = async () => {
    if (!reportDate) return;
    setStationFetching(true);
    setStationMessage("");
    try {
      const res = await api.get(`/reports/station/${reportDate}`);
      if (res.data) {
        const loadedData = {};
        Object.keys(initialStationFormState).forEach((key) => {
          loadedData[key] = res.data[key] ?? "";
        });
        setStationForm(loadedData);
      } else {
        setStationForm(initialStationFormState);
      }
    } catch (err) {
      setStationForm(initialStationFormState);
      if (err.response?.status !== 404) setStationMessage("⚠️ Could not load station data.");
      else setStationMessage("");
    } finally {
      setStationFetching(false);
    }
  };

  // --- Input Handlers ---
  const handleUnitChange = (e) => {
    const { name, value } = e.target;
    if (name === "unit") {
      setUnitForm({ ...initialUnitFormState, unit: value });
      setOriginalUnitForm(initialUnitFormState);
      setIsEditing(false);
      setUnitMessage("");
      setChangedFilledFields([]);
    } else {
      setUnitForm((prev) => {
        const next = { ...prev, [name]: value };
        detectChangedFilledFields(next);
        return next;
      });
    }
  };

  const handleStationChange = (e) => {
    const { name, value } = e.target;
    setStationForm((prevState) => ({ ...prevState, [name]: value }));
  };

  // detect which originally-filled fields (originalUnitForm) have been changed
  // Only considers fields that originally had a value (orig !== ""), and that are NOT auto-calculated
  const detectChangedFilledFields = (newUnitForm) => {
    const changed = [];
    Object.keys(initialUnitFormState).forEach((key) => {
      if (key === "unit" || key === "prev_totalizer") return;
      if (AUTO_CALCULATED_FIELDS.includes(key)) return; // ignore auto-calculated fields
      const orig = originalUnitForm[key] ?? "";
      const curr = newUnitForm[key] ?? "";
      if (String(orig) !== "" && String(orig) !== String(curr)) {
        changed.push(key);
      }
    });
    setChangedFilledFields(changed);
  };

  // --- Submit Handlers ---
  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    if (!unitForm.unit) {
      setUnitMessage("❌ Please select a unit first.");
      return;
    }

    // detect any change overall (including new fills) ignoring prev_totalizer
    const anyChange = Object.keys(initialUnitFormState).some((key) => {
      if (key === "unit" || key === "prev_totalizer") return false;
      // ignore auto-calculated fields for determining if user did any change? NO — we should consider manual inputs
      if (AUTO_CALCULATED_FIELDS.includes(key)) return false;
      const orig = originalUnitForm[key] ?? "";
      const curr = unitForm[key] ?? "";
      return String(orig) !== String(curr);
    });

    if (isEditing && !anyChange) {
      setUnitMessage("❌ No changes made to submit.");
      return;
    }

    // If editing and user modified any originally-filled field -> require password first
    if (isEditing && changedFilledFields.length > 0) {
      setShowPasswordModal(true);
      return;
    }

    // Otherwise show confirmation popup (it will list all manual changed fields - both new fills and changed ones - excluding auto-calculated fields)
    setShowConfirmPopup(true);
  };

  // Called after confirmation popup's Confirm button
  const handleConfirmUnitSubmit = async () => {
    setUnitSubmitting(true);
    setUnitMessage("");
    setShowConfirmPopup(false);

    const dataToSend = {
      ...unitForm,
      report_date: reportDate
    };

    // Remove prev_totalizer before sending
    if ("prev_totalizer" in dataToSend) delete dataToSend.prev_totalizer;

    // Normalize payload: convert "" to null and numeric strings to floats
    for (const key in dataToSend) {
      if (key === "report_date" || key === "unit" || key === "edit_password") continue;
      if (dataToSend[key] === "") dataToSend[key] = null;
      else if (typeof dataToSend[key] === "string" && !isNaN(parseFloat(dataToSend[key])) && isFinite(dataToSend[key])) {
        dataToSend[key] = parseFloat(dataToSend[key]);
      }
    }

    // Attach edit_password only if we have it (i.e., password modal was used)
    if (isEditing && editPassword) dataToSend.edit_password = editPassword;

    try {
      await api.post(`/reports/`, dataToSend);
      setUnitMessage(isEditing ? "✅ Report updated successfully" : "✅ Report added successfully");
      setIsEditing(true);
      // after successful save, update original snapshot to current values
      setOriginalUnitForm({ ...unitForm });
      setChangedFilledFields([]);
      setEditPassword("");
    } catch (err) {
      let errorDetail = err.response?.data?.detail || "Error saving data";
      if (Array.isArray(errorDetail)) {
        errorDetail = errorDetail.map((d) => `${d.loc.slice(-1)[0]} - ${d.msg}`).join("; ");
      }
      setUnitMessage(`❌ ${errorDetail}`);
      // if edit attempt failed and we were editing, reopen password modal so user can retry
      if (isEditing && changedFilledFields.length > 0) setShowPasswordModal(true);
    } finally {
      setUnitSubmitting(false);
    }
  };

  // Called when password modal confirm clicked
  const handlePasswordConfirm = () => {
    // If user confirmed password, close password modal and show confirmation popup
    setShowPasswordModal(false);
    // we keep editPassword in state (user typed it); it will be attached on final submit
    setShowConfirmPopup(true);
  };

  const handleStationSubmit = async (e) => {
    e.preventDefault();
    setStationSubmitting(true);
    setStationMessage("");

    const dataToSend = { ...stationForm, report_date: reportDate };
    for (const key in dataToSend) {
      if (key === "report_date") continue;
      if (dataToSend[key] === "") dataToSend[key] = null;
      else if (typeof dataToSend[key] === "string" && !isNaN(parseFloat(dataToSend[key])) && isFinite(dataToSend[key])) {
        dataToSend[key] = parseFloat(dataToSend[key]);
      }
    }

    try {
      await api.post(`/reports/station/`, dataToSend);
      setStationMessage("✅ Station data saved successfully.");
    } catch (err) {
      let errorDetail = err.response?.data?.detail || "Error saving station data";
      if (Array.isArray(errorDetail)) {
        errorDetail = errorDetail.map((d) => `${d.loc.slice(-1)[0]} - ${d.msg}`).join("; ");
      }
      setStationMessage(`❌ ${errorDetail}`);
    } finally {
      setStationSubmitting(false);
    }
  };

  // Utility: prepare list of changed manual fields for confirmation popup (only show new value)
  const getChangedManualFieldsForDisplay = () => {
    const skip = ["prev_totalizer", "unit"];
    const result = [];
    Object.keys(initialUnitFormState).forEach((key) => {
      if (skip.includes(key)) return;
      if (AUTO_CALCULATED_FIELDS.includes(key)) return; // exclude auto-calculated fields
      const orig = originalUnitForm[key] ?? "";
      const curr = unitForm[key] ?? "";
      if (String(orig) !== String(curr) && String(curr) !== "") {
        result.push({ key, label: prettifyKey(key), value: String(curr) });
      } else if (String(orig) !== String(curr) && String(curr) === "") {
        // changed to empty string: show as empty? per request we show only new value — skip empty new
        // so do not include blank new values
      }
    });
    return result;
  };

  const prettifyKey = (k) =>
    k
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // --- Compact UI Layout ---
  return (
    <div className="max-w-5xl mx-auto my-4">
      {/* Fixed Top Bar: Date + Unit selector (separated from table) */}
      <div className="sticky top-4 z-20 bg-white p-3 rounded-md shadow-sm border border-gray-200 mb-3 flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600">Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-44 border rounded p-1 text-sm"
          />
        </div>

        <div className="w-44">
          <label className="block text-xs font-medium text-gray-600">Unit</label>
          <select name="unit" value={unitForm.unit} onChange={handleUnitChange} className="w-full border rounded p-1 text-sm">
            <option value="">Select Unit</option>
            <option value="Unit-1">Unit-1</option>
            <option value="Unit-2">Unit-2</option>
          </select>
        </div>

        <div className="ml-auto text-right">
          <div className="text-xs text-gray-500">Status</div>
          <div className={`text-sm ${unitMessage.startsWith("❌") || unitMessage.startsWith("⚠️") ? "text-red-600" : "text-orange-700"}`}>
            {unitMessage || (unitFetching ? "Loading..." : "")}
          </div>
        </div>
      </div>

      {/* Main compact card (unit form) */}
      <div className="p-3 bg-orange-50 rounded-lg shadow-md mb-4 border border-orange-200">
        <h2 className="text-sm font-semibold text-orange-800 mb-2 text-center">Per-Unit Daily Report</h2>

        <form onSubmit={handleUnitSubmit} className="space-y-3">
          {/* Performance & Availability (compact grid) */}
          <h3 className="text-xs font-semibold text-orange-700">Performance & Availability</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField
              label="Prev Totalizer (MU)"
              name="prev_totalizer"
              value={unitForm.prev_totalizer}
              onChange={handleUnitChange}
              readOnly
            />

            <InputField
              label="Totalizer (MU) — today"
              name="totalizer_mu"
              value={unitForm.totalizer_mu}
              onChange={handleUnitChange}
            />

            <InputField
              label="Generation (MU)"
              name="generation_mu"
              value={unitForm.generation_mu}
              onChange={handleUnitChange}
              readOnly
            />

            <InputField
              label="PLF (%)"
              name="plf_percent"
              value={unitForm.plf_percent}
              onChange={handleUnitChange}
              readOnly
            />
          </div>

          {/* Running / Availability */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="Running Hour" name="running_hour" value={unitForm.running_hour} onChange={handleUnitChange} />
            <InputField label="Plant Availability (%)" name="plant_availability_percent" value={unitForm.plant_availability_percent} onChange={handleUnitChange} readOnly />
            <InputField label="Planned Outage (Hr)" name="planned_outage_hour" value={unitForm.planned_outage_hour} onChange={handleUnitChange} />
            <InputField label="Planned Outage (%)" name="planned_outage_percent" value={unitForm.planned_outage_percent} onChange={handleUnitChange} readOnly />
          </div>

          {/* Outages row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="Forced Outage (Hr)" name="forced_outage_hour" value={unitForm.forced_outage_hour} onChange={handleUnitChange} />
            <InputField label="Forced Outage (%)" name="forced_outage_percent" value={unitForm.forced_outage_percent} onChange={handleUnitChange} readOnly />
            <InputField label="Strategic Outage (Hr)" name="strategic_outage_hour" value={unitForm.strategic_outage_hour} onChange={handleUnitChange} />
            <div />
          </div>

          {/* Fuel & Efficiency */}
          <h3 className="text-xs font-semibold text-orange-700">Fuel & Efficiency</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="Coal (T)" name="coal_consumption_t" value={unitForm.coal_consumption_t} onChange={handleUnitChange} />
            <InputField label="Sp. Coal (kg/kwh)" name="sp_coal_consumption_kg_kwh" value={unitForm.sp_coal_consumption_kg_kwh} onChange={handleUnitChange} readOnly />
            <InputField label="Avg GCV (kcal/kg)" name="avg_gcv_coal_kcal_kg" value={unitForm.avg_gcv_coal_kcal_kg} onChange={handleUnitChange} />
            <InputField label="Heat Rate" name="heat_rate" value={unitForm.heat_rate} onChange={handleUnitChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="LDO/HSD (KL)" name="ldo_hsd_consumption_kl" value={unitForm.ldo_hsd_consumption_kl} onChange={handleUnitChange} />
            <InputField label="Sp. Oil (ml/kwh)" name="sp_oil_consumption_ml_kwh" value={unitForm.sp_oil_consumption_ml_kwh} onChange={handleUnitChange} readOnly />
            <div />
            <div />
          </div>

          {/* Auxiliary / Water / Steam */}
          <h3 className="text-xs font-semibold text-orange-700">Auxiliary, Water, Steam & Emissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="Aux. Power (MU)" name="aux_power_consumption_mu" value={unitForm.aux_power_consumption_mu} onChange={handleUnitChange} />
            <InputField label="Aux. Power (%)" name="aux_power_percent" value={unitForm.aux_power_percent} onChange={handleUnitChange} readOnly />
            <InputField label="DM Water (Cu.m)" name="dm_water_consumption_cu_m" value={unitForm.dm_water_consumption_cu_m} onChange={handleUnitChange} />
            <InputField label="Sp. DM Water (%)" name="sp_dm_water_consumption_percent" value={unitForm.sp_dm_water_consumption_percent} onChange={handleUnitChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <InputField label="Steam Gen (T)" name="steam_gen_t" value={unitForm.steam_gen_t} onChange={handleUnitChange} />
            <InputField label="Sp. Steam (kg/kwh)" name="sp_steam_consumption_kg_kwh" value={unitForm.sp_steam_consumption_kg_kwh} onChange={handleUnitChange} readOnly />
            <InputField label="Stack Emission (mg/Nm3)" name="stack_emission_spm_mg_nm3" value={unitForm.stack_emission_spm_mg_nm3} onChange={handleUnitChange} />
            <div />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`w-full py-1.5 rounded text-white font-semibold ${
              isEditing ? "bg-yellow-500 hover:bg-yellow-600" : "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-gray-900"
            }`}
            disabled={unitSubmitting || unitFetching}
          >
            {unitSubmitting ? "Processing..." : isEditing ? "Update Unit Data" : "Submit Unit Report"}
          </button>
        </form>
      </div>

      {/* Station card (compact) */}
      <div className="p-3 bg-orange-50 rounded-lg shadow-md border border-orange-200">
        <h2 className="text-sm font-semibold text-orange-800 mb-2 text-center">Station-Level Report</h2>

        <form onSubmit={handleStationSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <InputField label="Avg. Raw Water (Cu.m/hr)" name="avg_raw_water_used_cu_m_hr" value={stationForm.avg_raw_water_used_cu_m_hr} onChange={handleStationChange} />
            <InputField label="Total Raw Water (Cu.m)" name="total_raw_water_used_cu_m" value={stationForm.total_raw_water_used_cu_m} onChange={handleStationChange} />
            <InputField label="Sp. Raw Water (Ltr/kWh)" name="sp_raw_water_used_ltr_kwh" value={stationForm.sp_raw_water_used_ltr_kwh} onChange={handleStationChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <InputField label="RO Plant Running (Hrs)" name="ro_plant_running_hrs" value={stationForm.ro_plant_running_hrs} onChange={handleStationChange} />
            <InputField label="RO Plant I/L" name="ro_plant_il" value={stationForm.ro_plant_il} onChange={handleStationChange} />
            <InputField label="RO Plant O/L" name="ro_plant_ol" value={stationForm.ro_plant_ol} onChange={handleStationChange} />
          </div>

          <button type="submit" className="w-full py-1.5 text-white rounded bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500" disabled={stationSubmitting || stationFetching}>
            {stationSubmitting ? "Processing..." : "Save Station Data"}
          </button>
        </form>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-3 text-center text-orange-800">Enter Edit Password</h3>
            <input
              type="password"
              placeholder="Edit Password (e.g., EDIT@123)"
              className="border p-2 w-full rounded mb-4 focus:border-orange-500 focus:ring-orange-500"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-400 px-3 py-1 rounded text-white"
                onClick={() => {
                  setShowPasswordModal(false);
                  setEditPassword("");
                }}
              >
                Cancel
              </button>
              <button
                className="bg-orange-600 px-3 py-1 rounded text-white"
                onClick={() => {
                  handlePasswordConfirm();
                }}
              >
                Confirm Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Popup (shows ONLY new values for manual fields that changed vs original; excludes auto-calculated fields) */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-3 text-center text-orange-800">Confirm changed values</h3>

            <div className="space-y-2 mb-4">
              {getChangedManualFieldsForDisplay().length === 0 ? (
                <div className="text-sm text-gray-600">No manual changes to confirm.</div>
              ) : (
                <ul className="list-disc ml-5 text-sm">
                  {getChangedManualFieldsForDisplay().map((f) => (
                    <li key={f.key} className="py-1">
                      <span className="font-medium">{f.label}:</span> <span className="font-mono">{f.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-400 px-3 py-1 rounded text-white"
                onClick={() => {
                  setShowConfirmPopup(false);
                }}
              >
                Cancel
              </button>
              <button
                className="bg-orange-600 px-3 py-1 rounded text-white"
                onClick={() => {
                  handleConfirmUnitSubmit();
                }}
                disabled={unitSubmitting}
              >
                {unitSubmitting ? "Processing..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}