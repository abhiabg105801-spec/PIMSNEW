import React, { useState, useEffect } from "react";
import axios from "axios";

// Reusable numeric input component (COMPACT VERSION)
const InputField = ({ label, name, value, onChange, readOnly = false, className = "" }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600">{label}</label>
    <input
      type="number"
      name={name}
      value={value} // Ensure value is controlled
      onChange={onChange}
      readOnly={readOnly}
      className={`mt-1 block w-full border rounded-md p-1.5 text-sm border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 transition duration-150 ease-in-out ${
        readOnly ? 'bg-gray-100 cursor-not-allowed' : '' // Style read-only fields
      }`}
      step="any"
    />
  </div>
);

// --- FORM STATES ---
const initialUnitFormState = { unit: "", generation_mu: "", plf_percent: "", running_hour: "", plant_availability_percent: "", planned_outage_hour: "", planned_outage_percent: "", forced_outage_hour: "", forced_outage_percent: "", strategic_outage_hour: "", coal_consumption_t: "", sp_coal_consumption_kg_kwh: "", avg_gcv_coal_kcal_kg: "", heat_rate: "", ldo_hsd_consumption_kl: "", sp_oil_consumption_ml_kwh: "", aux_power_consumption_mu: "", aux_power_percent: "", dm_water_consumption_cu_m: "", sp_dm_water_consumption_percent: "", steam_gen_t: "", sp_steam_consumption_kg_kwh: "", stack_emission_spm_mg_nm3: "" };
const initialStationFormState = { avg_raw_water_used_cu_m_hr: "", total_raw_water_used_cu_m: "", sp_raw_water_used_ltr_kwh: "", ro_plant_running_hrs: "", ro_plant_il: "", ro_plant_ol: "" };


export default function DataEntryPage({ auth }) {
  // Separate state for the date picker value
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  // State for Unit Form
  const [unitForm, setUnitForm] = useState(initialUnitFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unitMessage, setUnitMessage] = useState("");
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitFetching, setUnitFetching] = useState(false);

  // State for Station Form
  const [stationForm, setStationForm] = useState(initialStationFormState);
  const [stationMessage, setStationMessage] = useState("");
  const [stationSubmitting, setStationSubmitting] = useState(false);
  const [stationFetching, setStationFetching] = useState(false);
  const API_URL = "http://localhost:8080/api";

  // --- Effects for fetching data based on date/unit changes ---
    useEffect(() => {
    // Fetch unit data only if a unit is selected
    if (unitForm.unit && reportDate) {
      checkExistingUnitData();
    } else {
      // Clear form (except unit) if unit is deselected
      setUnitForm(prev => ({ ...initialUnitFormState, unit: prev.unit }));
      setIsEditing(false);
      setUnitMessage("");
    }
  }, [unitForm.unit, reportDate]); // Re-run if unit OR date changes

  useEffect(() => {
    // Fetch station data whenever date changes
    if (reportDate) {
      checkExistingStationData();
      // Also re-fetch unit data if a unit is selected when date changes
      if (unitForm.unit) {
          checkExistingUnitData();
      }
    }
  }, [reportDate]); // Re-run only if date changes


  // --- Effects for Auto-Calculation ---
  // (All calculation useEffects remain unchanged as their logic is correct)
  useEffect(() => {
    const generation = parseFloat(unitForm.generation_mu);
    if (!isNaN(generation) && generation >= 0) {
        const plf = (generation / 3) * 100;
        const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
        const formattedPlf = formatCalc(plf, 2);
        if (unitForm.plf_percent !== formattedPlf) {
            setUnitForm(prev => ({ ...prev, plf_percent: formattedPlf }));
        }
    } else {
        if (unitForm.plf_percent !== "") {
            setUnitForm(prev => ({ ...prev, plf_percent: "" }));
        }
    }
  }, [unitForm.generation_mu]); 

  useEffect(() => {
    const runningHour = parseFloat(unitForm.running_hour);
    if (!isNaN(runningHour) && runningHour >= 0 && runningHour <= 24) { 
        const availability = (runningHour / 24) * 100;
        const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
        const formattedAvailability = formatCalc(availability, 2);
        if (unitForm.plant_availability_percent !== formattedAvailability) {
            setUnitForm(prev => ({ ...prev, plant_availability_percent: formattedAvailability }));
        }
    } else {
        if (unitForm.plant_availability_percent !== "") {
            setUnitForm(prev => ({ ...prev, plant_availability_percent: "" }));
        }
    }
  }, [unitForm.running_hour]); 

  useEffect(() => {
    const plannedHour = parseFloat(unitForm.planned_outage_hour);
    if (!isNaN(plannedHour) && plannedHour >= 0) {
        const percentage = (plannedHour / 24) * 100;
        const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
        const formattedPercentage = formatCalc(percentage, 2);
        if (unitForm.planned_outage_percent !== formattedPercentage) {
            setUnitForm(prev => ({ ...prev, planned_outage_percent: formattedPercentage }));
        }
    } else {
        if (unitForm.planned_outage_percent !== "") {
            setUnitForm(prev => ({ ...prev, planned_outage_percent: "" }));
        }
    }
  }, [unitForm.planned_outage_hour]); 

  useEffect(() => {
    const forcedHour = parseFloat(unitForm.forced_outage_hour);
    if (!isNaN(forcedHour) && forcedHour >= 0) {
        const percentage = (forcedHour / 24) * 100;
        const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
        const formattedPercentage = formatCalc(percentage, 2);
        if (unitForm.forced_outage_percent !== formattedPercentage) {
            setUnitForm(prev => ({ ...prev, forced_outage_percent: formattedPercentage }));
        }
    } else {
        if (unitForm.forced_outage_percent !== "") {
            setUnitForm(prev => ({ ...prev, forced_outage_percent: "" }));
        }
    }
  }, [unitForm.forced_outage_hour]); 


  useEffect(() => {
    const coal = parseFloat(unitForm.coal_consumption_t);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
    let formattedSpCoal = "";

    if (!isNaN(coal) && coal >= 0 && !isNaN(generation) && generation > 0) {
        const spCoal = coal / generation; 
        formattedSpCoal = formatCalc(spCoal, 3); 
    }

    if (unitForm.sp_coal_consumption_kg_kwh !== formattedSpCoal) {
        setUnitForm(prev => ({ ...prev, sp_coal_consumption_kg_kwh: formattedSpCoal }));
    }
  }, [unitForm.coal_consumption_t, unitForm.generation_mu]);

  useEffect(() => {
    const oil = parseFloat(unitForm.ldo_hsd_consumption_kl);
    const generation = parseFloat(unitForm.generation_mu);
    const formatCalc = (num, decimals = 2) =>
        isNaN(num) ? "" : parseFloat(num.toFixed(decimals));
    let formattedSpOil = "";

    if (!isNaN(oil) && oil >= 0 && !isNaN(generation) && generation > 0) {
        const spOil = oil / generation; 
        formattedSpOil = formatCalc(spOil, 2); 
    }

    if (unitForm.sp_oil_consumption_ml_kwh !== formattedSpOil) {
        setUnitForm(prev => ({ ...prev, sp_oil_consumption_ml_kwh: formattedSpOil }));
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
        setUnitForm(prev => ({ ...prev, aux_power_percent: formattedAuxPerc }));
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
        const spSteam = steam / generation; // T/MU = kg/kWh
        formattedSpSteam = formatCalc(spSteam, 2);
    }
    if (unitForm.sp_steam_consumption_kg_kwh !== formattedSpSteam) {
        setUnitForm(prev => ({ ...prev, sp_steam_consumption_kg_kwh: formattedSpSteam }));
    }
  }, [unitForm.steam_gen_t, unitForm.generation_mu]);


  // --- Data Fetching Functions ---
  const checkExistingUnitData = async () => {
    if (!unitForm.unit || !reportDate) return; 
    setUnitFetching(true); setUnitMessage('');
    try {
      const res = await axios.get(`${API_URL}/reports/single/${unitForm.unit}/${reportDate}`, { headers: { Authorization: auth } });
      if (res.data) {
        const loadedData = { unit: res.data.unit || unitForm.unit };
        Object.keys(initialUnitFormState).forEach(key => {
            if (key !== 'unit') {
                loadedData[key] = res.data[key] ?? ""; 
            }
        });
        setUnitForm(loadedData);
        setIsEditing(true);
        setUnitMessage(`✅ Existing data loaded for ${unitForm.unit}`);
      } else {
        setIsEditing(false);
        setUnitForm(prev => ({ ...initialUnitFormState, unit: prev.unit }));
        setUnitMessage("No existing data found for this unit/date.");
      }
    } catch (err) {
      setIsEditing(false);
      setUnitForm((prev) => ({ ...initialUnitFormState, unit: prev.unit }));
      if (err.response?.status !== 404) { setUnitMessage("⚠️ Could not load unit data."); }
      else { setUnitMessage(''); } 
    } finally { setUnitFetching(false); }
  };

  const checkExistingStationData = async () => {
    if (!reportDate) return; 
    setStationFetching(true); setStationMessage('');
    try {
      const res = await axios.get(`${API_URL}/reports/station/${reportDate}`, { headers: { Authorization: auth } });
      if (res.data) {
        const loadedData = {};
        Object.keys(initialStationFormState).forEach(key => {
            loadedData[key] = res.data[key] ?? ""; 
        });
        setStationForm(loadedData);
      } else {
          setStationForm(initialStationFormState); 
      }
    } catch (err) {
      setStationForm(initialStationFormState); 
      if (err.response?.status !== 404) { setStationMessage("⚠️ Could not load station data."); }
      else { setStationMessage(''); } 
    } finally { setStationFetching(false); }
  };


  // --- Form Input Handlers ---
  const handleUnitChange = (e) => {
    const { name, value } = e.target;
    if (name === "unit") {
      setUnitForm({ ...initialUnitFormState, unit: value });
      setIsEditing(false); 
      setUnitMessage(""); 
    } else {
      setUnitForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleStationChange = (e) => {
    const { name, value } = e.target;
    setStationForm(prevState => ({ ...prevState, [name]: value }));
  };


  // --- Form Submit Handlers ---
  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    if (!unitForm.unit) { setUnitMessage("❌ Please select a unit first."); return; }
    if (isEditing) { setShowPasswordModal(true); } else { handleConfirmUnitSubmit(); }
  };

  const handleConfirmUnitSubmit = async () => {
    setUnitSubmitting(true); setUnitMessage(""); setShowPasswordModal(false);

    const dataToSend = {
        ...unitForm, 
        report_date: reportDate 
    };

    for (const key in dataToSend) {
        if (key === 'report_date' || key === 'unit' || key === 'edit_password') {
            continue; 
        }
        if (dataToSend[key] === "") {
            dataToSend[key] = null; 
        } else if (typeof dataToSend[key] === 'string' && !isNaN(parseFloat(dataToSend[key])) && isFinite(dataToSend[key])) {
            dataToSend[key] = parseFloat(dataToSend[key]);
        }
    }

    if (isEditing) { dataToSend.edit_password = editPassword; }

    try {
      await axios.post(`${API_URL}/reports/`, dataToSend, { headers: { Authorization: auth } });
      setUnitMessage(isEditing ? "✅ Report updated successfully" : "✅ Report added successfully");
      setIsEditing(true); 
      setEditPassword(""); 
    } catch (err) {
      let errorDetail = err.response?.data?.detail || "Error saving data";
      if (Array.isArray(errorDetail)) {
          errorDetail = errorDetail.map(d => `${d.loc.slice(-1)[0]} - ${d.msg}`).join('; ');
      }
      setUnitMessage(`❌ ${errorDetail}`);
      if (isEditing) { setShowPasswordModal(true); } 
    } finally { setUnitSubmitting(false); }
  };

  const handleStationSubmit = async (e) => {
    e.preventDefault();
    setStationSubmitting(true); setStationMessage("");

    const dataToSend = { ...stationForm, report_date: reportDate };

    for (const key in dataToSend) {
        if (key === 'report_date') continue; 
        if (dataToSend[key] === "") { dataToSend[key] = null; }
        else if (typeof dataToSend[key] === 'string' && !isNaN(parseFloat(dataToSend[key])) && isFinite(dataToSend[key])) {
            dataToSend[key] = parseFloat(dataToSend[key]);
        }
    }

    try {
      await axios.post(`${API_URL}/reports/station/`, dataToSend, { headers: { Authorization: auth } });
      setStationMessage("✅ Station data saved successfully.");
    } catch (err) {
        let errorDetail = err.response?.data?.detail || "Error saving station data";
        if (Array.isArray(errorDetail)) {
            errorDetail = errorDetail.map(d => `${d.loc.slice(-1)[0]} - ${d.msg}`).join('; ');
        }
        setStationMessage(`❌ ${errorDetail}`);
    } finally { setStationSubmitting(false); }
  };


  return (
    // ✅ Changed to compact layout and orange theme
    <div className="max-w-5xl mx-auto my-4">

      {/* --- UNIT DATA FORM --- */}
      {/* ✅ Changed bg, border, padding, and margin */}
      <div className="p-4 bg-orange-50 rounded-lg shadow-md mb-6 border border-orange-200">
        <h2 className="text-lg font-bold mb-3 text-center text-orange-800">
          Per-Unit Daily Report
          {unitFetching && <span className="text-sm font-normal text-gray-500 ml-2">(Loading...)</span>}
        </h2>
        {/* ✅ Changed success message colors */}
        {unitMessage && ( <div className={`p-2 mb-3 text-sm text-center rounded-md ${ unitMessage.startsWith("❌") || unitMessage.startsWith("⚠️") ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700' }`} > {unitMessage} </div> )}
        
        {/* ✅ Reduced form spacing */}
        <form onSubmit={handleUnitSubmit} className="space-y-3">
          {/* ✅ Compacted selectors */}
          <div className="grid grid-cols-2 gap-3 p-2 border rounded-md bg-white">
              <div>
                  <label className="block text-sm font-semibold text-gray-800">Date</label>
                  <input type="date" name="report_date_selector" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full border rounded p-1.5 text-sm" required />
              </div>
              <div>
                  <label className="block text-sm font-semibold text-gray-800">Unit</label>
                  <select name="unit" value={unitForm.unit} onChange={handleUnitChange} className="w-full border rounded p-1.5 text-sm" required>
                      <option value="">Select Unit</option> <option value="Unit-1">Unit-1</option> <option value="Unit-2">Unit-2</option>
                  </select>
              </div>
          </div>
          
          {/* ✅ Compacted field groups */}
          <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">Performance & Availability</h3> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2"> 
            <InputField label="Generation (MU)" name="generation_mu" value={unitForm.generation_mu} onChange={handleUnitChange} /> 
            <InputField label="PLF (%)" name="plf_percent" value={unitForm.plf_percent} onChange={handleUnitChange} readOnly /> 
            <InputField label="Running Hour" name="running_hour" value={unitForm.running_hour} onChange={handleUnitChange} /> 
            <InputField label="Plant Availability (%)" name="plant_availability_percent" value={unitForm.plant_availability_percent} onChange={handleUnitChange} readOnly /> 
          </div>
          
          <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">Outages</h3> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2"> 
            <InputField label="Planned Outage (Hour)" name="planned_outage_hour" value={unitForm.planned_outage_hour} onChange={handleUnitChange} /> 
            <InputField label="Planned Outage (%)" name="planned_outage_percent" value={unitForm.planned_outage_percent} onChange={handleUnitChange} readOnly /> 
            <InputField label="Forced Outage (Hour)" name="forced_outage_hour" value={unitForm.forced_outage_hour} onChange={handleUnitChange} /> 
            <InputField label="Forced Outage (%)" name="forced_outage_percent" value={unitForm.forced_outage_percent} onChange={handleUnitChange} readOnly /> 
            <InputField label="Strategic Outage (Hour)" name="strategic_outage_hour" value={unitForm.strategic_outage_hour} onChange={handleUnitChange} /> 
          </div>
          
          <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">Fuel & Efficiency</h3> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2"> 
            <InputField label="Coal Consumption (T)" name="coal_consumption_t" value={unitForm.coal_consumption_t} onChange={handleUnitChange} /> 
            <InputField label="Sp. Coal (kg/kwh)" name="sp_coal_consumption_kg_kwh" value={unitForm.sp_coal_consumption_kg_kwh} onChange={handleUnitChange} readOnly /> 
            <InputField label="Avg. GCV Coal (kcal/kg)" name="avg_gcv_coal_kcal_kg" value={unitForm.avg_gcv_coal_kcal_kg} onChange={handleUnitChange} /> 
            <InputField label="Heat Rate (kcal/kwh)" name="heat_rate" value={unitForm.heat_rate} onChange={handleUnitChange} /> 
            <InputField label="LDO/HSD (KL)" name="ldo_hsd_consumption_kl" value={unitForm.ldo_hsd_consumption_kl} onChange={handleUnitChange} /> 
            <InputField label="Sp. Oil (ml/kwh)" name="sp_oil_consumption_ml_kwh" value={unitForm.sp_oil_consumption_ml_kwh} onChange={handleUnitChange} readOnly />
          </div>
          
          <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">Auxiliary, Water, Steam & Emissions</h3> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2"> 
            <InputField label="Aux. Power (MU)" name="aux_power_consumption_mu" value={unitForm.aux_power_consumption_mu} onChange={handleUnitChange} /> 
            <InputField label="Aux. Power (%)" name="aux_power_percent" value={unitForm.aux_power_percent} onChange={handleUnitChange} readOnly /> 
            <InputField label="DM Water (Cu. M)" name="dm_water_consumption_cu_m" value={unitForm.dm_water_consumption_cu_m} onChange={handleUnitChange} /> 
            <InputField label="Sp. DM Water (%)" name="sp_dm_water_consumption_percent" value={unitForm.sp_dm_water_consumption_percent} onChange={handleUnitChange} /> 
            <InputField label="Steam Gen (T)" name="steam_gen_t" value={unitForm.steam_gen_t} onChange={handleUnitChange} /> 
            <InputField label="Sp. Steam (kg/kwh)" name="sp_steam_consumption_kg_kwh" value={unitForm.sp_steam_consumption_kg_kwh} onChange={handleUnitChange} readOnly /> 
            <InputField label="Stack Emission (mg/Nm3)" name="stack_emission_spm_mg_nm3" value={unitForm.stack_emission_spm_mg_nm3} onChange={handleUnitChange} /> 
          </div>
          
          {/* ✅ Changed button colors and padding */}
          <button type="submit" className={`w-full py-1.5 rounded text-white font-semibold ${ isEditing ? "bg-yellow-500 hover:bg-yellow-600" : "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-gray-900" }`} disabled={unitSubmitting || unitFetching} > 
            {unitSubmitting ? "Processing..." : isEditing ? "Update Unit Data" : "Submit Unit Report"} 
          </button>
        </form>
      </div>

      {/* --- STATION DATA FORM --- */}
      {/* ✅ Changed bg, border, padding */}
      <div className="p-4 bg-orange-50 rounded-lg shadow-md border border-orange-200">
        {/* ✅ Changed title color */}
        <h2 className="text-lg font-bold mb-3 text-center text-orange-800"> 
          Station-Level Report {stationFetching && <span className="text-sm font-normal text-gray-500 ml-2">(Loading...)</span>} 
        </h2>
        {/* ✅ Changed success message colors */}
        {stationMessage && ( <div className={`p-2 mb-3 text-sm text-center rounded-md ${ stationMessage.startsWith("❌") || stationMessage.startsWith("⚠️") ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700' }`} > {stationMessage} </div> )}
        
        {/* ✅ Reduced form spacing */}
        <form onSubmit={handleStationSubmit} className="space-y-3">
            {/* ✅ Compacted field groups */}
            <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">Raw Water</h3> 
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2"> 
              <InputField label="Avg. Raw Water (Cu. M/Hr)" name="avg_raw_water_used_cu_m_hr" value={stationForm.avg_raw_water_used_cu_m_hr} onChange={handleStationChange} /> 
              <InputField label="Total Raw Water (Cu. M)" name="total_raw_water_used_cu_m" value={stationForm.total_raw_water_used_cu_m} onChange={handleStationChange} /> 
              <InputField label="Sp. Raw Water (Ltr/Kwh)" name="sp_raw_water_used_ltr_kwh" value={stationForm.sp_raw_water_used_ltr_kwh} onChange={handleStationChange} /> 
            </div>
            
            <h3 className="text-sm font-semibold text-orange-700 border-b border-orange-200 pb-1">RO Plant</h3> 
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2"> 
              <InputField label="RO Plant Running (Hrs)" name="ro_plant_running_hrs" value={stationForm.ro_plant_running_hrs} onChange={handleStationChange} /> 
              <InputField label="RO Plant I/L" name="ro_plant_il" value={stationForm.ro_plant_il} onChange={handleStationChange} /> 
              <InputField label="RO Plant O/L" name="ro_plant_ol" value={stationForm.ro_plant_ol} onChange={handleStationChange} /> 
            </div>
            
            {/* ✅ Changed button colors and padding */}
            <button type="submit" className="w-full py-1.5 text-white rounded bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 " disabled={stationSubmitting || stationFetching} > 
              {stationSubmitting ? "Processing..." : "Save Station Data"} 
            </button>
        </form>
      </div>

      {/* --- Password Modal --- */}
      {/* ✅ Changed modal button and title colors */}
      {showPasswordModal && ( 
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"> 
          <div className="bg-white p-6 rounded-xl shadow-lg w-96"> 
            <h3 className="text-lg font-semibold mb-3 text-center text-orange-800"> Enter Edit Password </h3> 
            <input type="password" placeholder="Edit Password (e.g., EDIT@123)" className="border p-2 w-full rounded mb-4 focus:border-orange-500 focus:ring-orange-500" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} /> 
            <div className="flex justify-end gap-3"> 
              <button className="bg-gray-400 px-3 py-1 rounded text-white" onClick={() => { setShowPasswordModal(false); setEditPassword(""); }} > Cancel </button> 
              <button className="bg-orange-600 px-3 py-1 rounded text-white" onClick={handleConfirmUnitSubmit} > Confirm Edit </button> 
            </div> 
          </div> 
        </div> 
      )}
    </div>
  );
}