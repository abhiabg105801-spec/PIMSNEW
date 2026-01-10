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
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  /* ================= FETCH DPR DATA ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/dpr/page1`, {
        params: { date: reportDate },
        headers: { Authorization: authHeader },
      });
      setData(res.data || {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportDate]);

  const v = (unit, kpi, period = "day", d = 2) => {
    const val = data?.[unit]?.[kpi]?.[period];
    if (val === undefined || val === null || isNaN(val)) return "—";
    return Number(val).toFixed(d);
  };

  /* ================= KPI ROW ================= */
  const Row = ({ label, kpi, unit = "" }) => (
    <tr>
      <td className="kpi-label">
        {label}
        {unit && <span className="kpi-unit"> ({unit})</span>}
      </td>
      {["Unit-1", "Unit-2", "Station"].flatMap((u) =>
        ["day", "month", "year"].map((p) => (
          <td key={`${u}-${p}`} className="kpi-val">
            {v(u, kpi, p)}
          </td>
        ))
      )}
    </tr>
  );

  /* ================= PDF DOWNLOAD (BACKEND) ================= */
  const downloadPDF = async () => {
    try {
      const res = await axios.get(`${API_URL}/dpr/page1/pdf`, {
        params: { date: reportDate },
        headers: { Authorization: authHeader },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `DPR_Page1_${reportDate}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download DPR PDF");
      console.error(err);
    }
  };

  return (
    <div className="dpr-root">
      {/* ================= HEADER ================= */}
      <div className="dpr-header no-print">
        <div>
          <div className="title">
            2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA
          </div>
          <div className="sub">PLANT PERFORMANCE REPORT</div>
        </div>
        <div className="controls">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
          <button onClick={downloadPDF}>Download PDF</button>
        </div>
      </div>

      {/* ================= MAIN DPR TABLE ================= */}
      {loading ? (
        <div className="loading">Loading DPR…</div>
      ) : (
        <table className="dpr-table">
          <thead>
            <tr>
              <th rowSpan="2" className="left-head">Key Plant Parameters</th>
              <th colSpan="3">UNIT-1</th>
              <th colSpan="3">UNIT-2</th>
              <th colSpan="3">STATION</th>
            </tr>
            <tr>
              {["Day", "Month", "Year"].map((h) => <th key={`u1-${h}`}>{h}</th>)}
              {["Day", "Month", "Year"].map((h) => <th key={`u2-${h}`}>{h}</th>)}
              {["Day", "Month", "Year"].map((h) => <th key={`st-${h}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            <Row label="Generation" kpi="generation" unit="MU" />
            <Row label="PLF" kpi="plf_percent" unit="%" />
            <Row label="Running Hour" kpi="running_hour" unit="Hr" />
            <Row label="Plant Availability" kpi="plant_availability_percent" unit="%" />
            <Row label="Planned Outage" kpi="planned_outage_hour" unit="Hr" />
            <Row label="Strategic Outage" kpi="strategic_outage_hour" unit="Hr" />
            <Row label="Coal Consumption" kpi="coal_consumption" unit="T" />
            <Row label="Specific Coal" kpi="specific_coal" unit="kg/kWh" />
            <Row label="Average GCV" kpi="gcv" unit="kcal/kg" />
            <Row label="Heat Rate" kpi="heat_rate" unit="kcal/kWh" />
            <Row label="LDO / HSD Consumption" kpi="oil_consumption" unit="KL" />
            <Row label="Specific Oil" kpi="specific_oil" unit="ml/kWh" />
            <Row label="Aux Power Consumption" kpi="aux_power" unit="MU" />
            <Row label="Aux Power %" kpi="aux_power_percent" unit="%" />
            <Row label="Steam Generation" kpi="steam_generation" unit="T" />
            <Row label="Specific Steam" kpi="specific_steam" unit="T/MWh" />
            <Row label="DM Water Consumption" kpi="dm_water" unit="Cu.M" />
            <Row label="Specific DM Water" kpi="specific_dm_percent" unit="%" />
          </tbody>
        </table>
      )}

      {/* ================= BOTTOM TABLES ================= */}
<div className="bottom-grid">
  {/* ---------- FUEL / LDO STATUS ---------- */}
  <table className="sub-table">
    <thead>
      <tr><th colSpan="3">LDO / FUEL STATUS</th></tr>
      <tr>
        <th>Parameter</th>
        <th>Tank-1</th>
        <th>Tank-2</th>
      </tr>
    </thead>
    <tbody>
      {[
        "Opening Stock",
        "Receipt (Today)",
        "Receipt (Month)",
        "Receipt (Year)",
        "Total Consumption",
        "Closing Stock",
      ].map((r) => (
        <tr key={r}>
          <td className="kpi-label">{r}</td>
          <td>—</td>
          <td>—</td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* ---------- STATION WATER & EXPORT ---------- */}
  {/* ---------- STATION WATER & EXPORT ---------- */}
<table className="dpr-table station-only">
  <thead>
    <tr>
      <th className="left-head">Station Water & Export</th>
      <th>Day</th>
      <th>Month</th>
      <th>Year</th>
      <th colSpan="6"></th>
    </tr>
  </thead>
  <tbody>
    {[
      ["Stn. Net Export (Ex-Bus)", "station_net_export", "MU"],
      ["Avg. Raw Water Used", "avg_raw_water_m3_per_hr", "Cu.M / Hr"],
      ["Total Raw Water Used", "total_raw_water_used_m3", "Cu.M"],
      ["Sp. Raw Water Used", "sp_raw_water_l_per_kwh", "Ltr / kWh"],
      ["RO Plant Running Hour", "ro_running_hr", "Hr"],
      ["RO Plant Production", "ro_production", "Cu.M"],
      ["Clarifier Rsver Lvl", "clarifier_level", "%"],
    ].map(([label, kpi, unit]) => (
      <tr key={kpi}>
        <td className="kpi-label">
          {label} <span className="kpi-unit">({unit})</span>
        </td>
        <td>{v("Station", kpi, "day")}</td>
        <td>{v("Station", kpi, "month")}</td>
        <td>{v("Station", kpi, "year")}</td>
        <td colSpan="6"></td>
      </tr>
    ))}
  </tbody>
</table>

</div>

{/* ================= COAL BLENDING + SINCE INCEPTION ================= */}
<div className="bottom-grid">
  {/* ---------- COAL BLENDING RATIO ---------- */}
  <table className="sub-table">
    <thead>
      <tr><th colSpan="3">Coal Blending Ratio</th></tr>
      <tr>
        <th>Indonesian %</th>
        <th>South African %</th>
        <th>Domestic %</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>—</td>
        <td>—</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  {/* ---------- SINCE INCEPTION ---------- */}
  <table className="sub-table">
    <thead>
      <tr><th colSpan="4">Since Inception</th></tr>
      <tr>
        <th>Unit</th>
        <th>Gen MU</th>
        <th>Running Hr</th>
        <th>Since</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Unit-1</td><td>—</td><td>—</td><td>COD</td></tr>
      <tr><td>Unit-2</td><td>—</td><td>—</td><td>COD</td></tr>
    </tbody>
  </table>
</div>

{/* ================= REMARKS ================= */}
<table className="remarks">
  <tbody>
    <tr>
      <td className="kpi-label" style={{ width: "15%" }}>Remarks:</td>
      <td style={{ height: "60px" }}></td>
    </tr>
  </tbody>
</table>


      {/* ================= STYLES ================= */}
      {/* ================= STYLES ================= */}
<style>{`
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    background: #ffffff;
  }

  .dpr-root {
    padding: 10px;
    background: #ffffff;
  }

  /* ================= HEADER ================= */
  .dpr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 4px solid #c2410c; /* dark orange */
    margin-bottom: 10px;
    padding-bottom: 6px;
  }

  .title {
    font-weight: 700;
    color: #111827;
  }

  .sub {
    font-size: 11px;
    color: #6b7280;
  }

  .controls input {
    padding: 4px;
  }

  .controls button {
    background: #c2410c;
    color: #ffffff;
    border: none;
    padding: 6px 14px;
    margin-left: 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls button:hover {
    background: #9a3412;
  }

  /* ================= MAIN DPR TABLE ================= */
  .dpr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 6px;
  }

  .dpr-table th {
    background: #c2410c; /* dark orange */
    color: #ffffff;
    border: 1px solid #9a3412;
    padding: 5px;
    text-align: center;
    font-weight: 600;
  }

  .dpr-table td {
    border: 1px solid #e5e7eb;
    padding: 5px;
    text-align: center; /* values centered */
    color: #111827;
  }

  /* alternate row highlight */
  .dpr-table tbody tr:nth-child(even) {
    background: #fff7ed; /* light orange */
  }

  .dpr-table tbody tr:nth-child(odd) {
    background: #ffffff;
  }

  /* KPI label column */
  .kpi-label {
    text-align: left !important;
    font-weight: 600;
    background: #ffedd5; /* soft orange */
    color: #7c2d12;
  }

  .kpi-unit {
    font-size: 9px;
    color: #92400e;
  }

  /* ================= BOTTOM GRID ================= */
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  /* ================= SUB TABLES ================= */
  .sub-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .sub-table th {
    background: #c2410c; /* same dark orange */
    color: #ffffff;
    padding: 5px;
    border: 1px solid #9a3412;
    text-align: center;
    font-weight: 600;
  }

  .sub-table td {
    border: 1px solid #e5e7eb;
    padding: 5px;
    text-align: center;
    background: #ffffff;
  }

  .sub-table tbody tr:nth-child(even) {
    background: #fff7ed;
  }

  .sub-table .kpi-label {
    background: #ffedd5;
    color: #7c2d12;
    text-align: left;
    font-weight: 600;
  }

  /* ================= REMARKS ================= */
  .remarks {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 11px;
  }

  .remarks td {
    border: 1px solid #e5e7eb;
    padding: 6px;
  }

  /* ================= LOADING ================= */
  .loading {
    text-align: center;
    padding: 20px;
    color: #6b7280;
  }

  /* ================= PRINT ================= */
  @media print {
    .no-print {
      display: none;
    }

    .dpr-table th,
    .sub-table th {
      background: #e5e7eb;
      color: #000000;
    }

    .kpi-label {
      background: #f3f4f6;
      color: #000000;
    }
  }
`}</style>

    </div>
  );
}
