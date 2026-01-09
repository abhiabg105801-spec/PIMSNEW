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

  /* ---------------- FETCH DATA (SAFE PLACEHOLDER) ---------------- */
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

  /* ---------------- TABLE ROW ---------------- */
  const Row = ({ label, kpi, unit = "" }) => (
    <tr>
      <td className="label">
        {label} {unit && <span className="unit">({unit})</span>}
      </td>
      {["Unit-1", "Unit-2", "Station"].flatMap((u) => (
        ["day", "month", "year"].map((p) => (
          <td key={`${u}-${p}`} className="val">
            {v(u, kpi, p)}
          </td>
        ))
      ))}
    </tr>
  );

  return (
    <div className="dpr-root">
      {/* ================= HEADER ================= */}
      <div className="dpr-header no-print">
        <div>
          <strong>2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA</strong>
          <div className="sub">
            PLANT PERFORMANCE REPORT FOR THE DATE
          </div>
        </div>

        <div className="controls">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
          <button onClick={() => window.print()}>Download PDF</button>
        </div>
      </div>

      {/* ================= MAIN TABLE ================= */}
      {loading ? (
        <div className="loading">Loading DPR…</div>
      ) : (
        <table className="dpr-table">
          <thead>
            <tr>
              <th rowSpan="2">Key Plant Parameters</th>
              <th colSpan="3">UNIT-1</th>
              <th colSpan="3">UNIT-2</th>
              <th colSpan="3">STATION</th>
            </tr>
            <tr>
              {["Day", "Month", "Year"].map((h) => (
                <th key={`u1-${h}`}>{h}</th>
              ))}
              {["Day", "Month", "Year"].map((h) => (
                <th key={`u2-${h}`}>{h}</th>
              ))}
              {["Day", "Month", "Year"].map((h) => (
                <th key={`st-${h}`}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Row label="Generation in MU" kpi="generation" />
            <Row label="PLF %" kpi="plf_percent" unit="%" />
            <Row label="Max / Min Generation in MW" kpi="max_min_mw" />
            <Row label="Running Hour" kpi="running_hour" unit="Hr" />
            <Row
              label="Plant Availability Factor"
              kpi="plant_availability_percent"
              unit="%"
            />
            <Row label="Planned Outage in Hour" kpi="planned_outage_hour" />
            <Row label="Planned Outage %" kpi="planned_outage_percent" unit="%" />
            <Row
              label="Strategic Outage in Hour"
              kpi="strategic_outage_hour"
            />
            <Row label="Coal Consumption in T" kpi="coal_consumption" />
            <Row
              label="Sp. Coal Consumption"
              kpi="specific_coal"
              unit="kg/kWh"
            />
            <Row label="Average GCV of Coal" kpi="gcv" unit="kcal/kg" />
            <Row label="Heat Rate" kpi="heat_rate" unit="kcal/kWh" />
            <Row label="LDO / HSD Consumption" kpi="ldo_consumption" unit="KL" />
            <Row
              label="Specific Oil Consumption"
              kpi="specific_oil"
              unit="ml/kWh"
            />
            <Row
              label="Aux. Power Consumption"
              kpi="aux_power"
              unit="MU"
            />
            <Row
              label="Aux. Power Consumption %"
              kpi="aux_power_percent"
              unit="%"
            />
            <Row
              label="Stack Emission (SPM)"
              kpi="stack_emission"
              unit="mg/Nm3"
            />
            <Row label="Steam Generation" kpi="steam_generation" unit="T" />
            <Row
              label="Sp. Steam Consumption"
              kpi="specific_steam"
              unit="T/MWh"
            />
            <Row
              label="DM Water Consumption"
              kpi="dm_water"
              unit="Cu.M"
            />
            <Row
              label="Specific DM Water Consumption"
              kpi="specific_dm_percent"
              unit="%"
            />
          </tbody>
        </table>
      )}

      {/* ================= BOTTOM SECTION ================= */}
      <div className="bottom-grid">
        {/* ---------- LDO TANK STATUS ---------- */}
        <table className="sub-table">
          <thead>
            <tr>
              <th rowSpan="2">LDO STATUS</th>
              <th colSpan="2">Tank</th>
            </tr>
            <tr>
              <th>1</th>
              <th>2</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Initial Stock</td><td>—</td><td>—</td></tr>
            <tr><td>Receipt (Today)</td><td>—</td><td>—</td></tr>
            <tr><td>Receipt (Month)</td><td>—</td><td>—</td></tr>
            <tr><td>Receipt (Year)</td><td>—</td><td>—</td></tr>
            <tr><td>Usage Unit-1</td><td colSpan="2">—</td></tr>
            <tr><td>Usage Unit-2</td><td colSpan="2">—</td></tr>
            <tr><td>Total Usage CPP</td><td colSpan="2">—</td></tr>
            <tr><td>Closing Stock</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>

        {/* ---------- SINCE INCEPTION ---------- */}
        <table className="sub-table">
          <thead>
            <tr>
              <th colSpan="4">Since Inception</th>
            </tr>
            <tr>
              <th>Unit</th>
              <th>Gen MU</th>
              <th>Running Hr</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>—</td><td>—</td><td>COD</td></tr>
            <tr><td>2</td><td>—</td><td>—</td><td>COD</td></tr>
          </tbody>
        </table>
      </div>

      {/* ================= CSS ================= */}
      <style>{`
        body { font-family: Arial, Helvetica, sans-serif; }
        .dpr-root { padding: 6px; background: white; }
        .dpr-header { display:flex; justify-content:space-between; margin-bottom:6px; }
        .sub { font-size:11px; }
        .controls button { margin-left:6px; }

        .dpr-table {
          width:100%;
          border-collapse:collapse;
          font-size:11px;
        }
        .dpr-table th, .dpr-table td {
          border:1px solid #000;
          padding:3px;
          text-align:right;
        }
        .dpr-table th { background:#e6e6e6; text-align:center; }

        .label { text-align:left; font-weight:600; }
        .unit { font-size:9px; color:#555; }

        .bottom-grid {
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:10px;
          margin-top:8px;
        }

        .sub-table {
          width:100%;
          border-collapse:collapse;
          font-size:11px;
        }
        .sub-table th, .sub-table td {
          border:1px solid #000;
          padding:3px;
          text-align:right;
        }
        .sub-table th { background:#e6e6e6; text-align:center; }

        @media print {
          .no-print { display:none; }
          body { background:white; }
        }
      `}</style>
    </div>
  );
}
