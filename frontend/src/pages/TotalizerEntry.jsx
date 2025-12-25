// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";

// HeroIcons (approved)
import { ChartBarIcon, FireIcon, CloudIcon, BoltIcon, FunnelIcon } from "@heroicons/react/24/solid";

/**
 * TotalizerEntryPage — Compact STYLE 2 (white / grey / orange theme)
 *
 * Backend endpoints expected:
 *  GET  /totalizers/{unit}/master
 *  GET  /totalizers/{unit}/readings?date=YYYY-MM-DD
 *  GET  /kpi/manual?date=YYYY-MM-DD&unit=Unit-1
 *  GET  /kpi/energy?date=YYYY-MM-DD
 *  GET  /kpi/shutdown/{unit}?date=YYYY-MM-DD
 *  POST /kpi/calc
 *  POST /totalizers/submit
 *
 * Behavior highlights:
 * - Left: stylish KPI cards (compact) — grouped and with icons.
 * - Right: compact totalizer entry table grouped to related KPIs.
 * - When a totalizer is edited, related KPI cards pulse (highlight).
 * - Submit flow: show changed inputs in confirmation popup -> Preview KPIs (calls /kpi/calc) -> Confirm & Save (calls /totalizers/submit).
 */

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

const getTokenPayload = (authHeader) => {
  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

const Spinner = ({ size = 14 }) => (
  <div style={{ width: size, height: size }} className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current" />
);

/* ---------------- KPI dependency map (which totalizer impacts which KPIs) ----------------
   Add mapping entries for additional totalizer names as necessary.
*/
const KPI_DEPENDENCY_MAP = {
  feeder_a: ["coal_consumption", "specific_coal"],
  feeder_b: ["coal_consumption", "specific_coal"],
  feeder_c: ["coal_consumption", "specific_coal"],
  feeder_d: ["coal_consumption", "specific_coal"],
  feeder_e: ["coal_consumption", "specific_coal"],
  ldo_flow: ["oil_consumption", "specific_oil"],
  dm7: ["dm_water", "specific_dm_percent"],
  dm11: ["dm_water", "specific_dm_percent"],
  main_steam: ["steam_consumption", "specific_steam"],
  raw_water: ["total_raw_water_used_m3", "avg_raw_water_m3_per_hr", "sp_raw_water_l_per_kwh"],
  unit1_gen: ["unit1_generation", "unit1_plf_percent", "station_plf_percent"],
  unit2_gen: ["unit2_generation", "unit2_plf_percent", "station_plf_percent"],
  // add more mappings if you have more totalizer master names
};




/* ================= HARDCODED TOTALIZER MASTER ================= */

const TOTALIZER_MASTER = {
  "Unit-1": [
    { id: 1,  name: "feeder_a",    display_name: "Feeder1A Totalizer", unit: "Unit-1", seq: 1 },
    { id: 2,  name: "feeder_b",    display_name: "Feeder1B Totalizer", unit: "Unit-1", seq: 2 },
    { id: 3,  name: "feeder_c",    display_name: "Feeder1C Totalizer", unit: "Unit-1", seq: 3 },
    { id: 4,  name: "feeder_d",    display_name: "Feeder1D Totalizer", unit: "Unit-1", seq: 4 },
    { id: 5,  name: "feeder_e",    display_name: "Feeder1E Totalizer", unit: "Unit-1", seq: 5 },
    { id: 6,  name: "ldo_flow",    display_name: "Unit-1 : LDO FLOW", unit: "Unit-1", seq: 6 },
    { id: 7,  name: "dm7",         display_name: "Unit-1 : DM7 Water", unit: "Unit-1", seq: 7 },
    { id: 8,  name: "dm11",        display_name: "Unit-1 : DM11 Water", unit: "Unit-1", seq: 8 },
    { id: 9,  name: "main_steam",  display_name: "Unit-1 : Main Steam Used", unit: "Unit-1", seq: 9 },
    { id: 10, name: "feed_water",  display_name: "Unit-1 : Feed Water Totalizer", unit: "Unit-1", seq: 10 },
  ],

  "Unit-2": [
    { id: 11, name: "feeder_a",    display_name: "Feeder2A Totalizer", unit: "Unit-2", seq: 1 },
    { id: 12, name: "feeder_b",    display_name: "Feeder2B Totalizer", unit: "Unit-2", seq: 2 },
    { id: 13, name: "feeder_c",    display_name: "Feeder2C Totalizer", unit: "Unit-2", seq: 3 },
    { id: 14, name: "feeder_d",    display_name: "Feeder2D Totalizer", unit: "Unit-2", seq: 4 },
    { id: 15, name: "feeder_e",    display_name: "Feeder2E Totalizer", unit: "Unit-2", seq: 5 },
    { id: 16, name: "ldo_flow",    display_name: "Unit-2 : LDO FLOW", unit: "Unit-2", seq: 6 },
    { id: 17, name: "dm7",         display_name: "Unit-2 : DM7 Water", unit: "Unit-2", seq: 7 },
    { id: 18, name: "dm11",        display_name: "Unit-2 : DM11 Water", unit: "Unit-2", seq: 8 },
    { id: 19, name: "main_steam",  display_name: "Unit-2 : Main Steam Used", unit: "Unit-2", seq: 9 },
    { id: 20, name: "feed_water",  display_name: "Unit-2 : Feed Water Totalizer", unit: "Unit-2", seq: 10 },
  ],

  "Station": [
    { id: 21, name: "raw_water", display_name: "Station : Raw Water Totalizer", unit: "Station", seq: 1 },
  ],

  "Energy-Meter": [
    { id: 22, name: "unit1_gen", display_name: "Unit-1 Generation", seq: 1 },
    { id: 23, name: "unit2_gen", display_name: "Unit-2 Generation", seq: 2 },
    { id: 24, name: "1lsr01_ic1", display_name: "1LSR01 I/C-1", seq: 3 },
    { id: 25, name: "1lsr02_ic1", display_name: "1LSR02 I/C-1", seq: 4 },
    { id: 26, name: "2lsr01_ic1", display_name: "2LSR01 I/C-1", seq: 5 },
    { id: 27, name: "2lsr02_ic1", display_name: "2LSR02 I/C-1", seq: 6 },
    { id: 28, name: "rlsr01", display_name: "RLSR01", seq: 7 },
    { id: 29, name: "rlsr02", display_name: "RLSR02", seq: 8 },
    { id: 30, name: "rlsr03", display_name: "RLSR03", seq: 9 },
    { id: 31, name: "rlsr04", display_name: "RLSR04", seq: 10 },
    { id: 32, name: "1lsr01_ic2_tie", display_name: "1LSR01 I/C-2 (TIE)", seq: 11 },
    { id: 33, name: "1lsr02_ic2_tie", display_name: "1LSR02 I/C-2 (TIE)", seq: 12 },
    { id: 34, name: "2lsr01_ic2_tie", display_name: "2LSR01 I/C-2 (TIE)", seq: 13 },
    { id: 35, name: "2lsr02_ic2_tie", display_name: "2LSR02 I/C-2 (TIE)", seq: 14 },
    { id: 36, name: "SST_10", display_name: "SST_10", seq: 15 },
    { id: 37, name: "UST_15", display_name: "UST_15", seq: 16 },
    { id: 38, name: "UST_25", display_name: "UST-25", seq: 17 },
  ],
};




export default function TotalizerEntryPage({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      }),
    [authHeader]
  );

  /* ---------------- state ---------------- */
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [roleId, setRoleId] = useState(null);
  const [userName, setUserName] = useState("Unknown");
  const isAdmin = roleId === 8;
  const isHOD = roleId === 7;
  const canAdjust = isAdmin || isHOD;

  const [permissionMap, setPermissionMap] = useState({});
  const canView = (field) => permissionMap[field]?.can_view ?? true;
  const canEdit = (field) => permissionMap[field]?.can_edit ?? true;

  const [totalizersByUnit] = useState(() => {
  const init = {};
  Object.entries(TOTALIZER_MASTER).forEach(([unit, list]) => {
    init[unit] = [...list].sort((a, b) => a.seq - b.seq);
  });
  return init;
});

  const [readingsForm, setReadingsForm] = useState({}); // keyed by master.id
  useEffect(() => {
  const init = {};
  Object.values(TOTALIZER_MASTER).flat().forEach(t => {
    init[t.id] = {
      today: "",
      adjust: 0,
      yesterday: "—",
      difference: "—",
      display_name: t.display_name,
      name: t.name,
      unit: t.unit || "",
      totalizer_id: t.id,
      _orig: { today: "", adjust: 0 },
    };
  });
  setReadingsForm(init);
}, []);
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState(null);

  const [serverKPIs, setServerKPIs] = useState({ "Unit-1": null, "Unit-2": null, Station: null });
  const [energyCache, setEnergyCache] = useState({});
  const [shutdownKPIs, setShutdownKPIs] = useState({
    "Unit-1": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
    "Unit-2": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
  });

  // Highlight state for KPI cards { kpiName: true }
  const [highlightedKPIs, setHighlightedKPIs] = useState({});

  // Confirmation / preview state
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);
  const [previewAutoKPIs, setPreviewAutoKPIs] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Adjust popup
  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null);

  // Manual KPI state and metadata
  const initialManualKPI = {
    "Unit-1": { stack_emission: "" , Approx_COP: "Rs" , },
    "Unit-2": { stack_emission: "", Approx_COP: "Rs" , },
    Station: {
      clarifier_level: "",
      ro_running_hour: "",
      ro_production_cum: "",
      stn_net_export_exbus: "",
      coal_indonesian_percent: "",
      coal_southafrica_percent: "",
      coal_domestic_percent: "",
    },
    "Energy-Meter": {},
  };
  const [manualKPI, setManualKPI] = useState(JSON.parse(JSON.stringify(initialManualKPI)));
  const manualUnits = {
    "Unit-1": { stack_emission: "mg/Nm3", Approx_COP: "Rs" ,},
    "Unit-2": { stack_emission: "mg/Nm3" , Approx_COP: "Rs" ,},
    Station: {
      clarifier_level: "%",
      ro_running_hour: "hr",
      ro_production_cum: "m3",
      stn_net_export_exbus: "MWh",
      coal_indonesian_percent: "%",
      coal_southafrica_percent: "%",
      coal_domestic_percent: "%",
    },
    "Energy-Meter": {},
  };

  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  /* ---------------- auth & permissions ---------------- */
  useEffect(() => {
    const payload = getTokenPayload(authHeader);
    if (payload) {
      setRoleId(payload.role_id);
      setUserName(payload.full_name || payload.sub || "User");
    } else {
      api.get("/auth/me").then((r) => {
        if (r.data?.role_id) setRoleId(r.data.role_id);
        if (r.data?.full_name) setUserName(r.data.full_name);
      }).catch(() => {});
    }
  }, [api, authHeader]);

  useEffect(() => {
    async function loadPerm() {
      try {
        const r = await api.get("/permissions/me");
        const pmap = {};
        (r.data || []).forEach((p) => {
          pmap[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view };
        });
        setPermissionMap(pmap);
      } catch (e) {
        // ignore permission errors
      }
    }
    loadPerm();
  }, [api]);

  /* ---------------- master + readings load ---------------- */

  

  

  const loadTodayReadings = useCallback(async (forDate, unit, itemsParam = null) => {
    try {
      const res = await api.get(`/totalizers/${encodeURIComponent(unit)}/readings`, { params: { date: forDate } });
      const rows = res.data || [];
      const rowMap = {};
      let lastUpdate = null;
      rows.forEach((r) => {
        rowMap[r.totalizer_id] = { today: Number(r.reading_value || 0), adjust: Number(r.adjust_value || 0) };
        if (!lastUpdate && r.updated_at) lastUpdate = { at: r.updated_at, by: r.username || "Unknown" };
      });
      setLastUpdatedInfo(lastUpdate);

      setReadingsForm((prev) => {
        const updated = { ...prev };
        const items = itemsParam || (totalizersByUnit[unit] || []);
        items.forEach((t) => {
          const rec = updated[t.id] || {
            today: "", adjust: 0, yesterday: "—", difference: "—", display_name: t.display_name, name: t.name, unit: t.unit || unit, totalizer_id: t.id, _orig: { today: "", adjust: 0 }
          };
          if (rowMap[t.id] !== undefined) {
            rec.today = rowMap[t.id].today;
            rec.adjust = rowMap[t.id].adjust;
            rec._orig = { today: rec.today, adjust: rec.adjust };
          } else {
  rec.today = "";
  rec.adjust = 0;                 // ✅ reset adjustment for new date
  rec._orig = { today: "", adjust: 0 };
}
          if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
          updated[t.id] = { ...rec };
        });
        return updated;
      });
    } catch (e) {
      console.error("loadTodayReadings error:", e);
    }
  }, [api, totalizersByUnit]);

  const loadYesterdayReadings = useCallback(async (forDate, unit, itemsParam = null) => {
    try {
      const d = new Date(forDate);
      d.setDate(d.getDate() - 1);
      const y = d.toLocaleDateString("en-CA");
      const res = await api.get(`/totalizers/${encodeURIComponent(unit)}/readings`, { params: { date: y } });
      const rows = res.data || [];
      const rowMap = {};
      rows.forEach((r) => { rowMap[r.totalizer_id] = Number(r.reading_value || 0); });

      setReadingsForm((prev) => {
        const updated = { ...prev };
        const items = itemsParam || (totalizersByUnit[unit] || []);
        items.forEach((t) => {
          const rec = updated[t.id];
          if (!rec) return;
          rec.yesterday = rowMap[t.id] !== undefined ? rowMap[t.id] : "—";
          if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
          else {
            const adj = canAdjust ? Number(rec.adjust || 0) : 0;
            rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
          }
          updated[t.id] = { ...rec };
        });
        return updated;
      });
    } catch (e) {
      setReadingsForm((prev) => {
        const updated = { ...prev };
        const items = itemsParam || (totalizersByUnit[unit] || []);
        items.forEach((t) => {
          if (!updated[t.id]) return;
          updated[t.id].yesterday = "—";
          updated[t.id].difference = "—";
        });
        return updated;
      });
    }
  }, [api, totalizersByUnit, canAdjust]);

  /* ---------------- energy cache loader ---------------- */
  const loadEnergyCacheForDate = useCallback(async (dateStr) => {
    if (energyCache[dateStr]) return energyCache[dateStr];
    try {
      const r = await api.get("/kpi/energy", { params: { date: dateStr } });
      let out = {};
      if (Array.isArray(r.data?.kpis)) {
        r.data.kpis.forEach(k => { out[k.name] = Number(k.value || 0); });
      } else if (typeof r.data === "object" && r.data !== null) {
        out = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, Number(v || 0)]));
      }
      setEnergyCache((prev) => ({ ...prev, [dateStr]: out }));
      return out;
    } catch (e) {
      setEnergyCache((prev) => ({ ...prev, [dateStr]: {} }));
      return {};
    }
  }, [api, energyCache]);

  /* ---------------- build readings payload ---------------- */
  const buildReadingsArrayForUnit = useCallback((unit) => {
    const items = totalizersByUnit[unit] || [];
    return items.map((t) => {
      const rec = readingsForm[t.id] || { today: "", adjust: 0 };
      return {
        totalizer_id: t.id,
        reading_value: rec.today === "" ? null : Number(rec.today),
        adjust_value: canAdjust ? Number(rec.adjust || 0) : 0,
      };
    }).filter(Boolean);
  }, [readingsForm, totalizersByUnit, canAdjust]);

  /* ---------------- KPI Calculation (on demand) ---------------- */
  const calculateKPIsForUnit = useCallback(async (unit = null) => {
    const plant = unit || activeTab;
    setLoading(true);
    setMessage("");
    try {
      await loadEnergyCacheForDate(reportDate);
      const readings = buildReadingsArrayForUnit(plant);
      const payload = { date: reportDate, plant_name: plant, readings };
      const r = await api.post("/kpi/calc", payload);
      const out = r.data?.auto_kpis || null;
      if (plant === "Unit-1" || plant === "Unit-2" || plant === "Station") {
        setServerKPIs((prev) => ({ ...prev, [plant]: out }));
      }
      setMessage("✅ KPI calculation completed.");
      return out;
    } catch (e) {
      console.error("calculateKPIsForUnit error:", e);
      setMessage("❌ KPI calculation failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, activeTab, reportDate, buildReadingsArrayForUnit, loadEnergyCacheForDate]);

  /* ---------------- Shutdown KPI loader ---------------- */
  const loadShutdownKPIsForUnitDate = useCallback(async (unitKey, dateStr) => {
    try {
      const res = await api.get(`/kpi/shutdown/${encodeURIComponent(unitKey)}`, { params: { date: dateStr } });
      if (res.status === 200 && res.data) {
        setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { ...prev[unitKey], ...res.data } }));
      } else {
        setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { running_hour: 24, plant_availability_percent: 100, planned_outage_hour: 0, planned_outage_percent: 0, strategic_outage_hour: 0 } }));
      }
    } catch {
      setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { running_hour: 24, plant_availability_percent: 100, planned_outage_hour: 0, planned_outage_percent: 0, strategic_outage_hour: 0 } }));
    }
  }, [api]);

  /* ---------------- helpers to update fields ----------------- */
  const updateField = (id, field, value) => {
    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      // preserve name for KPI mapping usage
      const name = rec.name;
      rec[field] = value === "" ? "" : Number(value);

      if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
      else {
        const adj = canAdjust ? Number(rec.adjust || 0) : 0;
        rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
      }

      // highlight KPIs impacted by this totalizer (if any)
      const impacted = KPI_DEPENDENCY_MAP[name] || [];
      if (impacted.length > 0) {
        const newState = {};
        impacted.forEach(k => newState[k] = true);
        setHighlightedKPIs(newState);
        // fade
        setTimeout(() => setHighlightedKPIs({}), 1400);
      }

      return { ...prev, [id]: rec };
    });
  };

  const updateManualField = (unit, field, value) => {
    setManualKPI((prev) => ({
      ...prev,
      [unit]: { ...prev[unit], [field]: value === "" ? "" : parseFloat(value)
 },
    }));
  };

  const getDiff = (name, unitFilter = null) => {
    const unitToUse = unitFilter || activeTab;
    const rec = Object.values(readingsForm).find((r) => r.name === name && (r.unit || "").toString() === unitToUse);
    if (!rec) return 0;
    if (!rec.difference || rec.difference === "—") return 0;
    return Number(rec.difference) || 0;
  };

  /* ---------------- Local KPI computations (unchanged) ---------------- */
  const localUnitKPI = useMemo(() => {
    if (!(activeTab === "Unit-1" || activeTab === "Unit-2")) return null;
    try {
      const feederA = getDiff("feeder_a", activeTab);
      const feederB = getDiff("feeder_b", activeTab);
      const feederC = getDiff("feeder_c", activeTab);
      const feederD = getDiff("feeder_d", activeTab);
      const feederE = getDiff("feeder_e", activeTab);
      const coal = feederA + feederB + feederC + feederD + feederE;
      const ldo = getDiff("ldo_flow", activeTab);
      const dm = getDiff("dm7", activeTab) + getDiff("dm11", activeTab);
      const steam = getDiff("main_steam", activeTab);
      return { coal, ldo, dm, steam };
    } catch {
      return { coal: 0, ldo: 0, dm: 0, steam: 0 };
    }
  }, [readingsForm, activeTab]);

  const localStationKPI = useMemo(() => {
    if (activeTab !== "Station") return null;
    try {
      const total_raw_water = getDiff("raw_water", "Station");
      const avg_raw_per_hr = Number((total_raw_water / 24.0).toFixed(3));
      const u1_dm = getDiff("dm7", "Unit-1") + getDiff("dm11", "Unit-1");
      const u2_dm = getDiff("dm7", "Unit-2") + getDiff("dm11", "Unit-2");
      const total_dm = Number((u1_dm + u2_dm).toFixed(3));
      return { total_raw_water, avg_raw_per_hr, total_dm };
    } catch {
      return { total_raw_water: 0, avg_raw_per_hr: 0, total_dm: 0 };
    }
  }, [readingsForm, activeTab]);

  /* ================= ENERGY LIVE KPI (FIXED) ================= */
/* ❗ DO NOT FILTER BY UNIT – ENERGY TOTALIZERS HAVE NO UNIT FIELD */

const liveEnergyKPI = useMemo(() => {
  const d = (name) => {
    const rec = Object.values(readingsForm).find(
      (r) => r.name === name
    );
    if (!rec || rec.difference === "—" || rec.difference === null) return 0;
    return Number(rec.difference) || 0;
  };

  try {
    const unit1_unit_aux_mwh =
      d("1lsr01_ic1") +
      d("1lsr02_ic1") +
      d("1lsr01_ic2_tie") -
      d("SST_10") -
      d("UST_15");

    const unit2_unit_aux_mwh =
      d("2lsr01_ic1") +
      d("2lsr02_ic1") +
      d("2lsr01_ic2_tie") -
      d("UST_25");

    const total_station_aux_mwh =
      d("rlsr01") +
      d("rlsr02") +
      d("rlsr03") +
      d("rlsr04") -
      d("1lsr01_ic2_tie") -
      d("1lsr02_ic2_tie") -
      d("2lsr01_ic2_tie") -
      d("2lsr02_ic2_tie") +
      d("SST_10") +
      d("UST_15") +
      d("UST_25");

    const total_station_tie_mwh =
      d("1lsr01_ic2_tie") +
      d("1lsr02_ic2_tie") +
      d("2lsr01_ic2_tie") +
      d("2lsr02_ic2_tie");

    const unit1_gen = d("unit1_gen");
    const unit2_gen = d("unit2_gen");

    const unit1_aux_consumption_mwh =
      unit1_unit_aux_mwh + total_station_aux_mwh / 2;

    const unit2_aux_consumption_mwh =
      unit2_unit_aux_mwh + total_station_aux_mwh / 2;

    return {
      unit1_generation: unit1_gen,
      unit2_generation: unit2_gen,

      unit1_unit_aux_mwh: Number(unit1_unit_aux_mwh.toFixed(3)),
      unit2_unit_aux_mwh: Number(unit2_unit_aux_mwh.toFixed(3)),

      total_station_aux_mwh: Number(total_station_aux_mwh.toFixed(3)),
      total_station_tie_mwh: Number(total_station_tie_mwh.toFixed(3)),

      unit1_aux_consumption_mwh: Number(unit1_aux_consumption_mwh.toFixed(3)),
      unit2_aux_consumption_mwh: Number(unit2_aux_consumption_mwh.toFixed(3)),

      unit1_aux_percent:
        unit1_gen > 0
          ? Number(((unit1_aux_consumption_mwh / unit1_gen) * 100).toFixed(3))
          : 0,

      unit2_aux_percent:
        unit2_gen > 0
          ? Number(((unit2_aux_consumption_mwh / unit2_gen) * 100).toFixed(3))
          : 0,

      unit1_plf_percent:
        unit1_gen > 0 ? Number(((unit1_gen / 3000) * 100).toFixed(3)) : 0,

      unit2_plf_percent:
        unit2_gen > 0 ? Number(((unit2_gen / 3000) * 100).toFixed(3)) : 0,

      station_plf_percent:
        unit1_gen + unit2_gen > 0
          ? Number((((unit1_gen + unit2_gen) / 3000) * 100).toFixed(3))
          : 0,
    };
  } catch {
    return {};
  }
}, [readingsForm]);

  /* ---------------- Submit flow ---------------- */

  const getChangedList = (unit) => {
    const list = [];
    const items = totalizersByUnit[unit] || [];
    items.forEach((t) => {
      const rec = readingsForm[t.id];
      if (!rec) return;
      const orig = rec._orig || { today: "", adjust: 0 };
      if (String(rec.today) !== String(orig.today) && rec.today !== "") {
        list.push({ label: rec.display_name, value: rec.today, old: orig.today ?? "", id: t.id });
      } else if (canAdjust && String(rec.adjust) !== String(orig.adjust)) {
        list.push({ label: rec.display_name + " (Adj)", value: rec.adjust, old: orig.adjust ?? 0, id: t.id });
      }
    });
    return list;
  };

  const handleSubmitClick = () => {
    const changed = getChangedList(activeTab);
    if (changed.length === 0 && !hasManualKPIChange()) {
      setMessage("❌ No changes.");
      return;
    }

    // non-admin can't modify existing values
    if (!isAdmin && !isHOD) {
      for (const ch of changed) {
        const rec = readingsForm[ch.id];
        if (rec._orig.today !== "") {
          setMessage(`❌ Only Admin/HOD can modify existing values (${ch.label})`);
          return;
        }
      }
    }

    setConfirmList(changed);
    setPreviewAutoKPIs(null); // reset preview
    setShowConfirmPopup(true);
  };

  const hasManualKPIChange = () => {
    const currentManuals = manualKPI[activeTab] || {};
    return Object.values(currentManuals).some((v) => v !== "" && v !== null && v !== undefined);
  };

  // Confirm submit will actually save after preview or directly if user confirms
  const confirmSubmit = async () => {
    setShowConfirmPopup(false);
    setSubmitting(true);
    setMessage("");

    try {
      const items = totalizersByUnit[activeTab] || [];

      const payload = {
        date: reportDate,
        username: userName,
        plant_name: activeTab,
        readings: items
          .map((t) => {
            const rec = readingsForm[t.id];
            if (!rec || rec.today === "" || rec.today === null) return null;
            return {
              totalizer_id: t.id,
              reading_value: Number(rec.today),
              adjust_value: canAdjust ? Number(rec.adjust || 0) : 0,
            };
          })
          .filter(Boolean),
        manual_kpis: Object.entries(manualKPI[activeTab] || {}).map(([name, val]) => ({
          name,
          value: val === "" || val === null || val === undefined ? null : Number(val),
          unit: manualUnits[activeTab]?.[name] || null,
        })).filter(m => m.value !== null),
      };

      // submit to backend
      // 1️⃣ Submit totalizers ONLY
await api.post("/totalizers/submit", {
  date: reportDate,
  plant_name: activeTab,
  readings: payload.readings
});

// 2️⃣ Submit manual KPIs separately (if any)
const manualList = Object.entries(manualKPI[activeTab] || {})
  .map(([name, value]) => ({
    name,
    value,
    unit: manualUnits[activeTab]?.[name]
  }))
  .filter(m => m.value !== "" && m.value !== null && m.value !== undefined);

if (manualList.length > 0) {
  await api.post("/kpi/manual", {
    date: reportDate,
    plant_name: activeTab,
    kpis: manualList
  });
}


      // update local _orig to current values
      setReadingsForm((prev) => {
        const updated = { ...prev };
        items.forEach((t) => {
          const rec = updated[t.id];
          if (rec) rec._orig = { today: rec.today, adjust: rec.adjust };
        });
        return updated;
      });

      setLastUpdatedInfo({ at: new Date().toISOString(), by: userName });
      setMessage("✅ Readings saved");

      // reload yesterday, manual KPIs and shutdown and server KPIs for active tab.
      await loadYesterdayReadings(reportDate, activeTab, totalizersByUnit[activeTab]);
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        await loadShutdownKPIsForUnitDate(activeTab, reportDate);
      }

      // refresh server KPIs for the active tab (final)
      await calculateKPIsForUnit(activeTab);
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err?.response?.data?.detail || "Save error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Reset / Seed ---------------- */

  const handleResetForm = () => {
    const items = totalizersByUnit[activeTab] || [];
    setReadingsForm((prev) => {
      const updated = { ...prev };
      items.forEach((t) => {
        if (!updated[t.id]) return;
        updated[t.id].today = updated[t.id]._orig?.today ?? "";
        updated[t.id].adjust = updated[t.id]._orig?.adjust ?? 0;
        if (updated[t.id].yesterday === "—" || updated[t.id].today === "" || updated[t.id].today === null) updated[t.id].difference = "—";
        else {
          const adj = canAdjust ? Number(updated[t.id].adjust || 0) : 0;
          updated[t.id].difference = Number(updated[t.id].today - updated[t.id].yesterday + adj).toFixed(3);
        }
      });
      return updated;
    });

    // reset manual KPI values to initial or last loaded
   setManualKPI(prev => ({
  ...prev,
  [activeTab]: { ...(initialManualKPI[activeTab] || {}) }
}));

    setMessage("⚠️ Inputs reset.");
  };

  const handleSeedMaster = async () => {
    setMessage("Loading previous day's closing readings...");
    setLoading(true);
    try {
      const d = new Date(reportDate);
      d.setDate(d.getDate() - 1);
      const y = d.toLocaleDateString("en-CA");
      const res = await api.get(`/totalizers/${encodeURIComponent(activeTab)}/readings`, { params: { date: y } });
      const rows = res.data || [];
      const rowMap = {};
      rows.forEach((r) => { rowMap[r.totalizer_id] = Number(r.reading_value || 0); });

      setReadingsForm((prev) => {
        const updated = { ...prev };
        (totalizersByUnit[activeTab] || []).forEach((t) => {
          const rec = updated[t.id];
          if (!rec) return;
          const prevValue = rowMap[t.id];
          if (prevValue !== undefined && rec._orig.today === "") {
            updated[t.id].today = prevValue;
            updated[t.id].adjust = rec._orig.adjust ?? 0;
            const adj = canAdjust ? Number(updated[t.id].adjust || 0) : 0;
            updated[t.id].difference = Number(updated[t.id].today - (rec.yesterday === "—" ? 0 : rec.yesterday) + adj).toFixed(3);
          }
        });
        return updated;
      });

      setMessage("ℹ️ Readings seeded from previous day.");
    } catch (e) {
      console.error(e);
      setMessage("❌ Failed to seed readings.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Adjust popup ---------------- */

  const handleAdjustClick = (record) => {
    setAdjustPopupRecord(record);
    setShowAdjustPopup(true);
  };

  const saveAdjust = () => {
    if (!adjustPopupRecord) return;
    const { id, adjust } = adjustPopupRecord;
    updateField(id, "adjust", adjust);
    setShowAdjustPopup(false);
    setAdjustPopupRecord(null);
  };

  /* ---------------- Manual KPI loader ---------------- */

  const loadManualKPIForActiveTab = useCallback(async () => {
  try {
    const r = await api.get("/kpi/manual", {
      params: { date: reportDate, unit: activeTab },
    });

    const fetched = {};
    (r.data?.kpis || []).forEach((k) => {
      const name = k.kpi_name || k.kpi;
      const value = k.kpi_value ?? k.value;
      if (name) fetched[name] = value;
    });

    setManualKPI((prev) => ({
      ...prev,
      [activeTab]: {
        ...(initialManualKPI[activeTab] || {}),
        ...fetched,
      },
    }));
  } catch {
    setManualKPI((prev) => ({
      ...prev,
      [activeTab]: { ...(initialManualKPI[activeTab] || {}) },
    }));
  }
}, [api, activeTab, reportDate]);


  const loadSavedEnergyKPIs = useCallback(async () => {
  try {
    const r = await api.get("/kpi/auto", {
      params: { date: reportDate, unit: "Station" }
    });

    const out = {};
    (r.data?.kpis || []).forEach(k => {
      out[k.kpi_name] = Number(k.kpi_value || 0);
    });

    setServerKPIs(prev => ({ ...prev, "Energy-Meter": out }));
  } catch (e) {
    console.error("Energy KPI load failed", e);
  }
}, [api, reportDate]);

useEffect(() => {
  if (activeTab === "Energy-Meter") {
    loadSavedEnergyKPIs();
  }
}, [activeTab, reportDate]);

  /* ---------------- KPI panel helpers & rendering ---------------- */

  const renderKpiValue = (k) => {
    // prefer local simple calculations for immediacy
    if ((activeTab === "Unit-1" || activeTab === "Unit-2") && localUnitKPI) {
      const map = {
        coal_consumption: localUnitKPI.coal,
        oil_consumption: localUnitKPI.ldo,
        dm_water: localUnitKPI.dm,
        steam_consumption: localUnitKPI.steam,
      };
      if (map[k] !== undefined) return map[k];
    }
    if (activeTab === "Station" && localStationKPI) {
      const map = {
        total_raw_water_used_m3: localStationKPI.total_raw_water,
        avg_raw_water_m3_per_hr: localStationKPI.avg_raw_per_hr,
        total_dm_water_used_m3: localStationKPI.total_dm,
      };
      if (map[k] !== undefined) return map[k];
    }
    const s = serverKPIs[activeTab] || {};
    if (s && s[k] !== undefined && s[k] !== null) return s[k];
    if (activeTab === "Energy-Meter") {
      const ek = liveEnergyKPI || {};
      if (ek[k] !== undefined) return ek[k];
    }
    return null;
  };

  // KPI card component
  const KpiCard = ({ k, label, value, unit = "", Icon = ChartBarIcon }) => {
  const isHighlighted = !!highlightedKPIs[k];

  return (
    <div
      className={`
        flex items-center
        h-8
        px-2
        border-l-[4px]
        border
        transition-all duration-150
        ${
          isHighlighted
            ? `
              border-orange-600
              bg-orange-200
              shadow-[0_1px_3px_rgba(0,0,0,0.35)]
            `
            : `
             border-orange-600
              bg-white
              hover:bg-zinc-200
            `
        }
      `}
    >
      {/* ICON */}
      <div
        className="
          w-4 h-4
          flex items-center justify-center
          rounded
          bg-zinc-300
          text-orange-700
          mr-2
        "
      >
        <Icon className="w-3 h-3" />
      </div>

      {/* LABEL */}
      <div className="flex-1 text-[10px] text-zinc-950 truncate font-extrabold">
        {label}
      </div>

      {/* VALUE */}
      <div className="ml-2 flex items-baseline gap-1 font-mono">
        <span
          className={`
            text-[12px] font-black
            ${
              typeof value === "number" && value < 0
                ? "text-red-800"
                : "text-zinc-950"
            }
          `}
        >
          {value === null || value === undefined
            ? "—"
            : typeof value === "number"
              ? value.toFixed(3)
              : value}
        </span>

        {unit && (
          <span className="text-[9px] text-orange-800 font-extrabold tracking-wide">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};






 const renderLeftKPIList = () => {
    // Compose KPI cards compactly — grouped and arranged
    if (activeTab === "Unit-1" || activeTab === "Unit-2") {
      const s = serverKPIs[activeTab] || {};
      const local = localUnitKPI || { coal: 0, ldo: 0, dm: 0, steam: 0 };
      const sKPI = shutdownKPIs[activeTab] || {};
      return (
        <div className="space-y-3">
          
          <KpiCard k="daily_generation" label="Daily Generation" value={(activeTab === "Unit-1" ? (s?.unit1_generation ?? null) : (s?.unit2_generation ?? null)) ?? null} unit="MWh" Icon={ChartBarIcon} />
          <KpiCard k="plf" label="PLF" value={(activeTab === "Unit-1" ? s?.unit1_plf_percent : s?.unit2_plf_percent) ?? null} unit="%" Icon={ChartBarIcon} />
          <KpiCard k="running_hour" label="Running Hour" value={sKPI.running_hour !== null ? Number(sKPI.running_hour) : null} unit="hr" Icon={BoltIcon} />

          <div className="text-xs font-semibold text-gray-700 mt-3">Fuel & Utilities</div>
          <KpiCard k="coal_consumption" label="Coal Cons." value={renderKpiValue("coal_consumption") ?? local.coal} unit="ton" Icon={FireIcon} />
          <KpiCard k="specific_coal" label="Specific Coal" value={renderKpiValue("specific_coal") ?? null} unit="ton/MWh" Icon={ChartBarIcon} />
          <KpiCard k="oil_consumption" label="LDO Cons." value={renderKpiValue("oil_consumption") ?? local.ldo} unit="L" Icon={FunnelIcon} />
          <KpiCard k="specific_oil" label="LDO Cons." value={renderKpiValue("specific_oil") ?? local.ldo} unit="L" Icon={FunnelIcon} />
          <KpiCard k="dm_water" label="DM Water" value={renderKpiValue("dm_water") ?? local.dm} unit="m3" Icon={CloudIcon} />
          <KpiCard k="steam_consumption" label="Steam Cons." value={renderKpiValue("steam_consumption") ?? local.steam} unit="kg" Icon={BoltIcon} />
        </div>
      );
    }

    if (activeTab === "Station") {
      const s = serverKPIs["Station"] || {};
      const local = localStationKPI || { total_raw_water: 0, avg_raw_per_hr: 0, total_dm: 0 };
      return (
        <div className="space-y-3">
          
          <KpiCard k="station_plf_percent" label="Station PLF" value={s?.station_plf_percent ?? (((Number(s?.unit1_generation || 0) + Number(s?.unit2_generation || 0)) > 0) ? (((Number(s.unit1_generation || 0) + Number(s.unit2_generation || 0)) / 3000) * 100) : null)} unit="%" Icon={ChartBarIcon} />
          <KpiCard k="total_raw_water_used_m3" label="Total Raw Water" value={renderKpiValue("total_raw_water_used_m3") ?? local.total_raw_water} unit="m3" Icon={CloudIcon} />
          <KpiCard k="avg_raw_water_m3_per_hr" label="Avg Raw Water/hr" value={renderKpiValue("avg_raw_water_m3_per_hr") ?? local.avg_raw_per_hr} unit="m3/hr" Icon={CloudIcon} />
          <KpiCard k="total_dm_water_used_m3" label="Total DM Water" value={renderKpiValue("total_dm_water_used_m3") ?? local.total_dm} unit="m3" Icon={CloudIcon} />
        </div>
      );
    }

    if (activeTab === "Energy-Meter") {
      const ek = liveEnergyKPI || {};
      return (
        <div className="space-y-3">
          
          <KpiCard k="unit1_generation" label="U1 Gen" value={ek.unit1_generation ?? 0} unit="MWh" Icon={ChartBarIcon} />
          <KpiCard k="unit1_plf_percent" label="U1 PLF" value={ek.unit1_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />

          <KpiCard k="unit2_generation" label="U2 Gen" value={ek.unit2_generation ?? 0} unit="MWh" Icon={ChartBarIcon} />
          <KpiCard k="unit2_plf_percent" label="U2 PLF" value={ek.unit2_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />

          <KpiCard k="unit1_aux_consumption_mwh" label="U1 Aux Consumption" value={ek.unit1_aux_consumption_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />
          <KpiCard k="unit2_aux_consumption_mwh" label="U2 Aux Consumption" value={ek.unit2_aux_consumption_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />

          <KpiCard k="unit1_aux_percent" label="U1 Aux %" value={ek.unit1_aux_percent ?? 0} unit="%" Icon={BoltIcon} />
          <KpiCard k="unit2_aux_percent" label="U2 Aux %" value={ek.unit2_aux_percent ?? 0} unit="%" Icon={BoltIcon} />

          <KpiCard k="unit1_unit_aux_mwh" label="U1 UAT CONS" value={ek.unit1_unit_aux_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />
          <KpiCard k="unit2_unit_aux_mwh" label="U2 UAT CONS" value={ek.unit2_unit_aux_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />

          <KpiCard k="total_station_aux_mwh" label="Station Aux" value={ek.total_station_aux_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />
          <KpiCard k="total_station_tie_mwh" label="Station Tie" value={ek.total_station_tie_mwh ?? 0} unit="Mwh" Icon={BoltIcon} />

          <KpiCard k="station_plf_percent" label="Station PLF" value={ek.station_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />
        </div>
      );
    }

    return null;
  };



  /* ---------------- Table render ---------------- */

  const currentTotalizers = totalizersByUnit[activeTab] || [];

  const renderTotalizerTable = () => (
  <div
    className="
      max-h-[65vh] overflow-auto
      relative
      bg-white/80
      backdrop-blur-sm
      border border-zinc-300
      ring-1 ring-white/60
      
    "
  >
    <table className="min-w-full table-fixed border-collapse">

      {/* ================= HEADER ================= */}
      <thead className="sticky top-0 z-20">
        <tr className="
          bg-gradient-to-b from-zinc-100 to-zinc-200
          text-zinc-800 text-[11px] uppercase tracking-widest font-extrabold
        ">
          <th className="px-3 py-2 text-left w-[240px] border-r border-zinc-300">
            Totalizer
          </th>
          <th className="px-2 py-2 text-right w-[110px] border-r border-zinc-300">
            Today
          </th>
          <th className="px-2 py-2 text-right w-[110px] border-r border-zinc-300">
            Yesterday
          </th>
          <th className="px-2 py-2 text-right w-[90px]">
            Δ
          </th>
        </tr>

        {/* Header accent rail */}
        <tr className="h-[3px] bg-gradient-to-r from-orange-500 to-amber-400" />
      </thead>

      {/* ================= BODY ================= */}
      <tbody className="text-[12px] text-zinc-800">
        {currentTotalizers.filter(t => canView(t.name)).map((t) => {
          const rec = readingsForm[t.id];
          if (!rec) return null;

          const isEditable = canEdit(t.name);
          const adjustVal = Number(rec.adjust);
          const hasAdjustment = !isNaN(adjustVal) && adjustVal !== 0;

          return (
            <tr
              key={t.id}
              className="
                group
                border-b border-zinc-200
                hover:bg-amber-50/60
                transition-colors
              "
            >
              {/* NAME */}
              <td className="
                px-3 py-1.5
                font-semibold text-zinc-900
                truncate
                border-r border-zinc-200
                relative
              ">
                {/* row focus rail */}
                <span className="
                  absolute left-0 top-0 h-full w-[3px]
                  bg-transparent group-hover:bg-orange-400
                " />
                {t.display_name}
              </td>

              {/* TODAY */}
              <td className="px-1 py-1 text-right border-r border-zinc-200 bg-zinc-50/40">
                <input
                  type="number"
                  step="1"
                  value={rec.today === "" ? "" : rec.today}
                  onChange={(e) => updateField(t.id, "today", e.target.value)}
                  onDoubleClick={() =>
                    canAdjust && handleAdjustClick({ id: t.id, adjust: rec.adjust || 0 })
                  }
                  readOnly={!isEditable}
                  placeholder="—"
                  className={`
                    w-full h-7 px-2
                    text-right font-mono text-[13px] font-bold
                    outline-none transition-all
                    ${
                      isEditable
                        ? `
                          bg-white
                          text-zinc-900
                          border border-zinc-300
                          shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]
                          focus:border-orange-500
                          focus:ring-1 focus:ring-orange-400
                        `
                        : `
                          bg-zinc-100
                          text-zinc-400
                          cursor-not-allowed
                          border-none
                        `
                    }
                  `}
                />
              </td>

              {/* YESTERDAY */}
              <td className="
                px-2 py-1.5
                text-right font-mono text-[12px]
                text-zinc-500
                border-r border-zinc-200
              ">
                {rec.yesterday}
              </td>

              {/* DIFF */}
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={`
                      font-mono text-[13px] font-extrabold
                      ${Number(rec.difference) < 0 ? "text-red-700" : "text-zinc-800"}
                    `}
                  >
                    {rec.difference}
                  </span>

                  {hasAdjustment && (
                    <span
                      title={`Adjustment: ${adjustVal}`}
                      className="
                        w-3.5 h-3.5
                        flex items-center justify-center
                        bg-orange-200 text-orange-800
                        text-[9px] font-black
                        border border-orange-300
                      "
                    >
                      *
                    </span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>

      {/* ================= FOOTER ================= */}
      <tfoot>
        <tr className="bg-zinc-100 border-t border-zinc-300">
          <td colSpan="4" className="px-3 py-2 text-right text-[10px] text-zinc-600">
            {lastUpdatedInfo ? (
              <>
                Updated:
                <span className="font-bold ml-1">
                  {new Date(lastUpdatedInfo.at).toLocaleString()}
                </span>
                {" by "}
                <span className="text-orange-600 font-extrabold uppercase">
                  {lastUpdatedInfo.by}
                </span>
              </>
            ) : (
              "No data"
            )}
          </td>
        </tr>
      </tfoot>

    </table>
  </div>
);



  /* ---------------- confirm & adjust popups ---------------- */

  const previewChangedKPIs = async () => {
    // call /kpi/calc with readings to preview auto KPIs that will change
    setPreviewLoading(true);
    try {
      const readings = buildReadingsArrayForUnit(activeTab);
      const payload = { date: reportDate, plant_name: activeTab, readings };
      const r = await api.post("/kpi/calc", payload);
      setPreviewAutoKPIs(r.data?.auto_kpis || null);
    } catch (err) {
      console.error("previewChangedKPIs error", err);
      setPreviewAutoKPIs(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const renderConfirmPopup = () => {
    if (!showConfirmPopup) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-orange-600">Confirm changed inputs</h3>
            <button onClick={() => setShowConfirmPopup(false)} className="text-sm text-gray-500">Close</button>
          </div>

          <div className="max-h-64 overflow-auto border rounded p-2 bg-gray-50">
            <div className="text-sm text-gray-700 mb-2">Date: <strong>{reportDate}</strong> — <strong>{activeTab}</strong></div>

            <div className="mb-2">
              <div className="font-medium text-gray-800 text-sm mb-1">Changed Totalizer Readings</div>
              {confirmList.length > 0 ? (
                <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
                  {confirmList.map((c, i) => (
                    <li key={i}>
                      <strong>{c.label}</strong>: <span className="text-gray-500">{String(c.old)}</span> → <span className="text-orange-600 font-semibold">{String(c.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-sm text-gray-500 italic">No totalizer changes</div>}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-800 text-sm">Preview Auto KPIs</div>
                <button onClick={previewChangedKPIs} disabled={previewLoading} className="text-xs px-2 py-1 rounded bg-orange-50 border text-orange-700">
                  {previewLoading ? <Spinner size={12} /> : "Preview"}
                </button>
              </div>

              <div className="mt-2">
                {previewAutoKPIs ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(previewAutoKPIs).map(([k, v]) => (
                      <div key={k} className="p-2 border rounded bg-white text-sm">
                        <div className="text-xs text-gray-500">{k.replace(/_/g, " ")}</div>
                        <div className="font-bold text-gray-900">{typeof v === "number" ? (String(Number(v.toFixed(3)))) : String(v)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No preview. Click Preview to compute auto KPIs for changed inputs.</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setShowConfirmPopup(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
            <button onClick={confirmSubmit} disabled={submitting} className="px-4 py-2 bg-orange-600 text-white rounded text-sm">
              {submitting ? "Saving..." : "Confirm & Save"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAdjustPopup = () => {
    if (!showAdjustPopup || !adjustPopupRecord) return null;
    const rec = readingsForm[adjustPopupRecord.id];
    if (!rec) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-lg w-full max-w-md p-4">
          <h4 className="text-lg font-semibold mb-3">Edit Adjustment — {rec.display_name}</h4>
          <div className="mb-3">
            <div className="text-xs text-gray-500">Today Reading</div>
            <div className="font-mono text-sm text-gray-800">{rec.today === "" ? "—" : rec.today}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Adjustment Value</label>
            <input
              type="number"
              step="0.001"
              value={adjustPopupRecord.adjust}
              onChange={(e) => setAdjustPopupRecord((p) => ({ ...p, adjust: e.target.value === "" ? "" : Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded mt-2 focus:border-orange-500 outline-none"
              autoFocus
            />
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button onClick={() => setShowAdjustPopup(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
            <button onClick={saveAdjust} className="px-4 py-2 rounded bg-orange-600 text-white text-sm">Save</button>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- lifecycle effects ---------------- */

  useEffect(() => {
    (async () => {
      const items = totalizersByUnit[activeTab] || [];
      await loadTodayReadings(reportDate, activeTab, items);
      await loadYesterdayReadings(reportDate, activeTab, items);
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        await loadShutdownKPIsForUnitDate(activeTab, reportDate);
      }
      // keep serverKPIs (calculate explicit)
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, activeTab, totalizersByUnit]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    setMessage("");
  }, [activeTab, reportDate]);

  const handleDateChange = (days) => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() + days);
    setReportDate(d.toLocaleDateString("en-CA"));
  };

  /* ---------------- render ---------------- */

  return (
  <div className="min-h-screen flex bg-gradient-to-br from-amber-50 via-white to-orange-100">

    {/* ================= LEFT MENU BAR ================= */}
    <aside
      className="
        w-64 h-screen flex flex-col
        bg-gradient-to-r from-zinc-300 via-zinc-200 to-zinc-100
        border-r border-zinc-300
        shadow-[4px_0_18px_rgba(249,115,22,0.18)]
      "
    >
      {/* Header */}
      <div className="px-4 py-5 border-b border-orange-200">
        <h3 className="text-sm font-extrabold text-orange-700 tracking-wide uppercase">
          Plant Sections
        </h3>
      </div>

      {/* Tabs */}
      <div className="p-6 flex flex-col gap-6 ">
        {["Unit-1", "Unit-2", "Station", "Energy-Meter"].map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                relative px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wide
                transition-all border
                ${
                  isActive
                    ? `
                      bg-orange-600 text-white
                      border-orange-700
                      shadow-[0_6px_14px_rgba(249,115,22,0.45)]
                    `
                    : `
                      bg-white/80 text-zinc-800
                      border-orange-200
                      hover:bg-orange-50 hover:text-orange-700
                    `
                }
              `}
            >
              {tab}
              {isActive && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto p-4 border-t border-orange-200 text-xs">
        <div className="text-zinc-500">Logged in as</div>
        <div className="font-bold text-zinc-900 truncate">{userName}</div>
      </div>
    </aside>

    {/* ================= CENTER PANEL ================= */}
    <main className="flex-1 flex flex-col h-screen bg-white">

      {/* ===== FIXED TOP BAR ===== */}
      <div
        className="
          sticky top-0 z-30
          flex items-center justify-between
          px-5 py-3
          bg-white
          border-b border-zinc-300
          shadow-[0_2px_8px_rgba(0,0,0,0.08)]
        "
      >
        {/* Date */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateChange(-1)}
            className="px-2 py-1 rounded border bg-zinc-50 hover:bg-zinc-100"
          >
            ◀
          </button>

          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1 text-sm font-bold border rounded"
          />

          <button
            onClick={() => handleDateChange(1)}
            className="px-2 py-1 rounded border bg-zinc-50 hover:bg-zinc-100"
          >
            ▶
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleResetForm}
            className="
              px-4 py-2 text-xs font-bold
              border rounded
              bg-white
              text-red-600
              hover:bg-red-50
            "
          >
            Reset
          </button>

          <button
            onClick={handleSubmitClick}
            className="
              px-5 py-2 text-xs font-bold
              rounded
              bg-gradient-to-r from-orange-600 to-amber-600
              text-white
              shadow-lg
              hover:shadow-orange-500/40
            "
          >
            {submitting ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-sm font-bold text-zinc-900 mb-2">
          {activeTab} Readings
        </h2>

        {renderTotalizerTable()}

        {/* Manual KPI */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-zinc-800 mb-2">
            Manual KPIs
          </h3>

          <div className="border rounded bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-zinc-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Parameter</th>
                  <th className="px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(manualKPI[activeTab] || {}).map(([k, v]) => (
                  <tr key={k} className="border-b hover:bg-orange-50">
                    <td className="px-3 py-2 font-semibold">
                      {k.replace(/_/g, " ").toUpperCase()}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={v ?? ""}
                        onChange={(e) =>
                          updateManualField(activeTab, k, e.target.value)
                        }
                        className="w-full px-2 py-1 text-right border rounded font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    {/* ================= RIGHT KPI BAR ================= */}
    <aside
      className="
        w-80 h-screen
        bg-gradient-to-b from-zinc-100 via-white to-zinc-200
        border-l border-zinc-300
        shadow-[-4px_0_18px_rgba(0,0,0,0.12)]
        p-4 overflow-auto
      "
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-zinc-800 uppercase tracking-wide">
          KPIs
        </h3>

        {(activeTab === "Unit-1" ||
          activeTab === "Unit-2" ||
          activeTab === "Station") && (
          <button
            onClick={() => calculateKPIsForUnit(activeTab)}
            className="
              px-2 py-1 text-xs font-bold
              rounded border
              bg-orange-50 text-orange-700
              hover:bg-orange-100
            "
          >
            Calc
          </button>
        )}
      </div>

      {renderLeftKPIList()}
    </aside>

    {/* ================= MESSAGE ================= */}
    {message && (
      <div
        className={`
          fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]
          px-6 py-3 rounded-xl text-sm font-bold shadow-xl
          ${
            message.startsWith("❌")
              ? "bg-red-50 text-red-700 border border-red-200"
              : message.startsWith("✅")
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }
        `}
      >
        {message.replace(/^[❌✅⚠️]\s*/, "")}
      </div>
    )}

    {renderConfirmPopup()}
    {renderAdjustPopup()}
  </div>
);



}