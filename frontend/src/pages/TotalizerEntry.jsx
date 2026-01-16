// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import { ChartBarIcon, FireIcon, CloudIcon, BoltIcon, FunnelIcon } from "@heroicons/react/24/solid";

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

const getYesterdayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setDate(istTime.getDate() - 1);
  return istTime.toISOString().split('T')[0];
};

const isYesterdayIST = (dateStr) => {
  return dateStr === getYesterdayIST();
};

const Spinner = ({ size = 14 }) => (
  <div style={{ width: size, height: size }} className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current" />
);

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
};

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

  const [reportDate, setReportDate] = useState(getYesterdayIST());
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [roleId, setRoleId] = useState(null);
  const [userName, setUserName] = useState("Unknown");
  const isAdmin = roleId === 8;
  const isHOD = roleId === 7;
  const isOperation = roleId === 1;
  const isEMD = roleId === 2;
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

  const [readingsForm, setReadingsForm] = useState({});
  const [dailyGeneration, setDailyGeneration] = useState({ unit1_generation: 0, unit2_generation: 0 });
  
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
        lastUpdated: null,
        updatedBy: null,
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

  const [highlightedKPIs, setHighlightedKPIs] = useState({});
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);
  const [confirmManualList, setConfirmManualList] = useState([]);
  const [previewAutoKPIs, setPreviewAutoKPIs] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null);

  const initialManualKPI = {
    "Unit-1": { stack_emission: "", Approx_COP: "" },
    "Unit-2": { stack_emission: "", Approx_COP: "" },
    Station: {
      clarifier_level: "",
      ro_running_hour: "",
      ro_production_cum: "",
      coal_indonesian_percent: "",
      coal_southafrica_percent: "",
      coal_domestic_percent: "",
    },
    "Energy-Meter": {},
  };
  
  const [manualKPI, setManualKPI] = useState(JSON.parse(JSON.stringify(initialManualKPI)));
  const [originalManualKPI, setOriginalManualKPI] = useState(JSON.parse(JSON.stringify(initialManualKPI)));
  
  const manualUnits = {
    "Unit-1": { stack_emission: "mg/Nm3", Approx_COP: "Rs" },
    "Unit-2": { stack_emission: "mg/Nm3", Approx_COP: "Rs" },
    Station: {
      clarifier_level: "%",
      ro_running_hour: "hr",
      ro_production_cum: "m3",
      coal_indonesian_percent: "%",
      coal_southafrica_percent: "%",
      coal_domestic_percent: "%",
    },
    "Energy-Meter": {},
  };

  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  /* ================= LOAD GENERATION DATA ================= */
  const loadGenerationData = useCallback(async (forDate) => {
    try {
      const res = await api.get("/kpi/generation", { params: { date: forDate } });
      setDailyGeneration({
        unit1_generation: res.data.unit1_generation || 0,
        unit2_generation: res.data.unit2_generation || 0,
      });
    } catch (e) {
      console.error("Load generation error:", e);
      setDailyGeneration({ unit1_generation: 0, unit2_generation: 0 });
    }
  }, [api]);

  const canEditTotalizer = useCallback((totalizerId) => {
    if (isHOD) return true;
    const isYesterday = isYesterdayIST(reportDate);
    if (isOperation && isYesterday) return true;
    if (isEMD && isYesterday && activeTab === "Energy-Meter") return true;
    return false;
  }, [roleId, isHOD, isOperation, isEMD, reportDate, activeTab]);

  const canEditManualKPI = useCallback(() => {
    if (isHOD) return true;
    const isYesterday = isYesterdayIST(reportDate);
    if (isOperation && isYesterday) return true;
    return false;
  }, [roleId, isHOD, isOperation, reportDate]);

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
      } catch (e) {}
    }
    loadPerm();
  }, [api]);

  const loadTodayReadings = useCallback(async (forDate, unit, itemsParam = null) => {
    try {
      const res = await api.get(`/totalizers/${encodeURIComponent(unit)}/readings`, { params: { date: forDate } });
      const rows = res.data || [];
      const rowMap = {};
      let lastUpdate = null;
      
      rows.forEach((r) => {
        rowMap[r.totalizer_id] = {
          today: Number(r.reading_value || 0),
          adjust: Number(r.adjust_value || 0),
          lastUpdated: r.updated_at,
          updatedBy: r.username,
        };
        if (!lastUpdate && r.updated_at) lastUpdate = { at: r.updated_at, by: r.username || "Unknown" };
      });
      
      setLastUpdatedInfo(lastUpdate);

      setReadingsForm((prev) => {
        const updated = { ...prev };
        const items = itemsParam || (totalizersByUnit[unit] || []);
        items.forEach((t) => {
          const rec = updated[t.id] || {
            today: "", adjust: 0, yesterday: "—", difference: "—", display_name: t.display_name, 
            name: t.name, unit: t.unit || unit, totalizer_id: t.id, _orig: { today: "", adjust: 0 },
            lastUpdated: null, updatedBy: null,
          };
          
          if (rowMap[t.id] !== undefined) {
            rec.today = rowMap[t.id].today;
            rec.adjust = rowMap[t.id].adjust;
            rec.lastUpdated = rowMap[t.id].lastUpdated;
            rec.updatedBy = rowMap[t.id].updatedBy;
            rec._orig = { today: rec.today, adjust: rec.adjust };
          } else {
            rec.today = "";
            rec.adjust = 0;
            rec.lastUpdated = null;
            rec.updatedBy = null;
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
const updateField = (id, field, value) => {
if (!canEditTotalizer(id)) {
setMessage("❌ You don't have permission to edit this field");
return;
}
setReadingsForm((prev) => {
  const rec = { ...prev[id] };
  const name = rec.name;
  rec[field] = value === "" ? "" : Number(value);

  if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
  else {
    const adj = canAdjust ? Number(rec.adjust || 0) : 0;
    rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
  }

  const impacted = KPI_DEPENDENCY_MAP[name] || [];
  if (impacted.length > 0) {
    const newState = {};
    impacted.forEach(k => newState[k] = true);
    setHighlightedKPIs(newState);
    setTimeout(() => setHighlightedKPIs({}), 1400);
  }

  return { ...prev, [id]: rec };
});
};
const updateManualField = (unit, field, value) => {
if (!canEditManualKPI()) {
setMessage("❌ You don't have permission to edit manual KPIs");
return;
}
setManualKPI((prev) => ({
  ...prev,
  [unit]: { ...prev[unit], [field]: value === "" ? "" : parseFloat(value) },
}));
};
const getDiff = (name, unitFilter = null) => {
const unitToUse = unitFilter || activeTab;
const rec = Object.values(readingsForm).find((r) => r.name === name && (r.unit || "").toString() === unitToUse);
if (!rec) return 0;
if (!rec.difference || rec.difference === "—") return 0;
return Number(rec.difference) || 0;
};
/* ================= DYNAMIC KPI CALCULATIONS ================= */
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
  // Get generation for this unit
  const generation = activeTab === "Unit-1" ? dailyGeneration.unit1_generation : dailyGeneration.unit2_generation;
  
  // Calculate specific consumption
  const specific_coal = generation > 0 ? (coal / generation) : 0;
  const specific_oil = generation > 0 ? (ldo / generation) : 0;
  const specific_dm = steam > 0 ? dm / steam : 0; // L/kWh
  const specific_steam = generation > 0 ? steam / generation : 0;   // kg/kWh
  
  return { coal, ldo, dm, steam, specific_coal, specific_oil,specific_dm,specific_steam };
} catch {
  return { coal: 0, ldo: 0, dm: 0, steam: 0, specific_coal: 0, specific_oil: 0,specific_dm: 0,specific_steam: 0 };
}
}, [readingsForm, activeTab, dailyGeneration]);
const localStationKPI = useMemo(() => {
if (activeTab !== "Station") return null;
try {
const total_raw_water = getDiff("raw_water", "Station");
const avg_raw_per_hr = Number((total_raw_water / 24.0).toFixed(3));
const u1_dm = getDiff("dm7", "Unit-1") + getDiff("dm11", "Unit-1");
const u2_dm = getDiff("dm7", "Unit-2") + getDiff("dm11", "Unit-2");
const total_dm = Number((u1_dm + u2_dm).toFixed(3));
  // Calculate specific raw water consumption
  const total_generation = dailyGeneration.unit1_generation + dailyGeneration.unit2_generation;
  const specific_raw_water = total_generation > 0 ? (total_raw_water / total_generation) : 0;
  
  return { total_raw_water, avg_raw_per_hr, total_dm, specific_raw_water };
} catch {
  return { total_raw_water: 0, avg_raw_per_hr: 0, total_dm: 0, specific_raw_water: 0 };
}
}, [readingsForm, activeTab, dailyGeneration]);
const liveEnergyKPI = useMemo(() => {
const d = (name) => {
const rec = Object.values(readingsForm).find((r) => r.name === name);
if (!rec || rec.difference === "—" || rec.difference === null) return 0;
return Number(rec.difference) || 0;
};
try {
  const unit1_unit_aux_mwh = d("1lsr01_ic1") + d("1lsr02_ic1") + d("1lsr01_ic2_tie") - d("SST_10") - d("UST_15");
  const unit2_unit_aux_mwh = d("2lsr01_ic1") + d("2lsr02_ic1") + d("2lsr01_ic2_tie") - d("UST_25");
  const total_station_aux_mwh = d("rlsr01") + d("rlsr02") + d("rlsr03") + d("rlsr04") - d("1lsr01_ic2_tie") - d("1lsr02_ic2_tie") - d("2lsr01_ic2_tie") - d("2lsr02_ic2_tie") + d("SST_10") + d("UST_15") + d("UST_25");
  const total_station_tie_mwh = d("1lsr01_ic2_tie") + d("1lsr02_ic2_tie") + d("2lsr01_ic2_tie") + d("2lsr02_ic2_tie");
  const unit1_gen = d("unit1_gen");
  const unit2_gen = d("unit2_gen");
  const unit1_aux_consumption_mwh = unit1_unit_aux_mwh + total_station_aux_mwh / 2;
  const unit2_aux_consumption_mwh = unit2_unit_aux_mwh + total_station_aux_mwh / 2;

  return {
    unit1_generation: unit1_gen,
    unit2_generation: unit2_gen,
    unit1_unit_aux_mwh: Number(unit1_unit_aux_mwh.toFixed(3)),
    unit2_unit_aux_mwh: Number(unit2_unit_aux_mwh.toFixed(3)),
    total_station_aux_mwh: Number(total_station_aux_mwh.toFixed(3)),
    total_station_tie_mwh: Number(total_station_tie_mwh.toFixed(3)),
    unit1_aux_consumption_mwh: Number(unit1_aux_consumption_mwh.toFixed(3)),
    unit2_aux_consumption_mwh: Number(unit2_aux_consumption_mwh.toFixed(3)),
    unit1_aux_percent: unit1_gen > 0 ? Number(((unit1_aux_consumption_mwh / unit1_gen) * 100).toFixed(3)) : 0,
    unit2_aux_percent: unit2_gen > 0 ? Number(((unit2_aux_consumption_mwh / unit2_gen) * 100).toFixed(3)) : 0,
    unit1_plf_percent: unit1_gen > 0 ? Number(((unit1_gen / 3000) * 100).toFixed(3)) : 0,
    unit2_plf_percent: unit2_gen > 0 ? Number(((unit2_gen / 3000) * 100).toFixed(3)) : 0,
    station_plf_percent: unit1_gen + unit2_gen > 0 ? Number((((unit1_gen + unit2_gen) / 3000) * 100).toFixed(3)) : 0,
  };
} catch {
  return {};
}
}, [readingsForm]);
/* ================= SUBMIT FLOW ================= */
const getChangedList = (unit) => {
const list = [];
const items = totalizersByUnit[unit] || [];
items.forEach((t) => {
const rec = readingsForm[t.id];
if (!rec) return;
const orig = rec._orig || { today: "", adjust: 0 };
if (String(rec.today) !== String(orig.today) && rec.today !== "") {
list.push({ label: rec.display_name, value: rec.today, old: orig.today ?? "", id: t.id, type: 'totalizer' });
} else if (canAdjust && String(rec.adjust) !== String(orig.adjust)) {
list.push({ label: rec.display_name + " (Adj)", value: rec.adjust, old: orig.adjust ?? 0, id: t.id, type: 'totalizer' });
}
});
return list;
};
const getManualKPIChanges = () => {
const changes = [];
const current = manualKPI[activeTab] || {};
const original = originalManualKPI[activeTab] || {};
Object.keys(current).forEach(key => {
  const currVal = current[key];
  const origVal = original[key];
  
  if (currVal !== "" && currVal !== null && currVal !== undefined) {
    if (String(currVal) !== String(origVal || "")) {
      changes.push({
        label: key.replace(/_/g, " ").toUpperCase(),
        value: currVal,
        old: origVal ?? "",
        unit: manualUnits[activeTab]?.[key] || "",
        type: 'manual'
      });
    }
  }
});

return changes;
};
const handleSubmitClick = () => {
const totalizerChanges = getChangedList(activeTab);
const manualChanges = getManualKPIChanges();
if (totalizerChanges.length === 0 && manualChanges.length === 0) {
  setMessage("❌ No changes to submit");
  return;
}

if (!isAdmin && !isHOD) {
  for (const ch of totalizerChanges) {
    const rec = readingsForm[ch.id];
    if (rec._orig.today !== "") {
      setMessage(`❌ Only Admin/HOD can modify existing values (${ch.label})`);
      return;
    }
  }
}

setConfirmList(totalizerChanges);
setConfirmManualList(manualChanges);
setPreviewAutoKPIs(null);
setShowConfirmPopup(true);
};
const confirmSubmit = async () => {
  setShowConfirmPopup(false);
  setSubmitting(true);
  setMessage("");
  
  try {
    const items = totalizersByUnit[activeTab] || [];

    // Submit totalizer readings
    // ✅ Backend will AUTO-CALCULATE and SAVE all KPIs!
    await api.post("/totalizers/submit", {
      date: reportDate,
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
    });

    // Save manual KPIs separately
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

    setMessage("✅ Readings saved and KPIs auto-calculated successfully!");
    
    // Reload data
    await loadTodayReadings(reportDate, activeTab, totalizersByUnit[activeTab]);
    await loadYesterdayReadings(reportDate, activeTab, totalizersByUnit[activeTab]);
    await loadManualKPIForActiveTab();
    await loadGenerationData(reportDate);
    
  } catch (err) {
    console.error(err);
    setMessage(`❌ ${err?.response?.data?.detail || "Save error"}`);
  } finally {
    setSubmitting(false);
  }
};
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
setManualKPI(prev => ({
  ...prev,
  [activeTab]: { ...(originalManualKPI[activeTab] || {}) }
}));

setMessage("⚠️ Inputs reset");
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

    setMessage("ℹ️ Readings seeded from previous day");
  } catch (e) {
    console.error(e);
    setMessage("❌ Failed to seed readings");
  } finally {
    setLoading(false);
  }
};
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

  const loadedKPIs = {
    ...(initialManualKPI[activeTab] || {}),
    ...fetched,
  };

  setManualKPI((prev) => ({
    ...prev,
    [activeTab]: loadedKPIs,
  }));

  setOriginalManualKPI((prev) => ({
    ...prev,
    [activeTab]: { ...loadedKPIs },
  }));
} catch {
  setManualKPI((prev) => ({
    ...prev,
    [activeTab]: { ...(initialManualKPI[activeTab] || {}) },
  }));
  setOriginalManualKPI((prev) => ({
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
/* ================= KPI RENDERING ================= */
const renderKpiValue = (k) => {
if ((activeTab === "Unit-1" || activeTab === "Unit-2") && localUnitKPI) {
const map = {
coal_consumption: localUnitKPI.coal,
oil_consumption: localUnitKPI.ldo,
dm_water: localUnitKPI.dm,
steam_consumption: localUnitKPI.steam,
specific_coal: localUnitKPI.specific_coal,
specific_oil: localUnitKPI.specific_oil,
specific_dm_percent: localUnitKPI.specific_dm,
specific_steam: localUnitKPI.specific_steam,
};
if (map[k] !== undefined) return map[k];
}
if (activeTab === "Station" && localStationKPI) {
const map = {
total_raw_water_used_m3: localStationKPI.total_raw_water,
avg_raw_water_m3_per_hr: localStationKPI.avg_raw_per_hr,
total_dm_water_used_m3: localStationKPI.total_dm,
specific_raw_water: localStationKPI.specific_raw_water,
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
const KpiCard = ({ k, label, value, unit = "", Icon = ChartBarIcon }) => {
const isHighlighted = !!highlightedKPIs[k];
return (
  <div
    className={`
      flex items-center h-9 px-3 border-l-4 border transition-all duration-150 rounded-md
      font-['Inter',sans-serif]
      ${
        isHighlighted
          ? `border-amber-600 bg-amber-100 shadow-md`
          : `border-slate-300 bg-white hover:bg-slate-50 hover:border-amber-500`
      }
    `}
  >
    <div className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-200 text-amber-700 mr-3">
      <Icon className="w-3.5 h-3.5" />
    </div>

    <div className="flex-1 text-[11px] text-slate-700 truncate font-semibold tracking-wide">
      {label}
    </div>

    <div className="ml-2 flex items-baseline gap-1.5 font-mono">
      <span
        className={`
          text-[13px] font-bold
          ${typeof value === "number" && value < 0 ? "text-red-700" : "text-slate-900"}
        `}
      >
        {value === null || value === undefined ? "—" : typeof value === "number" ? value.toFixed(3) : value}
      </span>

      {unit && (
        <span className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">
          {unit}
        </span>
      )}
    </div>
  </div>
);
};
const renderLeftKPIList = () => {
if (activeTab === "Unit-1" || activeTab === "Unit-2") {
const s = serverKPIs[activeTab] || {};
const local = localUnitKPI || { coal: 0, ldo: 0, dm: 0, steam: 0, specific_coal: 0, specific_oil: 0 };
const sKPI = shutdownKPIs[activeTab] || {};
return (
<div className="space-y-2.5">
<KpiCard k="daily_generation" label="Daily Generation" value={activeTab === "Unit-1" ? dailyGeneration.unit1_generation : dailyGeneration.unit2_generation} unit="MWh" Icon={ChartBarIcon} />
      <div className="text-[10px] font-bold text-slate-600 mt-4 mb-1 uppercase tracking-widest">Fuel & Utilities</div>
      <KpiCard k="coal_consumption" label="Coal Consumption" value={renderKpiValue("coal_consumption") ?? local.coal} unit="ton" Icon={FireIcon} />
      <KpiCard k="specific_coal" label="Specific Coal (SCC)" value={renderKpiValue("specific_coal") ?? local.specific_coal} unit="kg/kWh" Icon={ChartBarIcon} />
      <KpiCard k="oil_consumption" label="LDO Consumption" value={renderKpiValue("oil_consumption") ?? local.ldo} unit="L" Icon={FunnelIcon} />
      <KpiCard k="specific_oil" label="Specific Oil (SOC)" value={renderKpiValue("specific_oil") ?? local.specific_oil} unit="ml/kWh" Icon={FunnelIcon} />
      <KpiCard k="dm_water" label="DM Water" value={renderKpiValue("dm_water") ?? local.dm} unit="m³" Icon={CloudIcon} />
      <KpiCard k="specific_dm_percent" label="Specific Water (SWC)" value={renderKpiValue("specific_dm_percent") ?? null} unit="%" Icon={FunnelIcon} />
      <KpiCard k="steam_consumption" label="Steam Consumption" value={renderKpiValue("steam_consumption") ?? local.steam} unit="kg" Icon={BoltIcon} />
      <KpiCard k="specific_steam" label="Specific Steam (SSC)" value={renderKpiValue("specific_steam") ?? null} unit="kg/kWh" Icon={FunnelIcon} />
    </div>
  );
}

if (activeTab === "Station") {
  const s = serverKPIs["Station"] || {};
  const local = localStationKPI || { total_raw_water: 0, avg_raw_per_hr: 0, total_dm: 0, specific_raw_water: 0 };
  return (
    <div className="space-y-2.5">
      
      <KpiCard k="total_raw_water_used_m3" label="Total Raw Water" value={renderKpiValue("total_raw_water_used_m3") ?? local.total_raw_water} unit="m³" Icon={CloudIcon} />
      <KpiCard k="avg_raw_water_m3_per_hr" label="Avg Raw Water/hr" value={renderKpiValue("avg_raw_water_m3_per_hr") ?? local.avg_raw_per_hr} unit="m³/hr" Icon={CloudIcon} />
      <KpiCard k="specific_raw_water" label="Specific Raw Water" value={renderKpiValue("specific_raw_water") ?? local.specific_raw_water} unit="L/kWh" Icon={CloudIcon} />
      <KpiCard k="total_dm_water_used_m3" label="Total DM Water" value={renderKpiValue("total_dm_water_used_m3") ?? local.total_dm} unit="m³" Icon={CloudIcon} />
    </div>
  );
}

if (activeTab === "Energy-Meter") {
  const ek = liveEnergyKPI || {};
  return (
    <div className="space-y-2.5">
      <KpiCard k="unit1_generation" label="U1 Generation" value={ek.unit1_generation ?? 0} unit="MWh" Icon={ChartBarIcon} />
      <KpiCard k="unit1_plf_percent" label="U1 PLF" value={ek.unit1_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />
      <KpiCard k="unit2_generation" label="U2 Generation" value={ek.unit2_generation ?? 0} unit="MWh" Icon={ChartBarIcon} />
      <KpiCard k="unit2_plf_percent" label="U2 PLF" value={ek.unit2_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />
      <KpiCard k="unit1_aux_consumption_mwh" label="U1 Aux Consumption" value={ek.unit1_aux_consumption_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="unit2_aux_consumption_mwh" label="U2 Aux Consumption" value={ek.unit2_aux_consumption_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="unit1_aux_percent" label="U1 Aux %" value={ek.unit1_aux_percent ?? 0} unit="%" Icon={BoltIcon} />
      <KpiCard k="unit2_aux_percent" label="U2 Aux %" value={ek.unit2_aux_percent ?? 0} unit="%" Icon={BoltIcon} />
      <KpiCard k="unit1_unit_aux_mwh" label="U1 UAT Consumption" value={ek.unit1_unit_aux_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="unit2_unit_aux_mwh" label="U2 UAT Consumption" value={ek.unit2_unit_aux_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="total_station_aux_mwh" label="Station Aux" value={ek.total_station_aux_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="total_station_tie_mwh" label="Station Tie" value={ek.total_station_tie_mwh ?? 0} unit="MWh" Icon={BoltIcon} />
      <KpiCard k="station_plf_percent" label="Station PLF" value={ek.station_plf_percent ?? 0} unit="%" Icon={ChartBarIcon} />
    </div>
  );
}

return null;
};
/* ================= TABLE RENDER ================= */
const currentTotalizers = totalizersByUnit[activeTab] || [];
const renderTotalizerTable = () => (
<div className="max-h-[195vh] overflow-auto relative bg-white border border-slate-300 rounded-lg shadow-sm font-['Inter',sans-serif]">
<table className="min-w-full table-fixed border-collapse">
<thead className="sticky top-0 z-20">
<tr className="bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 text-[11px] uppercase tracking-wider font-bold">
<th className="px-4 py-3 text-left w-[200px] border-r border-slate-300">Totalizer</th>
<th className="px-3 py-3 text-left w-[110px] border-r border-slate-300">Yesterday</th>
<th className="px-3 py-3 text-left w-[150px] border-r border-slate-300">Today</th>
<th className="px-3 py-3 text-left w-[80px]">Difference</th>
</tr>
<tr className="h-[2px] bg-gradient-to-r from-amber-500 to-orange-500" />
</thead>
<tbody className="text-[13px] text-slate-800">
      {currentTotalizers.filter(t => canView(t.name)).map((t) => {
        const rec = readingsForm[t.id];
        if (!rec) return null;

        const isEditable = canEditTotalizer(t.id);
        const adjustVal = Number(rec.adjust);
        const hasAdjustment = !isNaN(adjustVal) && adjustVal !== 0;

        return (
          <tr key={t.id} className="group border-b border-slate-200 hover:bg-amber-50/40 transition-colors">
            <td 
              className="px-3 py-1 font-semibold text-slate-900 truncate border-r border-slate-200 relative cursor-pointer"
              onDoubleClick={() => canAdjust && handleAdjustClick({ 
                id: t.id, 
                adjust: rec.adjust || 0,
                lastUpdated: rec.lastUpdated,
                updatedBy: rec.updatedBy,
                displayName: rec.display_name
              })}
            >
              <span className="absolute left-0 top-0 h-full w-1 bg-transparent group-hover:bg-amber-500 transition-colors" />
              {t.display_name}
            </td>

            <td className="px-3 py-2 text-left font-mono text-[12px] text-slate-600 border-r border-slate-200 bg-slate-50/50">
              {rec.yesterday}
            </td>

           <td className="px-2 py-1.5 text-left border-r border-slate-200">
  <input
    type="number"
    step="1"
    value={rec.today === "" ? "" : rec.today}
    onChange={(e) => updateField(t.id, "today", e.target.value)}
    readOnly={!isEditable}
    placeholder="—"
    className={`
      w-full h-7 px-2 text-left font-mono text-[12px] font-semibold outline-none transition-all rounded
      ${
        isEditable
          ? `bg-white text-slate-900 border border-slate-300 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200`
          : `bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300`
      }
    `}
  />
</td>

            <td className="px-3 py-2.5 text-left">
  <div className="flex items-center justify-start gap-1.5">
    <span
      className={`font-mono text-[13px] font-bold ${
        Number(rec.difference) < 0 ? "text-red-700" : "text-slate-900"
      }`}
    >
      {rec.difference}
    </span>

    {hasAdjustment && (
      <span
        title={`Adjustment: ${adjustVal}`}
        className="w-4 h-4 flex items-center justify-center bg-amber-200 text-amber-900 text-[9px] font-black border border-amber-400 rounded"
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

    <tfoot>
      <tr className="bg-slate-100 border-t border-slate-300">
        <td colSpan="4" className="px-4 py-2.5 text-right text-[10px] text-slate-600 font-medium">
          {lastUpdatedInfo ? (
            <>
              Last Updated:
              <span className="font-bold ml-1.5 text-slate-800">
                {new Date(lastUpdatedInfo.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
              {" by "}
              <span className="text-amber-700 font-bold uppercase">
                {lastUpdatedInfo.by}
              </span>
            </>
          ) : (
            "No data available"
          )}
        </td>
      </tr>
    </tfoot>
  </table>
</div>
);
/* ================= POPUPS ================= */
const previewChangedKPIs = async () => {
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-['Inter',sans-serif]">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-auto">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-slate-800">Confirm Changes</h3>
        <button onClick={() => setShowConfirmPopup(false)} className="text-sm text-slate-500 hover:text-slate-700 font-medium">Close</button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="font-semibold"><span className="text-slate-500">Date:</span> {reportDate}</div>
          <div className="font-semibold"><span className="text-slate-500">Plant:</span> {activeTab}</div>
        </div>

        {confirmList.length > 0 && (
          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
            <div className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-600 rounded-full"></span>
              Totalizer Reading Changes ({confirmList.length})
            </div>
            <div className="space-y-2">
              {confirmList.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-md hover:bg-amber-50 border border-amber-100">
                  <span className="font-semibold text-slate-700">{c.label}</span>
                  <span className="text-sm font-mono">
                    <span className="text-slate-400">{String(c.old) || "—"}</span>
                    <span className="mx-2 text-amber-600">→</span>
                    <span className="text-amber-700 font-bold">{String(c.value)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmManualList.length > 0 && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
            <div className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
              Manual KPI Changes ({confirmManualList.length})
            </div>
            <div className="space-y-2">
              {confirmManualList.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-md hover:bg-blue-50 border border-blue-100">
                  <span className="font-semibold text-slate-700">{c.label}</span>
                  <span className="text-sm font-mono">
                    <span className="text-slate-400">{String(c.old) || "—"}</span>
                    <span className="mx-2 text-blue-600">→</span>
                    <span className="text-blue-700 font-bold">{String(c.value)} <span className="text-[10px] text-blue-600">{c.unit}</span></span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-800 text-base">Preview Auto KPIs</div>
            <button
              onClick={previewChangedKPIs}
              disabled={previewLoading}
              className="text-xs px-4 py-2 rounded-md bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 disabled:opacity-50 font-semibold transition-colors"
            >
              {previewLoading ? <Spinner size={12} /> : "Calculate Preview"}
            </button>
          </div>

          <div className="mt-3">
            {previewAutoKPIs ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(previewAutoKPIs).map(([k, v]) => (
                  <div key={k} className="p-3 border border-slate-200 rounded-md bg-white text-sm shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{k.replace(/_/g, " ")}</div>
                    <div className="font-bold text-slate-900 mt-1 font-mono">{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-6 text-center">
                Click "Calculate Preview" to see how KPIs will be affected
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => setShowConfirmPopup(false)}
          className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={confirmSubmit}
          disabled={submitting}
          className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-semibold hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Spinner size={14} />
              Saving...
            </span>
          ) : (
            "Confirm & Save"
          )}
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-['Inter',sans-serif]">
    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
      <h4 className="text-lg font-bold mb-4 text-slate-800">Edit Adjustment</h4>
      
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 font-semibold mb-1">Totalizer</div>
          <div className="font-semibold text-slate-900">{adjustPopupRecord.displayName}</div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 font-semibold mb-1">Current Reading</div>
          <div className="font-mono text-lg font-bold text-slate-900">{rec.today === "" ? "—" : rec.today}</div>
        </div>

        {adjustPopupRecord.lastUpdated && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-700 font-semibold mb-1">Last Updated</div>
            <div className="text-sm text-blue-900">
              <div>{new Date(adjustPopupRecord.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
              <div className="font-semibold">by {adjustPopupRecord.updatedBy || "Unknown"}</div>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-600 font-semibold block mb-2">Adjustment Value</label>
          <input
            type="number"
            step="0.001"
            value={adjustPopupRecord.adjust}
            onChange={(e) => setAdjustPopupRecord((p) => ({ ...p, adjust: e.target.value === "" ? "" : Number(e.target.value) }))}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg mt-1 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none font-mono text-lg font-semibold"
            autoFocus
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button 
          onClick={() => setShowAdjustPopup(false)} 
          className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={saveAdjust} 
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold hover:from-amber-700 hover:to-orange-700 shadow-lg transition-all"
        >
          Save Adjustment
        </button>
      </div>
    </div>
  </div>
);
};
/* ================= LIFECYCLE EFFECTS ================= */
useEffect(() => {
(async () => {
const items = totalizersByUnit[activeTab] || [];
await loadTodayReadings(reportDate, activeTab, items);
await loadYesterdayReadings(reportDate, activeTab, items);
await loadManualKPIForActiveTab();
await loadGenerationData(reportDate);
  if (activeTab === "Unit-1" || activeTab === "Unit-2") {
    await loadShutdownKPIsForUnitDate(activeTab, reportDate);
  }
})();
}, [reportDate, activeTab, totalizersByUnit]);
useEffect(() => {
if (!message) return;
const t = setTimeout(() => setMessage(""), 4000);
return () => clearTimeout(t);
}, [message]);
useEffect(() => {
setMessage("");
}, [activeTab, reportDate]);
useEffect(() => {
setServerKPIs({
"Unit-1": null,
"Unit-2": null,
Station: null,
"Energy-Meter": null,
});
setPreviewAutoKPIs(null);
setHighlightedKPIs({});
}, [activeTab, reportDate]);
const handleDateChange = (days) => {
const d = new Date(reportDate);
d.setDate(d.getDate() + days);
setReportDate(d.toLocaleDateString("en-CA"));
};
/* ================= MAIN RENDER ================= */
return (
<div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-amber-50 font-['Inter',sans-serif]">
{/* SIDEBAR */}
<aside className="w-60 h-screen flex flex-col bg-gradient-to-t from-slate-200 via-slate-100 to-slate-200 border-r border-zinc-200 shadow-2xl">
<div className="px-5 py-6 border-b border-slate-300">
<h3 className="text-md font-bold text-orange-600 tracking-wider uppercase">Sections</h3>
</div>
    <div className="p-5 flex flex-col gap-8">
      {["Unit-1", "Unit-2", "Station", "Energy-Meter"].map(tab => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              relative px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all
              ${isActive
                ? `bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/50`
                : `bg-gray-500 text-white hover:bg-slate-600 hover:text-white border border-slate-600`
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

    <div className="mt-auto p-5 border-t border-slate-700 text-xs">
      <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Logged in as</div>
      <div className="font-bold text-white truncate">{userName}</div>
      <div className="text-amber-400 text-[10px] mt-1 font-semibold">
        {roleId === 1 ? "OPERATION" : roleId === 2 ? "EMD" : roleId === 7 ? "HOD" : roleId === 8 ? "ADMIN" : "Unknown"}
      </div>
    </div>
  </aside>

  {/* MAIN CONTENT */}
  <main className="flex-1 flex flex-col h-screen bg-white">
    {/* TOP BAR */}
    <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleDateChange(-1)}
          className="px-2 py-1 rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold transition-colors"
        >
          ◀
        </button>

        <input
          type="date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          className="px-2 py-1 text-md font-bold border-2 border-orange-300 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
        />

        <button
          onClick={() => handleDateChange(1)}
          className="px-2 py-1 rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold transition-colors"
        >
          ▶
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleResetForm}
          className="px-5 py-1 text-xs font-bold border-1 border-orange-500 rounded-lg bg-orange-50 text-red-700 hover:bg-red-100 transition-colors"
        >
          Reset
        </button>

        <button
          onClick={handleSubmitClick}
          className="px-9 py-2 text-md font-bold rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg hover:shadow-xl hover:from-amber-700 hover:to-orange-700 transition-all"
        >
          {submitting ? "Saving..." : "Submit"}
        </button>
      </div>
    </div>

    {/* CONTENT AREA */}
    <div className="flex-1 overflow-auto p-2 space-y-1">
      

      {renderTotalizerTable()}

      {/* MANUAL KPIs */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3"></h3>

        <div className="border border-slate-300 rounded-lg bg-white shadow-sm overflow-hidden">
          <table className="min-w-full text-xs">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-200 border-b border-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-800 uppercase tracking-wider">Parameter</th>
                <th className="px-4 py-3 text-left font-bold text-slate-800 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left font-bold text-slate-800 uppercase tracking-wider">Unit</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(manualKPI[activeTab] || {}).map(([k, v]) => {
                const isEditable = canEditManualKPI();
                return (
                  <tr key={k} className="border-b border-slate-200 hover:bg-amber-50/40 transition-colors group">
                    <td className="px-2 py-1 font-semibold text-slate-700 relative">
                      <span className="absolute left-0 top-0 h-full w-1 bg-transparent group-hover:bg-amber-500 transition-colors" />
                      {k.replace(/_/g, " ").toUpperCase()}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={v ?? ""}
                        onChange={(e) => updateManualField(activeTab, k, e.target.value)}
                        readOnly={!isEditable}
                        className={`
                          w-full px-2 py-1 text-left border rounded-lg font-mono font-semibold transition-all
                          ${isEditable
                            ? "bg-white border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed border-slate-300"
                          }
                        `}
                      />
                    </td>
                    <td className="px-4 py-3 text-left text-slate-600 font-medium">
                      {manualUnits[activeTab]?.[k] || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>

  {/* KPI SIDEBAR */}
  <aside className="w-70 h-screen bg-gradient-to-b from-slate-100 to-white border-l border-slate-200 shadow-xl p-5 overflow-auto">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Performance KPIs</h3>
      
    </div>
    
    

    {renderLeftKPIList()}
  </aside>

  {/* MESSAGE TOAST */}
  {message && (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]
        px-6 py-3 rounded-xl text-sm font-bold shadow-2xl
        ${message.startsWith("❌")
          ? "bg-red-100 text-red-800 border-2 border-red-300"
          : message.startsWith("✅")
          ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-300"
          : "bg-amber-100 text-amber-800 border-2 border-amber-300"
        }
      `}
    >
      {message}
    </div>
  )}

  {renderConfirmPopup()}
  {renderAdjustPopup()}
</div>
);
}