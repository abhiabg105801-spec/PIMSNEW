import React, { useState, useEffect } from "react";
import axios from "axios";

// Helper to format numbers in table
const formatNum = (num, places = 2, defaultVal = "-") => {
  if (num === null || num === undefined || isNaN(num)) return defaultVal;
  const factor = Math.pow(10, places);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toFixed(places);
};


export default function ReportViewer({ auth }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  // Unit Data
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [yearly, setYearly] = useState([]);
  
  // Station Data
  const [stationDaily, setStationDaily] = useState(null);
  // ✅ NEW: Add state for Station aggregates
  const [stationMonthly, setStationMonthly] = useState(null);
  const [stationYearly, setStationYearly] = useState(null); 

  const [error, setError] = useState("");
  // ✅ NEW: Separate error state for station data
  const [stationError, setStationError] = useState(""); 
  
  const API_URL = "http://localhost:8080/api";
  const headers = { Authorization: auth };

  useEffect(() => {
    fetchUnitDaily();
    fetchUnitMonthly();
    fetchUnitYearly();
    fetchStationDaily();
    // ✅ NEW: Call fetch functions for station aggregates
    fetchStationMonthly();
    fetchStationYearly();
  }, [date]);

  // --- Fetching Functions ---
  const fetchUnitDaily = async () => {
    try {
      const res = await axios.get(`${API_URL}/reports/${date}`, { headers });
      setDaily(res.data);
      setError("");
    } catch {
      setDaily([]);
      setError("No daily unit data found for this date.");
    }
  };

  const fetchUnitMonthly = async () => {
    const [y, m] = date.split("-");
    try {
      const res = await axios.get(
        `${API_URL}/aggregate/month/${y}/${parseInt(m)}/${date}`,
        { headers }
      );
      setMonthly(res.data);
    } catch {
      setMonthly([]);
    }
  };

  const fetchUnitYearly = async () => {
    const [y] = date.split("-");
    try {
      const res = await axios.get(`${API_URL}/aggregate/year/${y}/${date}`, {
        headers,
      });
      setYearly(res.data);
    } catch {
      setYearly([]);
    }
  };

  const fetchStationDaily = async () => {
    try {
      const res = await axios.get(`${API_URL}/reports/station/${date}`, { headers });
      setStationDaily(res.data);
      setStationError(""); // Clear station error
    } catch {
      setStationDaily(null);
      // Use separate error state, don't overwrite unit error
      if (!error && !stationError) setStationError("No daily station data found."); 
    }
  };

  // ✅ NEW: Fetch Station Monthly Aggregate
  const fetchStationMonthly = async () => {
    const [y, m] = date.split("-");
    try {
      const res = await axios.get(
        `${API_URL}/aggregate/station/month/${y}/${parseInt(m)}/${date}`,
        { headers }
      );
      setStationMonthly(res.data);
    } catch {
      setStationMonthly(null);
    }
  };

  // ✅ NEW: Fetch Station Yearly Aggregate
  const fetchStationYearly = async () => {
    const [y] = date.split("-");
    try {
      const res = await axios.get(
        `${API_URL}/aggregate/station/year/${y}/${date}`,
        { headers }
      );
      setStationYearly(res.data);
    } catch {
      setStationYearly(null);
    }
  };

  // --- Data Access Helpers ---
  const getUnitData = (dataArray, unitName) => {
    // Check for _id (from aggregates) or unit (from daily reports)
    return dataArray.find(item => item.unit === unitName || item._id === unitName);
  };
  
  const getField = (dataObject, fieldName, precision = 2) => {
    // Check dataObject
    if (!dataObject || dataObject[fieldName] === null || dataObject[fieldName] === undefined) {
      return "-";
    }
    // Specific precision formatting
    if (fieldName === 'generation_mu' || fieldName === 'sp_coal_consumption_kg_kwh' || fieldName === 'aux_power_consumption_mu') {
       precision = 3;
    }
    if (fieldName === 'heat_rate' || fieldName === 'avg_gcv_coal_kcal_kg' || fieldName === 'dm_water_consumption_cu_m' || fieldName === 'steam_gen_t') {
        precision = 0;
    }
     if (fieldName === 'running_hour' || fieldName === 'planned_outage_hour' || fieldName === 'forced_outage_hour' || fieldName === 'strategic_outage_hour' || fieldName === 'ro_plant_running_hrs') {
        precision = 1;
    }
    return formatNum(dataObject[fieldName], precision);
  };

  // --- Get specific unit data objects ---
  const unit1Daily = getUnitData(daily, "Unit-1");
  const unit2Daily = getUnitData(daily, "Unit-2");
  const unit1Monthly = getUnitData(monthly, "Unit-1");
  const unit2Monthly = getUnitData(monthly, "Unit-2");
  const unit1Yearly = getUnitData(yearly, "Unit-1");
  const unit2Yearly = getUnitData(yearly, "Unit-2");

  // --- Calculate Station Aggregates (Client-side) ---
  const calculateStationAggregate = (field, type = 'sum', precision = 2) => {
      const u1 = unit1Daily ? unit1Daily[field] : 0;
      const u2 = unit2Daily ? unit2Daily[field] : 0;
      const u1m = unit1Monthly ? unit1Monthly[field] : 0;
      const u2m = unit2Monthly ? unit2Monthly[field] : 0;
      const u1y = unit1Yearly ? unit1Yearly[field] : 0;
      const u2y = unit2Yearly ? unit2Yearly[field] : 0;

      let dailyVal = 0, monthlyVal = 0, yearlyVal = 0;

      if (type === 'sum') {
          dailyVal = (u1 || 0) + (u2 || 0);
          monthlyVal = (u1m || 0) + (u2m || 0);
          yearlyVal = (u1y || 0) + (u2y || 0);
      } else if (type === 'avg') {
          dailyVal = ((u1 || 0) + (u2 || 0)) / ((u1 ? 1 : 0) + (u2 ? 1 : 0) || 1);
          monthlyVal = ((u1m || 0) + (u2m || 0)) / ((u1m ? 1 : 0) + (u2m ? 1 : 0) || 1);
          yearlyVal = ((u1y || 0) + (u2y || 0)) / ((u1y ? 1 : 0) + (u2y ? 1 : 0) || 1);
      }
       
      if (field === 'generation_mu' || field === 'sp_coal_consumption_kg_kwh' || field === 'aux_power_consumption_mu') precision = 3;
      if (field === 'heat_rate' || field === 'avg_gcv_coal_kcal_kg' || field === 'dm_water_consumption_cu_m' || field === 'steam_gen_t') precision = 0;
      if (field === 'running_hour' || field === 'planned_outage_hour' || field === 'forced_outage_hour' || field === 'strategic_outage_hour') precision = 1;

      return {
          day: formatNum(dailyVal, precision, dailyVal === 0 ? "0.00" : "-"),
          month: formatNum(monthlyVal, precision, monthlyVal === 0 ? "0.00" : "-"),
          year: formatNum(yearlyVal, precision, yearlyVal === 0 ? "0.00" : "-")
      };
  };

  // --- Station Aggregate Calculations ---
  const stationGen = calculateStationAggregate('generation_mu', 'sum');
  const stationPLF = calculateStationAggregate('plf_percent', 'avg');
  const stationRunHr = calculateStationAggregate('running_hour', 'sum');
  const stationAvail = calculateStationAggregate('plant_availability_percent', 'avg');
  const stationPlanOutHr = calculateStationAggregate('planned_outage_hour', 'sum');
  const stationPlanOutPerc = calculateStationAggregate('planned_outage_percent', 'avg');
  const stationForcedOutHr = calculateStationAggregate('forced_outage_hour', 'sum');
  const stationForcedOutPerc = calculateStationAggregate('forced_outage_percent', 'avg');
  const stationStratOutHr = calculateStationAggregate('strategic_outage_hour', 'sum');
  const stationCoal = calculateStationAggregate('coal_consumption_t', 'sum');
  const stationSpCoal = calculateStationAggregate('sp_coal_consumption_kg_kwh', 'avg');
  const stationGCV = calculateStationAggregate('avg_gcv_coal_kcal_kg', 'avg');
  const stationHR = calculateStationAggregate('heat_rate', 'avg');
  const stationOil = calculateStationAggregate('ldo_hsd_consumption_kl', 'sum');
  const stationSpOil = calculateStationAggregate('sp_oil_consumption_ml_kwh', 'avg');
  const stationAuxMU = calculateStationAggregate('aux_power_consumption_mu', 'sum');
  const stationAuxPerc = calculateStationAggregate('aux_power_percent', 'avg');
  const stationDM = calculateStationAggregate('dm_water_consumption_cu_m', 'sum');
  const stationSpDM = calculateStationAggregate('sp_dm_water_consumption_percent', 'avg');
  const stationSteam = calculateStationAggregate('steam_gen_t', 'sum');
  const stationSpSteam = calculateStationAggregate('sp_steam_consumption_kg_kwh', 'avg');
  const stationStack = calculateStationAggregate('stack_emission_spm_mg_nm3', 'avg');

  // --- Export ---
  const handleExport = async (type) => {
    try {
      const url =
        type === "excel"
          ? `${API_URL}/export/excel/${date}`
          : `${API_URL}/export/pdf/${date}`;

      const response = await axios.get(url, {
        headers,
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download =
        type === "excel"
          ? `Daily_Report_${date}.xlsx`
          : `Daily_Report_${date}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
       console.error("Export failed:", err);
       alert(`Export failed. ${err.response?.data?.detail || "Please try again."}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-gray-50 shadow-md rounded-lg mt-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h1 className="text-xl font-bold text-center md:text-left">
           2*125 MW CPP DAILY PERFORMANCE REPORT DATED: {date}
        </h1>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border px-2 py-1.5 rounded-md text-sm" />
          <button onClick={() => handleExport("excel")} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm"> ⬇ Excel </button>
          <button onClick={() => handleExport("pdf")} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm"> ⬇ PDF </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      {/* --- Main Combined Table --- */}
      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="w-full text-xs text-center border-collapse">
          {/* ✅ STYLED THEAD: Orange background, white text */}
          <thead className="bg-orange-500 text-white uppercase">
             <tr>
               <th rowSpan="2" className="p-2 border border-orange-300 min-w-[200px] text-left">Parameter</th>
               <th colSpan="3" className="p-2 border border-orange-300">Unit-1</th>
               <th colSpan="3" className="p-2 border border-orange-300">Unit-2</th>
               <th colSpan="3" className="p-2 border border-orange-300">Station</th>
             </tr>
             <tr className="bg-orange-400 text-white text-bold">
               <th className="p-2 border border-orange-300">Day</th><th className="p-2 border border-orange-300">Month</th><th className="p-2 border border-orange-300">Year</th>
               <th className="p-2 border border-gray-300">Day</th><th className="p-2 border border-orange-300">Month</th><th className="p-2 border border-orange-300">Year</th>
               <th className="p-2 border border-gray-300">Day</th><th className="p-2 border border-orange-300">Month</th><th className="p-2 border border-orange-300">Year</th>
             </tr>
           </thead>
          <tbody>
            {/* ✅ STYLED TBODY: Added hover:font-bold */}
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
              <td className="p-2 border border-gray-300 text-left font-medium">Generation in MU</td>
              <td className="p-2 border border-gray-300">{getField(unit1Daily, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Daily, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'generation_mu', 3)}</td>
              <td className="p-2 border border-gray-300">{stationGen.day}</td>
              <td className="p-2 border border-gray-300">{stationGen.month}</td>
              <td className="p-2 border border-gray-300">{stationGen.year}</td>
            </tr>
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
              <td className="p-2 border border-gray-300 text-left font-medium">PLF %</td>
              <td className="p-2 border border-gray-300">{getField(unit1Daily, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Daily, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'plf_percent')}</td>
              <td className="p-2 border border-gray-300">{stationPLF.day}</td>
              <td className="p-2 border border-gray-300">{stationPLF.month}</td>
              <td className="p-2 border border-gray-300">{stationPLF.year}</td>
            </tr>
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Running Hour</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'running_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{stationRunHr.day}</td>
                <td className="p-2 border border-gray-300">{stationRunHr.month}</td>
                <td className="p-2 border border-gray-300">{stationRunHr.year}</td>
            </tr>
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Plant availability Factor%</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'plant_availability_percent')}</td>
                <td className="p-2 border border-gray-300">{stationAvail.day}</td>
                <td className="p-2 border border-gray-300">{stationAvail.month}</td>
                <td className="p-2 border border-gray-300">{stationAvail.year}</td>
            </tr>
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Planned Outage in Hour</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'planned_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutHr.day}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutHr.month}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutHr.year}</td>
            </tr>
           <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Planned Outage %</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'planned_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutPerc.day}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutPerc.month}</td>
                <td className="p-2 border border-gray-300">{stationPlanOutPerc.year}</td>
            </tr>
             <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Forced Outage in Hour</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'forced_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{stationForcedOutHr.day}</td>
                <td className="p-2 border border-gray-300">{stationForcedOutHr.month}</td>
                <td className="p-2 border border-gray-300">{stationForcedOutHr.year}</td>
            </tr>
             <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Forced Outage %</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'forced_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'forced_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'forced_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'forced_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'forced_outage_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'forced_outage_percent')}</td>
                 <td className="p-2 border border-gray-300">{stationForcedOutPerc.day}</td>
                <td className="p-2 border border-gray-300">{stationForcedOutPerc.month}</td>
                <td className="p-2 border border-gray-300">{stationForcedOutPerc.year}</td>
            </tr>
            <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Strategic Outage in Hour</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'strategic_outage_hour', 1)}</td>
                <td className="p-2 border border-gray-300">{stationStratOutHr.day}</td>
                <td className="p-2 border border-gray-300">{stationStratOutHr.month}</td>
                <td className="p-2 border border-gray-300">{stationStratOutHr.year}</td>
            </tr>
             <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Coal Consumption in T</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'coal_consumption_t')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'coal_consumption_t')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'coal_consumption_t')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'coal_consumption_t')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'coal_consumption_t')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'coal_consumption_t')}</td>
                 <td className="p-2 border border-gray-300">{stationCoal.day}</td>
                <td className="p-2 border border-gray-300">{stationCoal.month}</td>
                <td className="p-2 border border-gray-300">{stationCoal.year}</td>
            </tr>
             <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Sp. Coal Consumption in kg/kwh</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'sp_coal_consumption_kg_kwh', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'sp_coal_consumption_kg_kwh', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'sp_coal_consumption_kg_kwh', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'sp_coal_consumption_kg_kwh', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'sp_coal_consumption_kg_kwh', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'sp_coal_consumption_kg_kwh', 3)}</td>
                 <td className="p-2 border border-gray-300">{stationSpCoal.day}</td>
                <td className="p-2 border border-gray-300">{stationSpCoal.month}</td>
                <td className="p-2 border border-gray-300">{stationSpCoal.year}</td>
            </tr>
             <tr className="hover:bg-gray-100 hover:text-orange-600 hover:text-md hover:font-bold" >
                <td className="p-2 border border-gray-300 text-left font-medium">Average GCV of Coal in kcal/kg</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'avg_gcv_coal_kcal_kg', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'avg_gcv_coal_kcal_kg', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'avg_gcv_coal_kcal_kg', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'avg_gcv_coal_kcal_kg', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'avg_gcv_coal_kcal_kg', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'avg_gcv_coal_kcal_kg', 0)}</td>
                 <td className="p-2 border border-gray-300">{stationGCV.day}</td>
                <td className="p-2 border border-gray-300">{stationGCV.month}</td>
                <td className="p-2 border border-gray-300">{stationGCV.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Heat Rate in kcal/kwh</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'heat_rate', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'heat_rate', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'heat_rate', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'heat_rate', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'heat_rate', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'heat_rate', 0)}</td>
                 <td className="p-2 border border-gray-300">{stationHR.day}</td>
                <td className="p-2 border border-gray-300">{stationHR.month}</td>
                <td className="p-2 border border-gray-300">{stationHR.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">LDO/HSD Consumption in KL</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'ldo_hsd_consumption_kl')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'ldo_hsd_consumption_kl')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'ldo_hsd_consumption_kl')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'ldo_hsd_consumption_kl')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'ldo_hsd_consumption_kl')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'ldo_hsd_consumption_kl')}</td>
                 <td className="p-2 border border-gray-300">{stationOil.day}</td>
                <td className="p-2 border border-gray-300">{stationOil.month}</td>
                <td className="p-2 border border-gray-300">{stationOil.year}</td>
            </tr>
             <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Specific Oil Consumption in ml/kwh</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'sp_oil_consumption_ml_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'sp_oil_consumption_ml_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'sp_oil_consumption_ml_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'sp_oil_consumption_ml_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'sp_oil_consumption_ml_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'sp_oil_consumption_ml_kwh')}</td>
                 <td className="p-2 border border-gray-300">{stationSpOil.day}</td>
                <td className="p-2 border border-gray-300">{stationSpOil.month}</td>
                <td className="p-2 border border-gray-300">{stationSpOil.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Aux. Power Consumption in MU</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'aux_power_consumption_mu', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'aux_power_consumption_mu', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'aux_power_consumption_mu', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'aux_power_consumption_mu', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'aux_power_consumption_mu', 3)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'aux_power_consumption_mu', 3)}</td>
                 <td className="p-2 border border-gray-300">{stationAuxMU.day}</td>
                <td className="p-2 border border-gray-300">{stationAuxMU.month}</td>
                <td className="p-2 border border-gray-300">{stationAuxMU.year}</td>
            </tr>
             <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">% Aux. Power Consumption</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'aux_power_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'aux_power_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'aux_power_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'aux_power_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'aux_power_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'aux_power_percent')}</td>
                 <td className="p-2 border border-gray-300">{stationAuxPerc.day}</td>
                <td className="p-2 border border-gray-300">{stationAuxPerc.month}</td>
                <td className="p-2 border border-gray-300">{stationAuxPerc.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">DM Water Consumption in Cu. M</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'dm_water_consumption_cu_m', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'dm_water_consumption_cu_m', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'dm_water_consumption_cu_m', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'dm_water_consumption_cu_m', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'dm_water_consumption_cu_m', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'dm_water_consumption_cu_m', 0)}</td>
                 <td className="p-2 border border-gray-300">{stationDM.day}</td>
                <td className="p-2 border border-gray-300">{stationDM.month}</td>
                <td className="p-2 border border-gray-300">{stationDM.year}</td>
            </tr>
             <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Specific DM Wtr. Consumption in %</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'sp_dm_water_consumption_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'sp_dm_water_consumption_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'sp_dm_water_consumption_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'sp_dm_water_consumption_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'sp_dm_water_consumption_percent')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'sp_dm_water_consumption_percent')}</td>
                 <td className="p-2 border border-gray-300">{stationSpDM.day}</td>
                <td className="p-2 border border-gray-300">{stationSpDM.month}</td>
                <td className="p-2 border border-gray-300">{stationSpDM.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Steam Gen (T)</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'steam_gen_t', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'steam_gen_t', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'steam_gen_t', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'steam_gen_t', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'steam_gen_t', 0)}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'steam_gen_t', 0)}</td>
                 <td className="p-2 border border-gray-300">{stationSteam.day}</td>
                <td className="p-2 border border-gray-300">{stationSteam.month}</td>
                <td className="p-2 border border-gray-300">{stationSteam.year}</td>
            </tr>
             <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Sp. Steam Consumption in kg/kwh</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'sp_steam_consumption_kg_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'sp_steam_consumption_kg_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'sp_steam_consumption_kg_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'sp_steam_consumption_kg_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'sp_steam_consumption_kg_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'sp_steam_consumption_kg_kwh')}</td>
                 <td className="p-2 border border-gray-300">{stationSpSteam.day}</td>
                <td className="p-2 border border-gray-300">{stationSpSteam.month}</td>
                <td className="p-2 border border-gray-300">{stationSpSteam.year}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Stack Emission (SPM) in mg/Nm3</td>
                <td className="p-2 border border-gray-300">{getField(unit1Daily, 'stack_emission_spm_mg_nm3')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Monthly, 'stack_emission_spm_mg_nm3')}</td>
                <td className="p-2 border border-gray-300">{getField(unit1Yearly, 'stack_emission_spm_mg_nm3')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Daily, 'stack_emission_spm_mg_nm3')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Monthly, 'stack_emission_spm_mg_nm3')}</td>
                <td className="p-2 border border-gray-300">{getField(unit2Yearly, 'stack_emission_spm_mg_nm3')}</td>
                 <td className="p-2 border border-gray-300">{stationStack.day}</td>
                <td className="p-2 border border-gray-300">{stationStack.month}</td>
                <td className="p-2 border border-gray-300">{stationStack.year}</td>
            </tr>
            
            {/* ✅ NEW: Spacer Row */}
            <tr className="bg-orange-100 font-semibold text-orange-800">
                <td colSpan="10" className="p-2 border border-orange-300 text-left">STATION-LEVEL PARAMETERS</td>
            </tr>

            {/* ✅ NEW: Station Data Rows */}
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Avg. Raw Water Used, Cu. M / Hr.</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'avg_raw_water_used_cu_m_hr')}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'avg_raw_water_used_cu_m_hr')}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'avg_raw_water_used_cu_m_hr')}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Total Raw Water Used, Cu. M</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'total_raw_water_used_cu_m')}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'total_raw_water_used_cu_m')}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'total_raw_water_used_cu_m')}</td>
            </tr>
             <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">Sp. Raw Water Used, Ltr. / Kwh</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'sp_raw_water_used_ltr_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'sp_raw_water_used_ltr_kwh')}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'sp_raw_water_used_ltr_kwh')}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">RO Plant running Hrs</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'ro_plant_running_hrs', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'ro_plant_running_hrs', 1)}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'ro_plant_running_hrs', 1)}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">RO Plant I/L</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'ro_plant_il')}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'ro_plant_il')}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'ro_plant_il')}</td>
            </tr>
            <tr className="hover:bg-gray-50 hover:font-bold">
                <td className="p-2 border border-gray-300 text-left font-medium">RO Plant O/L</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td><td className="p-2 border border-gray-300">-</td>
                <td className="p-2 border border-gray-300">{getField(stationDaily, 'ro_plant_ol')}</td>
                <td className="p-2 border border-gray-300">{getField(stationMonthly, 'ro_plant_ol')}</td>
                <td className="p-2 border border-gray-300">{getField(stationYearly, 'ro_plant_ol')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* --- Since InGception Data --- */}
      <div className="mt-6 text-xs text-gray-700 grid grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded-lg shadow border">
            <h3 className="font-semibold mb-1">Since Inception (Unit-1)</h3>
            <p>Generation MU: 13980.453</p>
            <p>Running Hr: 129532.55</p>
        </div>
         <div className="bg-white p-3 rounded-lg shadow border">
            <h3 className="font-semibold mb-1">Since Inception (Unit-2)</h3>
            <p>Generation MU: 14038.496</p>
            <p>Running Hr: 127508.61</p>
        </div>
      </div>

    </div>
  );
}