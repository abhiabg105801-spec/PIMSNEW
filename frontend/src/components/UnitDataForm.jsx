import React, { useState, useEffect } from "react";
import axios from "axios";

// Reusable numeric input component
const InputField = ({ label, name, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      className="mt-1 w-full border rounded p-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
      step="any"
    />
  </div>
);

// --- FORM STATES ---
const initialUnitFormState = {
  unit: "",
  // Performance
  generation_mu: "",
  plf_percent: "",
  running_hour: "",
  plant_availability_percent: "",
  // Outages
  planned_outage_hour: "",
  planned_outage_percent: "",
  forced_outage_hour: "",
  forced_outage_percent: "",
  strategic_outage_hour: "",
  // Fuel (Coal)
  coal_consumption_t: "",
  sp_coal_consumption_kg_kwh: "",
  avg_gcv_coal_kcal_kg: "",
  heat_rate: "",
  // Fuel (Oil)
  ldo_hsd_consumption_kl: "",
  sp_oil_consumption_ml_kwh: "",
  // Power & Water
  aux_power_consumption_mu: "",
  aux_power_percent: "",
  dm_water_consumption_cu_m: "",
  sp_dm_water_consumption_percent: "",
  // Steam & Emissions
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


export default function DataEntryPage({ auth }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  
  // State for Unit Form
  const [unitForm, setUnitForm] = useState(initialUnitFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unitMessage, setUnitMessage] = useState("");
  const [unitLoading, setUnitLoading] = useState(false);

  // State for Station Form
  const [stationForm, setStationForm] = useState(initialStationFormState);
  const [stationMessage, setStationMessage] = useState("");
  const [stationLoading, setStationLoading] = useState(false);
  
  const API_URL = "http://localhost:8080/api";

  // --- UNIT FORM LOGIC ---

  // ✅ Auto-fetch if record exists for selected date + unit
  useEffect(() => {
    if (unitForm.unit && reportDate) {
      checkExistingUnitData();
    } else {
      // Clear form if no unit is selected
      setUnitForm(initialUnitFormState);
      setIsEditing(false);
      setUnitMessage("");
    }
  }, [unitForm.unit, reportDate]);
  
  // ✅ Auto-fetch station data when date changes
  useEffect(() => {
    if (reportDate) {
      checkExistingStationData();
    }
  }, [reportDate]);


  const checkExistingUnitData = async () => {
    setUnitLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/reports/single/${unitForm.unit}/${reportDate}`,
        { headers: { Authorization: auth } }
      );
      if (res.data) {
        const loadedData = {};
        for (const key of Object.keys(initialUnitFormState)) {
            // Repopulate unit dropdown
            if (key === 'unit') {
              loadedData[key] = res.data[key] || "";
            } else {
              loadedData[key] = res.data[key] || "";
            }
        }
        setUnitForm(loadedData);
        setIsEditing(true);
        setUnitMessage(`✅ Existing data loaded for ${unitForm.unit}`);
      }
    } catch (err) {
      setIsEditing(false);
      setUnitMessage("");
      // Reset form but keep the selected unit
      setUnitForm((prev) => ({
        ...initialUnitFormState,
        unit: prev.unit,
      }));
    } finally {
      setUnitLoading(false);
    }
  };

  const handleUnitChange = (e) => {
    const { name, value } = e.target;
    setUnitForm({ ...unitForm, [name]: value });
  };

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    if (isEditing) {
      setShowPasswordModal(true);
    } else {
      handleConfirmUnitSubmit();
    }
  };

  const handleConfirmUnitSubmit = async () => {
    setUnitLoading(true);
    setUnitMessage("");
    setShowPasswordModal(false);

    const payload = { ...unitForm, report_date: reportDate };
    
    for (const key in payload) {
      if (payload[key] === "") payload[key] = null;
    }
    if (isEditing) {
      payload.edit_password = editPassword;
    }

    try {
      await axios.post(`${API_URL}/reports/`, payload, {
        headers: { Authorization: auth },
      });
      setUnitMessage(isEditing ? "✅ Report updated successfully" : "✅ Report added successfully");
      setIsEditing(true);
      setEditPassword("");
    } catch (err) {
      setUnitMessage(`❌ ${err.response?.data?.detail || "Error saving data"}`);
      if (isEditing) {
         setShowPasswordModal(true);
      }
    } finally {
      setUnitLoading(false);
    }
  };

  // --- STATION FORM LOGIC ---

  const checkExistingStationData = async () => {
    setStationLoading(true);
    try {
      // ⚠️ NOTE: You must create this new endpoint in your backend
      const res = await axios.get(
        `${API_URL}/reports/station/${reportDate}`,
        { headers: { Authorization: auth } }
      );
      if (res.data) {
        const loadedData = {};
        for (const key of Object.keys(initialStationFormState)) {
            loadedData[key] = res.data[key] || "";
        }
        setStationForm(loadedData);
        setStationMessage("✅ Existing station data loaded.");
      }
    } catch (err) {
      setStationMessage("");
      setStationForm(initialStationFormState);
    } finally {
      setStationLoading(false);
    }
  };
  
  const handleStationChange = (e) => {
    const { name, value } = e.target;
    setStationForm({ ...stationForm, [name]: value });
  };

  const handleStationSubmit = async (e) => {
    e.preventDefault();
    setStationLoading(true);
    setStationMessage("");

    const payload = { ...stationForm, report_date: reportDate };
    for (const key in payload) {
      if (payload[key] === "") payload[key] = null;
    }

    try {
      // ⚠️ NOTE: You must create this new endpoint in your backend
      await axios.post(`${API_URL}/reports/station/`, payload, {
        headers: { Authorization: auth },
      });
      setStationMessage("✅ Station data saved successfully.");
    } catch (err) {
      setStationMessage(`❌ ${err.response?.data?.detail || "Error saving station data"}`);
    } finally {
      setStationLoading(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto mt-8 mb-8">
      {/* --- DATE SELECTOR --- */}
      <div className="p-4 bg-white rounded-xl shadow-lg mb-6 flex justify-center items-center">
        <label className="text-xl font-semibold mr-4">Report Date:</label>
        <input
          type="date"
          name="report_date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          className="border rounded p-2 text-lg"
          required
        />
      </div>

      {/* --- UNIT DATA FORM --- */}
      <div className="p-6 bg-white rounded-xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Per-Unit Daily Report
        </h2>

        {unitMessage && (
          <div className={`p-3 mb-4 text-center rounded-md ${unitMessage.startsWith("❌") ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {unitMessage}
          </div>
        )}

        <form onSubmit={handleUnitSubmit} className="space-y-6">
          
          <div className="p-4 border rounded-md bg-gray-50">
            <label className="block font-semibold text-gray-800">Unit</label>
            <select
              name="unit"
              value={unitForm.unit}
              onChange={handleUnitChange}
              className="w-full border rounded p-2"
              required
            >
              <option value="">Select Unit</option>
              <option value="Unit-1">Unit-1</option>
              <option value="Unit-2">Unit-2</option>
            </select>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Performance & Availability</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Generation (MU)" name="generation_mu" value={unitForm.generation_mu} onChange={handleUnitChange} />
            <InputField label="PLF (%)" name="plf_percent" value={unitForm.plf_percent} onChange={handleUnitChange} />
            <InputField label="Running Hour" name="running_hour" value={unitForm.running_hour} onChange={handleUnitChange} />
            <InputField label="Plant Availability (%)" name="plant_availability_percent" value={unitForm.plant_availability_percent} onChange={handleUnitChange} />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Outages</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField label="Planned Outage (Hour)" name="planned_outage_hour" value={unitForm.planned_outage_hour} onChange={handleUnitChange} />
            <InputField label="Planned Outage (%)" name="planned_outage_percent" value={unitForm.planned_outage_percent} onChange={handleUnitChange} />
            <InputField label="Forced Outage (Hour)" name="forced_outage_hour" value={unitForm.forced_outage_hour} onChange={handleUnitChange} />
            <InputField label="Forced Outage (%)" name="forced_outage_percent" value={unitForm.forced_outage_percent} onChange={handleUnitChange} />
            <InputField label="Strategic Outage (Hour)" name="strategic_outage_hour" value={unitForm.strategic_outage_hour} onChange={handleUnitChange} />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Fuel & Efficiency</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Coal Consumption (T)" name="coal_consumption_t" value={unitForm.coal_consumption_t} onChange={handleUnitChange} />
            <InputField label="Sp. Coal (kg/kwh)" name="sp_coal_consumption_kg_kwh" value={unitForm.sp_coal_consumption_kg_kwh} onChange={handleUnitChange} />
            <InputField label="Avg. GCV Coal (kcal/kg)" name="avg_gcv_coal_kcal_kg" value={unitForm.avg_gcv_coal_kcal_kg} onChange={handleUnitChange} />
            <InputField label="Heat Rate (kcal/kwh)" name="heat_rate" value={unitForm.heat_rate} onChange={handleUnitChange} />
            <InputField label="LDO/HSD (KL)" name="ldo_hsd_consumption_kl" value={unitForm.ldo_hsd_consumption_kl} onChange={handleUnitChange} />
            <InputField label="Sp. Oil (ml/kwh)" name="sp_oil_consumption_ml_kwh" value={unitForm.sp_oil_consumption_ml_kwh} onChange={handleUnitChange} />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Auxiliary, Water, Steam & Emissions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Aux. Power (MU)" name="aux_power_consumption_mu" value={unitForm.aux_power_consumption_mu} onChange={handleUnitChange} />
            <InputField label="Aux. Power (%)" name="aux_power_percent" value={unitForm.aux_power_percent} onChange={handleUnitChange} />
            <InputField label="DM Water (Cu. M)" name="dm_water_consumption_cu_m" value={unitForm.dm_water_consumption_cu_m} onChange={handleUnitChange} />
            <InputField label="Sp. DM Water (%)" name="sp_dm_water_consumption_percent" value={unitForm.sp_dm_water_consumption_percent} onChange={handleUnitChange} />
            <InputField label="Steam Gen (T)" name="steam_gen_t" value={unitForm.steam_gen_t} onChange={handleUnitChange} />
            <InputField label="Sp. Steam (kg/kwh)" name="sp_steam_consumption_kg_kwh" value={unitForm.sp_steam_consumption_kg_kwh} onChange={handleUnitChange} />
            <InputField label="Stack Emission (mg/Nm3)" name="stack_emission_spm_mg_nm3" value={unitForm.stack_emission_spm_mg_nm3} onChange={handleUnitChange} />
          </div>

          <button
            type="submit"
            className={`w-full py-3 rounded text-white font-semibold ${
              isEditing ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={unitLoading}
          >
            {unitLoading ? "Processing..." : isEditing ? "Update Unit Data" : "Submit Unit Report"}
          </button>
        </form>
      </div>

      {/* --- STATION DATA FORM --- */}
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Station-Level Daily Report
        </h2>
        
        {stationMessage && (
          <div className={`p-3 mb-4 text-center rounded-md ${stationMessage.startsWith("❌") ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {stationMessage}
          </div>
        )}

        <form onSubmit={handleStationSubmit} className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Raw Water</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Avg. Raw Water (Cu. M/Hr)" name="avg_raw_water_used_cu_m_hr" value={stationForm.avg_raw_water_used_cu_m_hr} onChange={handleStationChange} />
            <InputField label="Total Raw Water (Cu. M)" name="total_raw_water_used_cu_m" value={stationForm.total_raw_water_used_cu_m} onChange={handleStationChange} />
            <InputField label="Sp. Raw Water (Ltr/Kwh)" name="sp_raw_water_used_ltr_kwh" value={stationForm.sp_raw_water_used_ltr_kwh} onChange={handleStationChange} />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">RO Plant</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="RO Plant Running (Hrs)" name="ro_plant_running_hrs" value={stationForm.ro_plant_running_hrs} onChange={handleStationChange} />
            <InputField label="RO Plant I/L" name="ro_plant_il" value={stationForm.ro_plant_il} onChange={handleStationChange} />
            <InputField label="RO Plant O/L" name="ro_plant_ol" value={stationForm.ro_plant_ol} onChange={handleStationChange} />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded text-white font-semibold bg-green-600 hover:bg-green-700"
            disabled={stationLoading}
          >
            {stationLoading ? "Processing..." : "Save Station Data"}
          </button>
        </form>
      </div>


      {/* --- Password Modal (for Unit Form) --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-3 text-center">
              Enter Edit Password
            </h3>
            <input
              type="password"
              placeholder="Edit Password (e.g., EDIT@123)"
              className="border p-2 w-full rounded mb-4"
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
                className="bg-blue-600 px-3 py-1 rounded text-white"
                onClick={handleConfirmUnitSubmit}
              >
                Confirm Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}