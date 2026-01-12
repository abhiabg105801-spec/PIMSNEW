import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

const ENERGY_KPIS = new Set([
  "generation",
  "plf_percent",
  "aux_power",
  "aux_power_percent",
]);

const DPR_KPI_KEY_MAP = {
  generation: {
    "Unit-1": "unit1_generation",
    "Unit-2": "unit2_generation",
    Station: "unit1_generation", // not used
  },
  plf_percent: {
    "Unit-1": "unit1_plf_percent",
    "Unit-2": "unit2_plf_percent",
    Station: "station_plf_percent",
  },
  aux_power: {
    "Unit-1": "unit1_aux_consumption_mwh",
    "Unit-2": "unit2_aux_consumption_mwh",
    Station: "total_station_aux_mwh",
  },
  aux_power_percent: {
    "Unit-1": "unit1_aux_percent",
    "Unit-2": "unit2_aux_percent",
    Station: null,
  },
  steam_generation: {
    "Unit-1": "steam_consumption",
    "Unit-2": "steam_consumption",
  },
};

/* ================= KPI AGGREGATION RULES ================= */
const SUM_KPIS = new Set([
  "generation",
  "coal_consumption",
  "oil_consumption",
  "aux_power",
  "steam_generation",
  "dm_water",
]);

const AVG_KPIS = new Set([
  "plf_percent",
  "aux_power_percent",
  "plant_availability_percent",
  "specific_coal",
  "specific_oil",
  "specific_steam",
  "specific_dm_percent",
  "gcv",
  "heat_rate",
  "running_hour",
  "planned_outage_hour",
  "strategic_outage_hour",
]);

export default function DPRPage1({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const [reportDate, setReportDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [data, setData] = useState({});
  const [previewKpis, setPreviewKpis] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ================= FETCH SAVED DPR ================= */
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
    setPreviewKpis(null);
    setRemarks("");
  }, [reportDate]);

  /* ================= CALCULATE KPIs (PREVIEW) ================= */
  const calculateKpis = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/dpr/kpi/calc`,
        {},
        {
          params: { date: reportDate },
          headers: { Authorization: authHeader },
        }
      );
      setPreviewKpis(res.data.computed_kpis || {});
    } catch (err) {
      alert("Failed to calculate KPIs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= SAVE DPR ================= */
  const saveDPR = async () => {
    if (!previewKpis) {
      alert("Please calculate KPIs before saving");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/dpr/kpi/save`,
        {
          date: reportDate,
          remarks,
          computed_kpis: previewKpis,
        },
        {
          headers: { Authorization: authHeader },
        }
      );
      alert("DPR saved successfully");
      setPreviewKpis(null);
      setRemarks("");
      fetchData();
    } catch (err) {
      alert("Failed to save DPR");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ================= VALUE RESOLVER ================= */
  


  const v = (unit, kpi, period = "day", d = 2) => {
  const mappedKpi = DPR_KPI_KEY_MAP[kpi]?.[unit] || kpi;

  // ================= PREVIEW (DAY) =================
  if (previewKpis && period === "day") {

    // 🔥 ENERGY KPIs COME FROM previewKpis.energy
    if (ENERGY_KPIS.has(kpi)) {
      const val = previewKpis.energy?.[mappedKpi];
      if (val !== undefined && !isNaN(val)) {
        return Number(val).toFixed(d);
      }
    }

    // 🔥 NORMAL KPIs (Unit / Station)
    const val = previewKpis[unit]?.[mappedKpi];
    if (val !== undefined && !isNaN(val)) {
      return Number(val).toFixed(d);
    }
  }

  // ================= SAVED DPR =================
  // ENERGY KPIs SAVED UNDER Station
  const sourceUnit = ENERGY_KPIS.has(kpi) ? "Station" : unit;
  const val = data?.[sourceUnit]?.[mappedKpi]?.[period];

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
          <button onClick={calculateKpis}>Calculate KPIs</button>
          <button onClick={saveDPR} disabled={saving}>
            {saving ? "Saving…" : "Save DPR"}
          </button>
        </div>
      </div>

      {/* ================= MAIN DPR TABLE ================= */}
      {loading ? (
        <div className="loading">Loading DPR…</div>
      ) : (
        <table className="dpr-table">
          <thead>
            <tr>
              <th rowSpan="2" className="left-head">
                Key Plant Parameters
              </th>
              <th colSpan="3">UNIT-1</th>
              <th colSpan="3">UNIT-2</th>
              <th colSpan="3">STATION</th>
            </tr>
            <tr>
              {Array(3)
                .fill(["Day", "Month", "Year"])
                .flat()
                .map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
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

      {/* ================= REMARKS ================= */}
      <table className="remarks">
        <tbody>
          <tr>
            <td className="kpi-label" style={{ width: "15%" }}>
              Remarks:
            </td>
            <td>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter DPR remarks..."
                style={{
                  width: "100%",
                  height: "60px",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: "11px",
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <style>{`
        body { font-family: "Segoe UI", Arial, sans-serif; background: #fff; }
        .dpr-root { padding: 10px; }
        .dpr-header { display: flex; justify-content: space-between; border-bottom: 4px solid #c2410c; margin-bottom: 10px; }
        .title { font-weight: 700; }
        .sub { font-size: 11px; color: #6b7280; }
        .controls button { background: #c2410c; color: #fff; border: none; padding: 6px 12px; margin-left: 6px; cursor: pointer; }
        .controls button:disabled { opacity: 0.6; cursor: not-allowed; }
        .dpr-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .dpr-table th { background: #c2410c; color: #fff; padding: 5px; }
        .dpr-table td { border: 1px solid #e5e7eb; padding: 5px; text-align: center; }
        .kpi-label { background: #ffedd5; font-weight: 600; text-align: left; }
        .kpi-unit { font-size: 9px; color: #92400e; }
        .remarks td { border: 1px solid #e5e7eb; padding: 6px; }
        .loading { text-align: center; padding: 20px; color: #6b7280; }
      `}</style>
    </div>
  );
}
