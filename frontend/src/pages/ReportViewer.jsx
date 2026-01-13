import React, { useEffect, useState, useMemo } from "react";

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

export default function DPRPage1({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const [reportDate, setReportDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [kpis, setKpis] = useState({});
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/dpr/kpi/preview?date=${encodeURIComponent(reportDate)}`;
      const res = await fetch(url, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      setKpis(data || {});
    } catch (err) {
      console.error("Preview load failed", err);
      setKpis({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
    setRemarks("");
  }, [reportDate, authHeader]);

  const saveDPR = async () => {
    setSaving(true);
    try {
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
          Station: Object.fromEntries(
            Object.entries(kpis["Station"] || {}).map(([k, v]) => [k, v?.day])
          ),
        },
      };

      await fetch(`${API_URL}/dpr/kpi/save`, {
        method: "POST",
        headers: { 
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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

  // ============= PDF DOWNLOAD FROM BACKEND =============
  const downloadPDF = async () => {
    setGenerating(true);
    
    try {
      // Call backend endpoint to generate PDF
      const url = `${API_URL}/dpr/pdf/download?date=${encodeURIComponent(reportDate)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          Authorization: authHeader 
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'PDF generation failed');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `DPR_Report_${reportDate}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      alert(`✅ PDF downloaded successfully: DPR_Report_${reportDate}.pdf`);
    } catch (err) {
      console.error('PDF download failed', err);
      alert(`❌ Failed to download PDF: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ============= RENDER ROW COMPONENT =============
  const Row = ({ label, kpi, unit = "", decimals = 2 }) => (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-left font-medium text-gray-700 text-xs bg-gray-50">
        {label}
        {unit && <span className="text-[10px] text-gray-500 ml-1">({unit})</span>}
      </td>

      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Unit-1-${p}`} className="py-2 px-3 text-center text-xs text-gray-600 tabular-nums">
          {v("Unit-1", kpi, p, decimals)}
        </td>
      ))}

      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Unit-2-${p}`} className="py-2 px-3 text-center text-xs text-gray-600 tabular-nums">
          {v("Unit-2", kpi, p, decimals)}
        </td>
      ))}

      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Station-${p}`} className="py-2 px-3 text-center text-xs font-semibold text-orange-600 tabular-nums bg-orange-50">
          {v("Station", kpi, p, decimals)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-base font-bold tracking-wide">
                2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA
              </h1>
              <p className="text-xs opacity-90 mt-1 tracking-wider">DAILY PLANT PERFORMANCE REPORT</p>
            </div>
            
            <div className="flex gap-3 items-center">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-1.5 text-sm border-2 border-white/30 rounded bg-white/95 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              
              <button 
                onClick={downloadPDF} 
                disabled={generating || loading}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    📄 Download PDF
                  </>
                )}
              </button>

              <button 
                onClick={saveDPR} 
                disabled={saving}
                className="px-4 py-1.5 bg-white text-orange-600 rounded font-semibold text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                {saving ? "⏳ Saving…" : "💾 Save DPR"}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Loading KPIs…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th rowSpan="2" className="bg-gray-700 text-white py-3 px-3 text-left font-semibold min-w-[180px] border-r border-gray-600">
                    Key Plant Parameters
                  </th>
                  <th colSpan="3" className="bg-gray-600 text-white py-3 px-3 font-semibold border-r border-gray-500">
                    UNIT-1
                  </th>
                  <th colSpan="3" className="bg-gray-600 text-white py-3 px-3 font-semibold border-r border-gray-500">
                    UNIT-2
                  </th>
                  <th colSpan="3" className="bg-orange-600 text-white py-3 px-3 font-semibold">
                    STATION
                  </th>
                </tr>
                <tr>
                  {["Day", "Month", "Year"].map((h) => (
                    <th key={`u1-${h}`} className="bg-gray-500 text-white py-2 px-3 font-medium text-[10px] border-r border-gray-400">
                      {h}
                    </th>
                  ))}
                  {["Day", "Month", "Year"].map((h) => (
                    <th key={`u2-${h}`} className="bg-gray-500 text-white py-2 px-3 font-medium text-[10px] border-r border-gray-400">
                      {h}
                    </th>
                  ))}
                  {["Day", "Month", "Year"].map((h) => (
                    <th key={`st-${h}`} className="bg-orange-500 text-white py-2 px-3 font-medium text-[10px] border-r border-orange-400 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                <Row label="Generation" kpi="generation" unit="MU" decimals={3} />
                <Row label="PLF" kpi="plf_percent" unit="%" decimals={2} />
                <Row label="Running Hour" kpi="running_hour" unit="Hr" decimals={2} />
                <Row label="Plant Availability" kpi="plant_availability_percent" unit="%" decimals={2} />
                <Row label="Planned Outage" kpi="planned_outage_hour" unit="Hr" decimals={2} />
                <Row label="Planned Outage %" kpi="planned_outage_percent" unit="%" decimals={2} />
                <Row label="Strategic Outage" kpi="strategic_outage_hour" unit="Hr" decimals={2} />
                <Row label="Coal Consumption" kpi="coal_consumption" unit="T" decimals={3} />
                <Row label="Specific Coal" kpi="specific_coal" unit="kg/kWh" decimals={3} />
                <Row label="Average GCV" kpi="gcv" unit="kcal/kg" decimals={2} />
                <Row label="Heat Rate" kpi="heat_rate" unit="kcal/kWh" decimals={2} />
                <Row label="LDO / HSD Consumption" kpi="oil_consumption" unit="KL" decimals={3} />
                <Row label="Specific Oil" kpi="specific_oil" unit="ml/kWh" decimals={3} />
                <Row label="Aux Power Consumption" kpi="aux_power" unit="MU" decimals={3} />
                <Row label="Aux Power %" kpi="aux_power_percent" unit="%" decimals={2} />
                <Row label="Steam Generation" kpi="steam_generation" unit="T" decimals={3} />
                <Row label="Specific Steam" kpi="specific_steam" unit="T/MWh" decimals={3} />
                <Row label="DM Water Consumption" kpi="dm_water" unit="Cu.M" decimals={3} />
                <Row label="Specific DM Water" kpi="specific_dm_percent" unit="%" decimals={2} />
              </tbody>
            </table>
          </div>
        )}

        {/* Remarks */}
        <div className="m-4 border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 text-gray-700 font-semibold py-2 px-4 text-sm border-b border-gray-300">
            Remarks
          </div>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter operational remarks, observations, or notes..."
            className="w-full min-h-[60px] p-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y border-0"
          />
        </div>
      </div>
    </div>
  );
}