import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
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

  /* ================= LOAD KPI PREVIEW ================= */
  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/dpr/kpi/preview`, {
        params: { date: reportDate },
        headers: { Authorization: authHeader },
      });
      setKpis(res.data || {});
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

  /* ================= SAVE DPR (DAY ONLY) ================= */
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

      await axios.post(`${API_URL}/dpr/kpi/save`, payload, {
        headers: { Authorization: authHeader },
      });

      alert("✅ DPR saved successfully!");
    } catch (err) {
      console.error("Save failed", err);
      alert("❌ Failed to save DPR");
    } finally {
      setSaving(false);
    }
  };

  /* ================= VALUE RESOLVER ================= */
  const v = (unit, kpi, period, d = 2) => {
    const val = kpis?.[unit]?.[kpi]?.[period];
    if (val === undefined || val === null || Number.isNaN(val)) return "—";
    return Number(val).toFixed(d);
  };

  /* ================= KPI ROW ================= */
  const Row = ({ label, kpi, unit = "", decimals = 2 }) => (
    <tr>
      <td className="kpi-label">
        {label}
        {unit && <span className="kpi-unit"> ({unit})</span>}
      </td>

      {/* Unit-1 Columns */}
      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Unit-1-${p}`} className="kpi-val unit1">
          {v("Unit-1", kpi, p, decimals)}
        </td>
      ))}

      {/* Unit-2 Columns */}
      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Unit-2-${p}`} className="kpi-val unit2">
          {v("Unit-2", kpi, p, decimals)}
        </td>
      ))}

      {/* Station Columns */}
      {["day", "month", "year"].map((p) => (
        <td key={`${kpi}-Station-${p}`} className="kpi-val station">
          {v("Station", kpi, p, decimals)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="dpr-root">
      {/* ================= HEADER ================= */}
      <div className="dpr-header">
        <div className="header-left">
          <div className="title">
            2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA
          </div>
          <div className="sub">DAILY PLANT PERFORMANCE REPORT</div>
        </div>

        <div className="controls">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="date-input"
          />
          <button onClick={saveDPR} disabled={saving} className="save-btn">
            {saving ? "⏳ Saving…" : "💾 Save DPR"}
          </button>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading KPIs…</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dpr-table">
            <thead>
              <tr>
                <th rowSpan="2" className="header-main">
                  Key Plant Parameters
                </th>
                <th colSpan="3" className="header-unit1">
                  UNIT-1
                </th>
                <th colSpan="3" className="header-unit2">
                  UNIT-2
                </th>
                <th colSpan="3" className="header-station">
                  STATION
                </th>
              </tr>
              <tr>
                {["Day", "Month", "Year", "Day", "Month", "Year", "Day", "Month", "Year"].map(
                  (h, i) => {
                    let cls = "";
                    if (i < 3) cls = "subheader-unit1";
                    else if (i < 6) cls = "subheader-unit2";
                    else cls = "subheader-station";
                    
                    return (
                      <th key={`${h}-${i}`} className={cls}>
                        {h}
                      </th>
                    );
                  }
                )}
              </tr>
            </thead>

            <tbody>
              <Row label="Generation" kpi="generation" unit="MU" decimals={3} />
              <Row label="PLF" kpi="plf_percent" unit="%" decimals={2} />
              <Row label="Running Hour" kpi="running_hour" unit="Hr" decimals={2} />
              <Row
                label="Plant Availability"
                kpi="plant_availability_percent"
                unit="%"
                decimals={2}
              />
              <Row
                label="Planned Outage"
                kpi="planned_outage_hour"
                unit="Hr"
                decimals={2}
              />
              <Row
                label="Strategic Outage"
                kpi="strategic_outage_hour"
                unit="Hr"
                decimals={2}
              />

              <tr className="section-break">
                <td colSpan="10"></td>
              </tr>

              <Row
                label="Coal Consumption"
                kpi="coal_consumption"
                unit="T"
                decimals={3}
              />
              <Row
                label="Specific Coal"
                kpi="specific_coal"
                unit="kg/kWh"
                decimals={3}
              />
              <Row label="Average GCV" kpi="gcv" unit="kcal/kg" decimals={2} />
              <Row label="Heat Rate" kpi="heat_rate" unit="kcal/kWh" decimals={2} />

              <tr className="section-break">
                <td colSpan="10"></td>
              </tr>

              <Row
                label="LDO / HSD Consumption"
                kpi="oil_consumption"
                unit="KL"
                decimals={3}
              />
              <Row
                label="Specific Oil"
                kpi="specific_oil"
                unit="ml/kWh"
                decimals={3}
              />

              <tr className="section-break">
                <td colSpan="10"></td>
              </tr>

              <Row
                label="Aux Power Consumption"
                kpi="aux_power"
                unit="MU"
                decimals={3}
              />
              <Row label="Aux Power %" kpi="aux_power_percent" unit="%" decimals={2} />

              <tr className="section-break">
                <td colSpan="10"></td>
              </tr>

              <Row
                label="Steam Generation"
                kpi="steam_generation"
                unit="T"
                decimals={3}
              />
              <Row
                label="Specific Steam"
                kpi="specific_steam"
                unit="T/MWh"
                decimals={3}
              />

              <tr className="section-break">
                <td colSpan="10"></td>
              </tr>

              <Row
                label="DM Water Consumption"
                kpi="dm_water"
                unit="Cu.M"
                decimals={3}
              />
              <Row
                label="Specific DM Water"
                kpi="specific_dm_percent"
                unit="%"
                decimals={2}
              />
            </tbody>
          </table>
        </div>
      )}

      {/* ================= REMARKS ================= */}
      <div className="remarks-section">
        <div className="remarks-header">Remarks</div>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter operational remarks, observations, or notes..."
          className="remarks-input"
        />
      </div>

      <style>{`
        * { box-sizing: border-box; }
        
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          margin: 0;
          padding: 20px;
        }
        
        .dpr-root { 
          max-width: 1400px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        /* =============== HEADER =============== */
        .dpr-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          background: linear-gradient(135deg, #c2410c 0%, #9a3412 100%);
          color: white;
          padding: 20px 30px;
        }
        
        .header-left { flex: 1; }
        
        .title { 
          font-weight: 700; 
          font-size: 18px;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        
        .sub { 
          font-size: 12px; 
          opacity: 0.9;
          font-weight: 500;
          letter-spacing: 1px;
        }
        
        .controls { 
          display: flex; 
          gap: 12px;
          align-items: center;
        }
        
        .date-input {
          padding: 8px 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          background: rgba(255,255,255,0.95);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .date-input:hover {
          background: white;
          border-color: rgba(255,255,255,0.5);
        }
        
        .save-btn { 
          background: linear-gradient(135deg, #15803d 0%, #16a34a 100%);
          color: white; 
          border: none; 
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(21, 128, 61, 0.3);
        }
        
        .save-btn:hover:not(:disabled) { 
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(21, 128, 61, 0.4);
        }
        
        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        /* =============== TABLE =============== */
        .table-wrapper {
          overflow-x: auto;
          padding: 20px;
        }
        
        .dpr-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 12px;
        }
        
        .dpr-table th { 
          padding: 10px 8px;
          font-weight: 600;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        
        .header-main {
          background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
          color: white;
          min-width: 200px;
          text-align: left !important;
          padding-left: 15px !important;
        }
        
        .header-unit1 { 
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
        }
        
        .header-unit2 { 
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: white;
        }
        
        .header-station { 
          background: linear-gradient(135deg, #c2410c 0%, #9a3412 100%);
          color: white;
        }
        
        .subheader-unit1 { 
          background: rgba(37, 99, 235, 0.15);
          color: #1e40af;
          font-size: 10px;
        }
        
        .subheader-unit2 { 
          background: rgba(124, 58, 237, 0.15);
          color: #6d28d9;
          font-size: 10px;
        }
        
        .subheader-station { 
          background: rgba(194, 65, 12, 0.15);
          color: #9a3412;
          font-size: 10px;
        }
        
        .dpr-table td { 
          border: 1px solid #e5e7eb; 
          padding: 8px; 
          text-align: center;
          font-weight: 500;
        }
        
        .kpi-label { 
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          font-weight: 600; 
          text-align: left !important;
          padding-left: 15px !important;
          color: #92400e;
        }
        
        .kpi-unit { 
          font-size: 9px; 
          color: #b45309;
          font-weight: 500;
          opacity: 0.8;
        }
        
        /* Color-coded columns */
        .kpi-val.unit1 { 
          background: rgba(37, 99, 235, 0.05);
          color: #1e40af;
        }
        
        .kpi-val.unit2 { 
          background: rgba(124, 58, 237, 0.05);
          color: #6d28d9;
        }
        
        .kpi-val.station { 
          background: rgba(194, 65, 12, 0.05);
          color: #9a3412;
          font-weight: 600;
        }
        
        .section-break td {
          border: none;
          height: 8px;
          background: #f9fafb;
        }
        
        /* =============== REMARKS =============== */
        .remarks-section {
          margin: 20px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .remarks-header {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          font-weight: 600;
          padding: 12px 15px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .remarks-input { 
          width: 100%; 
          min-height: 80px;
          border: none;
          padding: 15px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          line-height: 1.6;
        }
        
        .remarks-input:focus {
          outline: none;
          background: #fef9f2;
        }
        
        /* =============== LOADING =============== */
        .loading { 
          text-align: center; 
          padding: 60px 20px;
          color: #6b7280;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 20px;
          border: 4px solid #e5e7eb;
          border-top-color: #c2410c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* =============== RESPONSIVE =============== */
        @media (max-width: 1200px) {
          .dpr-table { font-size: 10px; }
          .dpr-header { flex-direction: column; gap: 15px; }
          .header-left { text-align: center; }
        }
        
        @media print {
          body { background: white; padding: 0; }
          .dpr-root { box-shadow: none; }
          .controls { display: none; }
        }
      `}</style>
    </div>
  );
}