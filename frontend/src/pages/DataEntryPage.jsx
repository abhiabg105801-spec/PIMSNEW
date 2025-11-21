import React, { useState, useEffect } from "react";
import axios from "axios";

// shadcn components (use .jsx paths matching your setup)
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog.jsx";
import { Separator } from "@/components/ui/separator.jsx";

/* -------------------------
   Compact styled input
   -------------------------*/
const SInput = ({ label, name, value, onChange, readOnly = false, placeholder = "" }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[11px] text-gray-600">{label}</Label>
    <Input
      name={name}
      value={value ?? ""}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      type="number"
      step="any"
      className={`h-9 text-sm ${readOnly ? "bg-gray-100/70" : ""}`}
    />
  </div>
);

/* -------------------------------------------
   initial states (kept from your original)
   ------------------------------------------- */
const initialUnitFormState = {
  unit: "",
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

/* -------------------------------------------
   Main Component
   ------------------------------------------- */
export default function DataEntryPage({ auth }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  const [unitForm, setUnitForm] = useState(initialUnitFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [unitMessage, setUnitMessage] = useState("");
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitFetching, setUnitFetching] = useState(false);

  const [stationForm, setStationForm] = useState(initialStationFormState);
  const [stationMessage, setStationMessage] = useState("");
  const [stationSubmitting, setStationSubmitting] = useState(false);
  const [stationFetching, setStationFetching] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  const API_URL = "http://localhost:8080/api";

  /* ---------------------
     Effects: fetch / recalc
     (logic preserved)
     --------------------- */
  useEffect(() => {
    if (unitForm.unit && reportDate) checkExistingUnitData();
    else {
      setUnitForm(prev => ({ ...initialUnitFormState, unit: prev.unit }));
      setIsEditing(false);
      setUnitMessage("");
    }
    // eslint-disable-next-line
  }, [unitForm.unit, reportDate]);

  useEffect(() => {
    if (reportDate) {
      checkExistingStationData();
      if (unitForm.unit) checkExistingUnitData();
    }
    // eslint-disable-next-line
  }, [reportDate]);

  useEffect(() => {
    const generation = parseFloat(unitForm.generation_mu);
    if (!isNaN(generation) && generation >= 0) {
      const plf = (generation / 3) * 100;
      const formatted = parseFloat(plf.toFixed(2));
      if (unitForm.plf_percent !== formatted) setUnitForm(prev => ({ ...prev, plf_percent: formatted }));
    } else {
      if (unitForm.plf_percent !== "") setUnitForm(prev => ({ ...prev, plf_percent: "" }));
    }
  }, [unitForm.generation_mu]);

  useEffect(() => {
    const hr = parseFloat(unitForm.running_hour);
    if (!isNaN(hr) && hr >= 0 && hr <= 24) {
      const val = parseFloat(((hr / 24) * 100).toFixed(2));
      if (unitForm.plant_availability_percent !== val) setUnitForm(prev => ({ ...prev, plant_availability_percent: val }));
    } else {
      if (unitForm.plant_availability_percent !== "") setUnitForm(prev => ({ ...prev, plant_availability_percent: "" }));
    }
  }, [unitForm.running_hour]);

  useEffect(() => {
    const hr = parseFloat(unitForm.planned_outage_hour);
    if (!isNaN(hr) && hr >= 0) {
      const val = parseFloat(((hr / 24) * 100).toFixed(2));
      if (unitForm.planned_outage_percent !== val) setUnitForm(prev => ({ ...prev, planned_outage_percent: val }));
    } else {
      if (unitForm.planned_outage_percent !== "") setUnitForm(prev => ({ ...prev, planned_outage_percent: "" }));
    }
  }, [unitForm.planned_outage_hour]);

  useEffect(() => {
    const hr = parseFloat(unitForm.forced_outage_hour);
    if (!isNaN(hr) && hr >= 0) {
      const val = parseFloat(((hr / 24) * 100).toFixed(2));
      if (unitForm.forced_outage_percent !== val) setUnitForm(prev => ({ ...prev, forced_outage_percent: val }));
    } else {
      if (unitForm.forced_outage_percent !== "") setUnitForm(prev => ({ ...prev, forced_outage_percent: "" }));
    }
  }, [unitForm.forced_outage_hour]);

  useEffect(() => {
    const coal = parseFloat(unitForm.coal_consumption_t);
    const gen = parseFloat(unitForm.generation_mu);
    if (!isNaN(coal) && coal >= 0 && !isNaN(gen) && gen > 0) {
      const val = parseFloat((coal / gen).toFixed(3));
      if (unitForm.sp_coal_consumption_kg_kwh !== val) setUnitForm(prev => ({ ...prev, sp_coal_consumption_kg_kwh: val }));
    } else {
      if (unitForm.sp_coal_consumption_kg_kwh !== "") setUnitForm(prev => ({ ...prev, sp_coal_consumption_kg_kwh: "" }));
    }
  }, [unitForm.coal_consumption_t, unitForm.generation_mu]);

  useEffect(() => {
    const oil = parseFloat(unitForm.ldo_hsd_consumption_kl);
    const gen = parseFloat(unitForm.generation_mu);
    if (!isNaN(oil) && oil >= 0 && !isNaN(gen) && gen > 0) {
      const val = parseFloat((oil / gen).toFixed(2));
      if (unitForm.sp_oil_consumption_ml_kwh !== val) setUnitForm(prev => ({ ...prev, sp_oil_consumption_ml_kwh: val }));
    } else {
      if (unitForm.sp_oil_consumption_ml_kwh !== "") setUnitForm(prev => ({ ...prev, sp_oil_consumption_ml_kwh: "" }));
    }
  }, [unitForm.ldo_hsd_consumption_kl, unitForm.generation_mu]);

  useEffect(() => {
    const aux = parseFloat(unitForm.aux_power_consumption_mu);
    const gen = parseFloat(unitForm.generation_mu);
    if (!isNaN(aux) && aux >= 0 && !isNaN(gen) && gen > 0) {
      const val = parseFloat(((aux / gen) * 100).toFixed(2));
      if (unitForm.aux_power_percent !== val) setUnitForm(prev => ({ ...prev, aux_power_percent: val }));
    } else {
      if (unitForm.aux_power_percent !== "") setUnitForm(prev => ({ ...prev, aux_power_percent: "" }));
    }
  }, [unitForm.aux_power_consumption_mu, unitForm.generation_mu]);

  useEffect(() => {
    const steam = parseFloat(unitForm.steam_gen_t);
    const gen = parseFloat(unitForm.generation_mu);
    if (!isNaN(steam) && steam >= 0 && !isNaN(gen) && gen > 0) {
      const val = parseFloat((steam / gen).toFixed(2));
      if (unitForm.sp_steam_consumption_kg_kwh !== val) setUnitForm(prev => ({ ...prev, sp_steam_consumption_kg_kwh: val }));
    } else {
      if (unitForm.sp_steam_consumption_kg_kwh !== "") setUnitForm(prev => ({ ...prev, sp_steam_consumption_kg_kwh: "" }));
    }
  }, [unitForm.steam_gen_t, unitForm.generation_mu]);

  /* ---------------------
     Data fetching functions
     --------------------- */
  const checkExistingUnitData = async () => {
    if (!unitForm.unit || !reportDate) return;
    setUnitFetching(true);
    setUnitMessage("");
    try {
      const res = await axios.get(`${API_URL}/reports/single/${unitForm.unit}/${reportDate}`, { headers: { Authorization: auth } });
      if (res.data) {
        const loaded = { unit: res.data.unit || unitForm.unit };
        Object.keys(initialUnitFormState).forEach(k => {
          if (k !== "unit") loaded[k] = res.data[k] ?? "";
        });
        setUnitForm(loaded);
        setIsEditing(true);
        setUnitMessage("✅ Existing data loaded");
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      setIsEditing(false);
      setUnitForm(prev => ({ ...initialUnitFormState, unit: prev.unit }));
      if (err.response?.status !== 404) setUnitMessage("⚠️ Could not load unit data.");
    } finally {
      setUnitFetching(false);
    }
  };

  const checkExistingStationData = async () => {
    if (!reportDate) return;
    setStationFetching(true);
    setStationMessage("");
    try {
      const res = await axios.get(`${API_URL}/reports/station/${reportDate}`, { headers: { Authorization: auth } });
      if (res.data) {
        const loaded = {};
        Object.keys(initialStationFormState).forEach(k => {
          loaded[k] = res.data[k] ?? "";
        });
        setStationForm(loaded);
      }
    } catch (err) {
      setStationForm(initialStationFormState);
      if (err.response?.status !== 404) setStationMessage("⚠️ Could not load station data.");
    } finally {
      setStationFetching(false);
    }
  };

  /* ---------------------
     Handlers
     --------------------- */
  const handleUnitChange = (e) => {
    const { name, value } = e.target;
    if (name === "unit") {
      setUnitForm({ ...initialUnitFormState, unit: value });
      setIsEditing(false);
      setUnitMessage("");
      return;
    }
    setUnitForm(prev => ({ ...prev, [name]: value }));
  };

  const handleStationChange = (e) => {
    const { name, value } = e.target;
    setStationForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUnitSubmit = (e) => {
    e.preventDefault();
    if (!unitForm.unit) { setUnitMessage("❌ Select a unit first"); return; }
    if (isEditing) setShowPasswordModal(true);
    else handleConfirmUnitSubmit();
  };

  const handleConfirmUnitSubmit = async () => {
    setUnitSubmitting(true);
    setUnitMessage("");
    setShowPasswordModal(false);
    try {
      const payload = { ...unitForm, report_date: reportDate };
      for (const k in payload) {
        if (payload[k] === "") payload[k] = null;
        else if (typeof payload[k] === "string" && !isNaN(parseFloat(payload[k])) && isFinite(payload[k])) payload[k] = parseFloat(payload[k]);
      }
      if (isEditing) payload.edit_password = editPassword;
      await axios.post(`${API_URL}/reports/`, payload, { headers: { Authorization: auth } });
      setUnitMessage(isEditing ? "✅ Report updated successfully" : "✅ Report added successfully");
      setIsEditing(true);
      setEditPassword("");
    } catch (err) {
      let errorDetail = err.response?.data?.detail || "Error saving data";
      if (Array.isArray(errorDetail)) {
        errorDetail = errorDetail.map(d => `${d.loc.slice(-1)[0]} - ${d.msg}`).join('; ');
      }
      setUnitMessage(`❌ ${errorDetail}`);
      if (isEditing) setShowPasswordModal(true);
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleStationSubmit = async (e) => {
    e.preventDefault();
    setStationSubmitting(true);
    setStationMessage("");
    try {
      const payload = { ...stationForm, report_date: reportDate };
      for (const k in payload) {
        if (payload[k] === "") payload[k] = null;
        else if (typeof payload[k] === "string" && !isNaN(parseFloat(payload[k])) && isFinite(payload[k])) payload[k] = parseFloat(payload[k]);
      }
      await axios.post(`${API_URL}/reports/station/`, payload, { headers: { Authorization: auth } });
      setStationMessage("✅ Station data saved successfully.");
    } catch (err) {
      let errorDetail = err.response?.data?.detail || "Error saving station data";
      if (Array.isArray(errorDetail)) {
        errorDetail = errorDetail.map(d => `${d.loc.slice(-1)[0]} - ${d.msg}`).join('; ');
      }
      setStationMessage(`❌ ${errorDetail}`);
    } finally {
      setStationSubmitting(false);
    }
  };

  /* ---------------------
     Render
     --------------------- */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ---------- Top header ---------- */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily PIMS Report</h1>
          <p className="text-sm text-slate-500">Enter daily unit & station metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600">Timezone: Asia/Kolkata</div>
          <div className="rounded-lg px-3 py-2 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200">
            <div className="text-sm text-orange-600 font-medium">{reportDate}</div>
          </div>
        </div>
      </div>

      {/* ---------- DATE CARD ---------- */}
      <Card className="overflow-hidden border border-orange-200 shadow-sm">
        <div className="bg-gradient-to-r from-orange-50 to-white px-5 py-3 border-b border-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-1 rounded bg-orange-500" />
              <h2 className="text-lg font-medium text-orange-600">Report Date</h2>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <p className="text-sm text-slate-600">Date selected applies to both Unit & Station forms below.</p>
        </CardContent>
      </Card>

      {/* ---------- UNIT CARD (stacked) ---------- */}
      <Card className="overflow-hidden border border-orange-200 shadow-md">
        <div className="bg-gradient-to-r from-orange-50 to-white px-5 py-3 border-b border-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-1 rounded bg-orange-500" />
              <div>
                <h2 className="text-lg font-semibold text-orange-600">Per-Unit Daily Report</h2>
                <div className="text-xs text-slate-500">Compact entry for the selected unit</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unitFetching ? <div className="text-sm text-slate-500">Loading…</div> : null}
              <div className={`text-xs px-2 py-1 rounded ${isEditing ? "bg-yellow-200 text-yellow-900" : "bg-orange-100 text-orange-800"}`}>
                {isEditing ? "Edit" : "New"}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">

          {unitMessage && (
            <div className={`text-sm p-2 rounded ${unitMessage.startsWith("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {unitMessage}
            </div>
          )}

          <form onSubmit={handleUnitSubmit} className="space-y-4">

            {/* selector row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unit</Label>
                <Select onValueChange={(val) => handleUnitChange({ target: { name: "unit", value: val } })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={unitForm.unit || "Select unit"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unit-1">Unit-1</SelectItem>
                    <SelectItem value="Unit-2">Unit-2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Report Date</Label>
                <Input value={reportDate} disabled className="h-9 bg-gray-50" />
              </div>
            </div>

            <Separator />

            {/* Performance */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SInput label="Generation (MU)" name="generation_mu" value={unitForm.generation_mu} onChange={handleUnitChange} />
              <SInput label="PLF (%)" name="plf_percent" value={unitForm.plf_percent} readOnly />
              <SInput label="Running Hour" name="running_hour" value={unitForm.running_hour} onChange={handleUnitChange} />
              <SInput label="Plant Avail (%)" name="plant_availability_percent" value={unitForm.plant_availability_percent} readOnly />
            </div>

            {/* Outages */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SInput label="Planned Outage (Hr)" name="planned_outage_hour" value={unitForm.planned_outage_hour} onChange={handleUnitChange} />
              <SInput label="Planned (%)" name="planned_outage_percent" value={unitForm.planned_outage_percent} readOnly />
              <SInput label="Forced Outage (Hr)" name="forced_outage_hour" value={unitForm.forced_outage_hour} onChange={handleUnitChange} />
              <SInput label="Forced (%)" name="forced_outage_percent" value={unitForm.forced_outage_percent} readOnly />
              <SInput label="Strategic Outage (Hr)" name="strategic_outage_hour" value={unitForm.strategic_outage_hour} onChange={handleUnitChange} />
            </div>

            <Separator />

            {/* Fuel & Efficiency */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SInput label="Coal (T)" name="coal_consumption_t" value={unitForm.coal_consumption_t} onChange={handleUnitChange} />
              <SInput label="Sp. Coal (kg/kWh)" name="sp_coal_consumption_kg_kwh" value={unitForm.sp_coal_consumption_kg_kwh} readOnly />
              <SInput label="Avg. GCV (kcal/kg)" name="avg_gcv_coal_kcal_kg" value={unitForm.avg_gcv_coal_kcal_kg} onChange={handleUnitChange} />
              <SInput label="Heat Rate" name="heat_rate" value={unitForm.heat_rate} onChange={handleUnitChange} />
              <SInput label="LDO/HSD (KL)" name="ldo_hsd_consumption_kl" value={unitForm.ldo_hsd_consumption_kl} onChange={handleUnitChange} />
              <SInput label="Sp. Oil (ml/kWh)" name="sp_oil_consumption_ml_kwh" value={unitForm.sp_oil_consumption_ml_kwh} readOnly />
            </div>

            <Separator />

            {/* Aux / Water / Steam / Emissions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SInput label="Aux Power (MU)" name="aux_power_consumption_mu" value={unitForm.aux_power_consumption_mu} onChange={handleUnitChange} />
              <SInput label="Aux Power (%)" name="aux_power_percent" value={unitForm.aux_power_percent} readOnly />
              <SInput label="DM Water (Cu. M)" name="dm_water_consumption_cu_m" value={unitForm.dm_water_consumption_cu_m} onChange={handleUnitChange} />
              <SInput label="Sp. DM (%)" name="sp_dm_water_consumption_percent" value={unitForm.sp_dm_water_consumption_percent} onChange={handleUnitChange} />
              <SInput label="Steam Gen (T)" name="steam_gen_t" value={unitForm.steam_gen_t} onChange={handleUnitChange} />
              <SInput label="Sp. Steam (kg/kWh)" name="sp_steam_consumption_kg_kwh" value={unitForm.sp_steam_consumption_kg_kwh} readOnly />
              <SInput label="Stack Emission (mg/Nm3)" name="stack_emission_spm_mg_nm3" value={unitForm.stack_emission_spm_mg_nm3} onChange={handleUnitChange} />
            </div>

            <div className="flex items-center gap-3">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={unitSubmitting || unitFetching} onClick={handleUnitSubmit}>
                {unitSubmitting ? "Processing..." : isEditing ? "Update Unit Data" : "Submit Unit Report"}
              </Button>
              <div className="text-sm text-slate-500">Tip: required fields are Unit & Date</div>
            </div>

          </form>
        </CardContent>
      </Card>

      {/* ---------- STATION CARD (stacked) ---------- */}
      <Card className="overflow-hidden border border-orange-200 shadow-md">
        <div className="bg-gradient-to-r from-orange-50 to-white px-5 py-3 border-b border-orange-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1 rounded bg-orange-500" />
            <div>
              <h2 className="text-lg font-semibold text-orange-600">Station-Level Report</h2>
              <div className="text-xs text-slate-500">Plant-wide metrics</div>
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {stationMessage && (
            <div className={`text-sm p-2 rounded ${stationMessage.startsWith("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {stationMessage}
            </div>
          )}

          <form onSubmit={handleStationSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SInput label="Avg Raw Water (Cu. M/Hr)" name="avg_raw_water_used_cu_m_hr" value={stationForm.avg_raw_water_used_cu_m_hr} onChange={handleStationChange} />
              <SInput label="Total Raw Water (Cu. M)" name="total_raw_water_used_cu_m" value={stationForm.total_raw_water_used_cu_m} onChange={handleStationChange} />
              <SInput label="Sp Raw Water (Ltr/kWh)" name="sp_raw_water_used_ltr_kwh" value={stationForm.sp_raw_water_used_ltr_kwh} onChange={handleStationChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SInput label="RO Plant Running (Hrs)" name="ro_plant_running_hrs" value={stationForm.ro_plant_running_hrs} onChange={handleStationChange} />
              <SInput label="RO Plant I/L" name="ro_plant_il" value={stationForm.ro_plant_il} onChange={handleStationChange} />
              <SInput label="RO Plant O/L" name="ro_plant_ol" value={stationForm.ro_plant_ol} onChange={handleStationChange} />
            </div>

            <div className="flex items-center gap-3">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={stationSubmitting || stationFetching} onClick={handleStationSubmit}>
                {stationSubmitting ? "Processing..." : "Save Station Data"}
              </Button>
              <div className="text-sm text-slate-500">Autosave: off</div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---------- PASSWORD DIALOG ---------- */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Edit Password</DialogTitle>
          </DialogHeader>

          <Input type="password" placeholder="Edit Password (EDIT@123)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="mb-3" />

          <DialogFooter>
            <Button variant="secondary" onClick={() => { setShowPasswordModal(false); setEditPassword(""); }}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleConfirmUnitSubmit}>Confirm Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
