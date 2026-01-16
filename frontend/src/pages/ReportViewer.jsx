// DPRPageComplete.jsx

import React, { useEffect, useState, useMemo } from "react";

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

export default function DPRPageComplete({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  // Default to yesterday
  const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString("en-CA");
  };

  const [reportDate, setReportDate] = useState(getYesterdayDate());
  const [kpis, setKpis] = useState({});
  const [shutdownDetails, setShutdownDetails] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoCalculate, setAutoCalculate] = useState(false);

  // LDO Stock Data (blank inputs - will be wired later)
  const [ldoStock, setLdoStock] = useState({
    tank1_initial_stock: "",
    tank1_receipt: "",
    tank1_usage: "",
    tank1_closing_stock: "",
    tank2_initial_stock: "",
    tank2_receipt: "",
    tank2_usage: "",
    tank2_closing_stock: "",
  });

  // Station additional data from manual KPIs
  const [stationManualData, setStationManualData] = useState({
    stn_net_export_exbus: "",
    avg_raw_water_used: "",
    sp_raw_water_used: "",
    ro_running_hour: "",
    ro_production_cum: "",
    coal_indonesian_percent: "",
    coal_southafrica_percent: "",
    coal_domestic_percent: "",
    clarifier_level: "",
  });

  const loadPreview = async () => {
  setLoading(true);
  try {
    const url = `${API_URL}/dpr/kpi/preview?date=${encodeURIComponent(reportDate)}`;
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    });
    const data = await res.json();
    
    // ✅ All KPIs loaded from database!
    setKpis(data.kpis || {});
    setShutdownDetails(data.shutdown_details || []);
    
  } catch (err) {
    console.error("Preview load failed", err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (autoCalculate) {
      loadPreview();
      setRemarks("");
    }
  }, [reportDate, authHeader, autoCalculate]);

  const saveDPR = async () => {
    setSaving(true);
    try {
      // Merge computed KPIs with manual station data
      const payload = {
        date: reportDate,
        remarks,
        computed_kpis: {
          "Unit-1": Object.fromEntries(
            Object.entries(kpis["Unit-1"] || {}).map(([k, v]) => [k, v?.day])
          ),
          "Unit-2": Object.fromEntries(
            Object.entries(kpis["Unit-2"] || {}).map(([k, v]) => [k, v?.day])
          ),
          Station: {
            ...Object.fromEntries(
              Object.entries(kpis["Station"] || {}).map(([k, v]) => [k, v?.day])
            ),
            ...stationManualData
          },
        },
        ldo_stock: ldoStock,
        shutdown_details: shutdownDetails,
      };

      await fetch(`${API_URL}/dpr/kpi/save`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      alert("✅ DPR saved successfully!");
    } catch (err) {
      console.error("Save failed", err);
      alert("❌ Failed to save DPR");
    } finally {
      setSaving(false);
    }
  };

  const v = (unit, kpi, period, d = 2) => {
    const val = kpis?.[unit]?.[kpi]?.[period];
    if (val === undefined || val === null || Number.isNaN(val)) return "—";
    return Number(val).toFixed(d);
  };

  const downloadPDF = async () => {
    setGenerating(true);

    try {
      const url = `${API_URL}/dpr/pdf/download?date=${encodeURIComponent(reportDate)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        throw new Error("PDF generation failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `DPR_Report_${reportDate}.pdf`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      alert(`✅ PDF downloaded: DPR_Report_${reportDate}.pdf`);
    } catch (err) {
      console.error("PDF failed", err);
      alert(`❌ PDF failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const Row = ({ label, kpi, unit = "", decimals = 2 }) => (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-left font-medium text-gray-700 text-xs bg-gray-50 sticky left-0 z-10">
        {label}
        {unit && <span className="text-[10px] text-gray-500 ml-1">({unit})</span>}
      </td>

      {["day", "month", "year"].map((p) => (
        <td
          key={`${kpi}-Unit-1-${p}`}
          className="py-2 px-3 text-center text-xs text-gray-600 tabular-nums"
        >
          {v("Unit-1", kpi, p, decimals)}
        </td>
      ))}

      {["day", "month", "year"].map((p) => (
        <td
          key={`${kpi}-Unit-2-${p}`}
          className="py-2 px-3 text-center text-xs text-gray-600 tabular-nums"
        >
          {v("Unit-2", kpi, p, decimals)}
        </td>
      ))}

      {["day", "month", "year"].map((p) => (
        <td
          key={`${kpi}-Station-${p}`}
          className="py-2 px-3 text-center text-xs font-semibold text-orange-600 tabular-nums bg-orange-50"
        >
          {v("Station", kpi, p, decimals)}
        </td>
      ))}
    </tr>
  );

  const InputCell = ({ value, onChange, placeholder = "0.00", step = "0.01" }) => (
    <input
      type="number"
      step={step}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
    />
  );

  const updateShutdownDetail = (index, field, value) => {
    const updated = [...shutdownDetails];
    if (!updated[index]) {
      updated[index] = {
        unit: "",
        outage_type: "",
        shutdown_date: "",
        shutdown_time: "",
        reason: "",
        synchronization_date: "",
        synchronization_time: ""
      };
    }
    updated[index][field] = value;
    setShutdownDetails(updated);
  };

  const addShutdownRow = () => {
    setShutdownDetails([
      ...shutdownDetails,
      {
        unit: "Unit-1",
        outage_type: "",
        shutdown_date: "",
        shutdown_time: "",
        reason: "",
        synchronization_date: "",
        synchronization_time: ""
      }
    ]);
  };

  const removeShutdownRow = (index) => {
    setShutdownDetails(shutdownDetails.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-[98%] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold tracking-wide">
                2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA
              </h1>
              <p className="text-sm mt-1">
                PLANT PERFORMANCE REPORT FOR THE DATE:{" "}
                {new Date(reportDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs mt-1 opacity-90">
                From 01-04-2025 To {new Date(reportDate).toLocaleDateString("en-GB")} (00:00 hr to 23:59)
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-2 text-sm border-2 border-white rounded bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-300"
              />

              <button
                onClick={loadPreview}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Calculating...
                  </>
                ) : (
                  <>🔄 Calculate</>
                )}
              </button>

              <label className="flex items-center gap-2 cursor-pointer bg-white/20 px-3 py-2 rounded">
                <input
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Auto</span>
              </label>

              <button
                onClick={downloadPDF}
                disabled={generating || loading}
                className="px-4 py-2 bg-green-600 text-white rounded font-semibold text-sm hover:bg-green-700 disabled:opacity-60 transition-all shadow-md flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>📄 PDF</>
                )}
              </button>

              <button
                onClick={saveDPR}
                disabled={saving}
                className="px-4 py-2 bg-white text-orange-600 rounded font-semibold text-sm hover:bg-orange-50 disabled:opacity-60 transition-all shadow-md border-2 border-white"
              >
                {saving ? "⏳ Saving…" : "💾 Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {loading && Object.keys(kpis).length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Loading KPIs…</p>
          </div>
        ) : (
          <>
            {/* Main KPI Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th
                      rowSpan="2"
                      className="bg-gray-700 text-white py-3 px-3 text-left font-semibold min-w-[220px] border border-gray-600 sticky left-0 z-20"
                    >
                      Key Plant Parameters
                    </th>
                    <th
                      colSpan="3"
                      className="bg-gray-600 text-white py-3 px-3 font-semibold border border-gray-500"
                    >
                      UNIT-1
                    </th>
                    <th
                      colSpan="3"
                      className="bg-gray-600 text-white py-3 px-3 font-semibold border border-gray-500"
                    >
                      UNIT-2
                    </th>
                    <th
                      colSpan="3"
                      className="bg-gray-700 text-white py-3 px-3 font-semibold border border-gray-600"
                    >
                      STATION
                    </th>
                  </tr>
                  <tr>
                    {["Day", "Month", "Year"].map((h) => (
                      <th
                        key={`u1-${h}`}
                        className="bg-gray-500 text-white py-2 px-3 font-medium text-[11px] border border-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                    {["Day", "Month", "Year"].map((h) => (
                      <th
                        key={`u2-${h}`}
                        className="bg-gray-500 text-white py-2 px-3 font-medium text-[11px] border border-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                    {["Day", "Month", "Year"].map((h) => (
                      <th
                        key={`st-${h}`}
                        className="bg-gray-600 text-white py-2 px-3 font-medium text-[11px] border border-gray-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  <Row label="Generation in MU" kpi="generation" unit="MU" decimals={3} />
                  <Row label="PLF %" kpi="plf_percent" unit="%" decimals={2} />
                  <Row label="Running Hour" kpi="running_hour" unit="Hr" decimals={2} />
                  <Row label="Plant Availability Factor %" kpi="plant_availability_percent" unit="%" decimals={2} />
                  <Row label="Planned Outage in Hour" kpi="planned_outage_hour" unit="Hr" decimals={2} />
                  <Row label="Planned Outage %" kpi="planned_outage_percent" unit="%" decimals={2} />
                  <Row label="Strategic Outage in Hour" kpi="strategic_outage_hour" unit="Hr" decimals={2} />
                  <Row label="Coal Consumption in T" kpi="coal_consumption" unit="T" decimals={3} />
                  <Row label="Sp. Coal Consumption in kg/kwh" kpi="specific_coal" unit="kg/kWh" decimals={3} />
                  <Row label="Average GCV of Coal in kcal/kg" kpi="gcv" unit="kcal/kg" decimals={2} />
                  <Row label="Heat Rate in kcal/kwh" kpi="heat_rate" unit="kcal/kWh" decimals={2} />
                  <Row label="LDO / HSD Consumption in KL" kpi="oil_consumption" unit="KL" decimals={3} />
                  <Row label="Specific Oil Consumption in ml/kwh" kpi="specific_oil" unit="ml/kWh" decimals={3} />
                  <Row label="Aux. Power Consumption in MU" kpi="aux_power" unit="MU" decimals={3} />
                  <Row label="Aux. Power Consumption %" kpi="aux_power_percent" unit="%" decimals={2} />
                  <Row label="Stack Emission (SPM) in mg/Nm3" kpi="stack_emission" unit="mg/Nm3" decimals={2} />
                  <Row label="Steam Generation in T" kpi="steam_generation" unit="T" decimals={3} />
                  <Row label="Sp. Steam Consumption T/Mwh" kpi="specific_steam" unit="T/MWh" decimals={3} />
                  <Row label="DM Water Consumption in Cu. M" kpi="dm_water" unit="Cu.M" decimals={3} />
                  <Row label="Specific DM Wtr. Consumption in %" kpi="specific_dm_percent" unit="%" decimals={2} />
                </tbody>
              </table>
            </div>

            {/* LDO Status & Additional Data Section */}
            <div className="m-4 border-2 border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-2 px-4 text-sm">
                LDO STATUS & ADDITIONAL PLANT DATA
              </div>

              <table className="w-full text-xs">
                <tbody>
                  {/* LDO Status */}
                  <tr className="bg-gray-100 font-semibold border-b-2 border-gray-300">
                    <td colSpan="8" className="py-2 px-4">
                      LDO STATUS (To be wired later)
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Tank</td>
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">1</td>
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">2</td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">Stn. net Export (Ex-Bus), MU</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "stn_net_export_exbus", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Initial Stock, 23-11-202</td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank1_initial_stock}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank1_initial_stock: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank2_initial_stock}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank2_initial_stock: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">Avg. Raw Water Used, Cu. M / Hr.</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "avg_raw_water_m3_per_hr", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Receipt, T (Today)</td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank1_receipt}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank1_receipt: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank2_receipt}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank2_receipt: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">Total Raw Water Used, Cu. M</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "total_raw_water_used_m3", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Rcpt:November, 2025</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      —
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">Sp. Raw Water Used, Ltr. / Kwh</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "sp_raw_water_l_per_kwh", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Receipt : Yearly</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      —
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">RO Plant Running hour</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                         {v("Station", "ro_running_hour", "day", 2)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Usage, 125 MW, #1</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      <InputCell
                        value={ldoStock.tank1_usage}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank1_usage: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">RO Plant Production, Cu.M</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                         {v("Station", "ro_production_cum", "day", 2)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Usage, 125 MW, #2</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      <InputCell
                        value={ldoStock.tank2_usage}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank2_usage: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r">Total DM Water Used (T) in CPP</td>
                    <td className="py-2 px-4" colSpan="4">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "total_dm_water_used_m3", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Total Usage, CPP</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      —
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r" rowSpan="3">
                      Coal BLending Ratio
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50" colSpan="2">
                      Indonesian %
                    </td>
                    <td className="py-2 px-4" colSpan="2">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "coal_indonesian_percent", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Used:November, 2025</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      —
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50" colSpan="2">
                      South African %
                    </td>
                    <td className="py-2 px-4" colSpan="2">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "coal_southafrica_percent", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Used: (Yearly)</td>
                    <td className="py-2 px-4 border-r" colSpan="2">
                      —
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50" colSpan="2">
                      Domestic %
                    </td>
                    <td className="py-2 px-4" colSpan="2">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "coal_domestic_percent", "day", 3)}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium bg-gray-50 border-r">Closing Stok, 23-11-202</td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank1_closing_stock}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank1_closing_stock: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <InputCell
                        value={ldoStock.tank2_closing_stock}
                        onChange={(e) => setLdoStock({ ...ldoStock, tank2_closing_stock: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4 font-medium bg-orange-50 border-r" colSpan="2">
                      Clarifier Rsver Lvl %
                    </td><td className="py-2 px-4" colSpan="3">
                      <div className="font-mono font-semibold text-gray-700">
                        {v("Station", "clarifier_level", "day", 3)}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>{/* Since Inception Section */}
        <div className="m-4 border-2 border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-2 px-4 text-sm">
            SINCE INCEPTION
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 font-semibold border-b">
                <th className="py-2 px-4 text-left border-r">Unit</th>
                <th className="py-2 px-4 text-center border-r">Gen MU</th>
                <th className="py-2 px-4 text-center border-r">Running Hrs</th>
                <th className="py-2 px-4 text-center">Unit Running Since</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 font-medium bg-gray-50 border-r">Unit-1</td>
                <td className="py-2 px-4 text-center font-semibold text-blue-700 border-r">
                  {kpis?.["Unit-1"]?.inception?.gen_mu_since_inception?.toFixed(3) || "—"}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-blue-700 border-r">
                  {kpis?.["Unit-1"]?.inception?.running_hours_since_inception?.toFixed(2) || "—"}
                </td>
                <td className="py-2 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        kpis?.["Unit-1"]?.inception?.running_since_status === "RUNNING"
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : "bg-red-100 text-red-800 border border-red-300"
                      }`}
                    >
                      {kpis?.["Unit-1"]?.inception?.running_since_status || "—"}
                    </span>
                    {kpis?.["Unit-1"]?.inception?.running_since_datetime && (
                      <span className="text-gray-600">
                        {new Date(kpis["Unit-1"].inception.running_since_datetime).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 font-medium bg-gray-50 border-r">Unit-2</td>
                <td className="py-2 px-4 text-center font-semibold text-blue-700 border-r">
                  {kpis?.["Unit-2"]?.inception?.gen_mu_since_inception?.toFixed(3) || "—"}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-blue-700 border-r">
                  {kpis?.["Unit-2"]?.inception?.running_hours_since_inception?.toFixed(2) || "—"}
                </td>
                <td className="py-2 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        kpis?.["Unit-2"]?.inception?.running_since_status === "RUNNING"
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : "bg-red-100 text-red-800 border border-red-300"
                      }`}
                    >
                      {kpis?.["Unit-2"]?.inception?.running_since_status || "—"}
                    </span>
                    {kpis?.["Unit-2"]?.inception?.running_since_datetime && (
                      <span className="text-gray-600">
                        {new Date(kpis["Unit-2"].inception.running_since_datetime).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Shutdown or Synchronisation Details */}
        <div className="m-4 border-2 border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-2 px-4 text-sm flex justify-between items-center">
            <span>SHUT DOWN OR SYNCHRONISATION DETAILS</span>
            <button
              onClick={addShutdownRow}
              className="px-3 py-1 bg-white text-red-600 rounded text-xs font-bold hover:bg-red-50"
            >
              + Add Row
            </button>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 font-semibold border-b">
                <th className="py-2 px-4 text-left border-r">UNIT</th>
                <th className="py-2 px-4 text-center border-r">Outage Type</th>
                <th className="py-2 px-4 text-center border-r">Date</th>
                <th className="py-2 px-4 text-center border-r">Time</th>
                <th className="py-2 px-4 text-center border-r">Reason</th>
                <th className="py-2 px-4 text-center border-r">Synchronization Date</th>
                <th className="py-2 px-4 text-center border-r">Time</th>
                <th className="py-2 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {shutdownDetails.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-4 text-center text-gray-500 italic">
                    No shutdown records for this date
                  </td>
                </tr>
              ) : (
                shutdownDetails.map((detail, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 border-r">
                      <select
                        value={detail.unit}
                        onChange={(e) => updateShutdownDetail(idx, "unit", e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      >
                        <option value="Unit-1">Unit-1</option>
                        <option value="Unit-2">Unit-2</option>
                      </select>
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="text"
                        value={detail.outage_type || ""}
                        onChange={(e) => updateShutdownDetail(idx, "outage_type", e.target.value)}
                        placeholder="Type"
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="date"
                        value={detail.shutdown_date || ""}
                        onChange={(e) => updateShutdownDetail(idx, "shutdown_date", e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="time"
                        value={detail.shutdown_time || ""}
                        onChange={(e) => updateShutdownDetail(idx, "shutdown_time", e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="text"
                        value={detail.reason || ""}
                        onChange={(e) => updateShutdownDetail(idx, "reason", e.target.value)}
                        placeholder="Reason"
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="date"
                        value={detail.synchronization_date || ""}
                        onChange={(e) => updateShutdownDetail(idx, "synchronization_date", e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 border-r">
                      <input
                        type="time"
                        value={detail.synchronization_time || ""}
                        onChange={(e) => updateShutdownDetail(idx, "synchronization_time", e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => removeShutdownRow(idx)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        <div className="m-4 border-2 border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-700 text-white font-semibold py-2 px-4 text-sm">Remarks:</div>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter operational remarks, observations, or notes..."
            className="w-full min-h-[100px] p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y border-0"
          />
        </div>
      </>
    )}
  </div>
</div>
);
}