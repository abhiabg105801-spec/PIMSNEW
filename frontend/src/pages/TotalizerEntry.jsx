// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";

// compact, focused Totalizer entry page with live KPI calc support

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
  const [submitting, setSubmitting] = useState(false);

  const [roleId, setRoleId] = useState(null);
  const [userName, setUserName] = useState("Unknown");
  const isAdmin = roleId === 8;
  const isHOD = roleId === 7;
  const canAdjust = isAdmin || isHOD;

  const [permissionMap, setPermissionMap] = useState({});
  const canView = (field) => permissionMap[field]?.can_view ?? true;
  const canEdit = (field) => permissionMap[field]?.can_edit ?? true;

  const [totalizersByUnit, setTotalizersByUnit] = useState({
    "Unit-1": [],
    "Unit-2": [],
    Station: [],
    "Energy-Meter": [],
  });

  const [readingsForm, setReadingsForm] = useState({});
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState(null);

  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null);

  // For live preview and caching of computed KPIs
  const [liveAutoKpis, setLiveAutoKpis] = useState({}); // keys per plant: Unit-1|Unit-2|Energy-Meter|Station -> object
  const [generationCache, setGenerationCache] = useState({}); // { date: {unit1_generation, unit2_generation} }

  // Shutdown KPIs for Unit tabs
  const [shutdownKPIs, setShutdownKPIs] = useState({
    "Unit-1": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
    "Unit-2": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
  });

  // manual KPI structures and units
  const initialManualKPI = {
    "Unit-1": { stack_emission: "" },
    "Unit-2": { stack_emission: "" },
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
    "Unit-1": { stack_emission: "mg/Nm3" },
    "Unit-2": { stack_emission: "mg/Nm3" },
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

  /* ---------------- load auth & permissions ---------------- */
  useEffect(() => {
    const payload = getTokenPayload(authHeader);
    if (payload) {
      setRoleId(payload.role_id);
      setUserName(payload.full_name || payload.sub || "User");
    } else {
      api.get("/auth/me").then((r) => {
        if (r.data?.role_id) setRoleId(r.data.role_id);
        if (r.data?.full_name) setUserName(r.data.full_name);
      }).catch(()=>{});
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
      } catch {}
    }
    loadPerm();
  }, [api]);

  /* ---------------- master + readings load ---------------- */
  const loadMasterForUnit = useCallback(async (unit) => {
    try {
      const r = await api.get("/totalizers/list", { params: { unit } });
      const items = r.data || [];
      setTotalizersByUnit((prev) => ({ ...prev, [unit]: items }));

      setReadingsForm((prev) => {
        const updated = { ...prev };
        items.forEach((t) => {
          if (!updated[t.id]) {
            updated[t.id] = {
              today: "",
              adjust: 0,
              yesterday: "—",
              difference: "—",
              display_name: t.display_name,
              name: t.name,
              unit: t.unit || unit,
              totalizer_id: t.id,
              _orig: { today: "", adjust: 0 },
            };
          } else {
            updated[t.id].display_name = t.display_name;
            updated[t.id].name = t.name;
            updated[t.id].unit = t.unit || unit;
          }
        });
        return updated;
      });

      // load readings for this date
      await loadTodayReadings(reportDate, unit, items);
      await loadYesterday(reportDate, unit, items);
    } catch (e) {
      console.error("loadMasterForUnit error:", e);
    }
  }, [api, reportDate]);

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
    loadMasterForUnit("Energy-Meter");
  }, [loadMasterForUnit]);

  const loadTodayReadings = useCallback(async (forDate, unit, itemsParam = null) => {
    try {
      const res = await api.get("/totalizers/readings", { params: { date: forDate } });
      const rows = res.data || [];
      const rowMap = {};
      let lastUpdate = null;

      rows.forEach((r) => {
        rowMap[r.totalizer_id] = { today: Number(r.reading_value || 0), adjust: Number(r.adjust_value || 0) };
        if (!lastUpdate && r.updated_at) {
          lastUpdate = { at: r.updated_at, by: r.username || "Unknown" };
        }
      });

      setLastUpdatedInfo(lastUpdate);

      setReadingsForm((prev) => {
        const updated = { ...prev };
        const items = itemsParam || (totalizersByUnit[unit] || []);
        items.forEach((t) => {
          const rec = updated[t.id] || {
            today: "",
            adjust: 0,
            yesterday: "—",
            difference: "—",
            display_name: t.display_name,
            name: t.name,
            unit: t.unit || unit,
            totalizer_id: t.id,
            _orig: { today: "", adjust: 0 },
          };

          if (rowMap[t.id] !== undefined) {
            rec.today = rowMap[t.id].today;
            rec.adjust = rowMap[t.id].adjust;
            rec._orig = { today: rec.today, adjust: rec.adjust };
          } else {
            rec.today = "";
            rec.adjust = rec._orig?.adjust ?? 0;
          }

          // difference will be recomputed after yesterday load
          if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
          updated[t.id] = { ...rec };
        });
        return updated;
      });
    } catch (e) {
      console.error("loadTodayReadings error:", e);
    }
  }, [api, totalizersByUnit]);

  const loadYesterday = useCallback(async (forDate, unit, itemsParam = null) => {
    try {
      const d = new Date(forDate);
      d.setDate(d.getDate() - 1);
      const y = d.toLocaleDateString("en-CA");

      const res = await api.get("/totalizers/readings", { params: { date: y } });
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
      // mark yesterday unknown
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

  /* ---------------- Load KPIs and Manual KPIs ---------------- */

  // Load manual KPIs for a tab (prefill values)
  const loadManualKPIForActiveTab = useCallback(async () => {
    const emptyState = JSON.parse(JSON.stringify(initialManualKPI[activeTab] || {}));
    try {
      const r = await api.get("/kpi/get", {
        params: { date: reportDate, kpi_type: "manual", plant_name: activeTab },
      });
      const fetched = {};
      (r.data?.kpis || []).forEach((k) => {
        fetched[k.name] = k.value;
      });
      setManualKPI((prev) => ({ ...prev, [activeTab]: { ...emptyState, ...fetched } }));
    } catch (e) {
      setManualKPI((prev) => ({ ...prev, [activeTab]: emptyState }));
    }
  }, [api, activeTab, reportDate]);

  // Load station energy KPIs (generation cache) so energy calculations prefer DB values
  const loadGenerationCacheForDate = useCallback(async (dateStr) => {
    if (generationCache[dateStr]) return generationCache[dateStr];
    try {
      // backend expects kpi_type=energy & plant_name=station (lowercase)
      const r = await api.get("/kpi/get", {
        params: { date: dateStr, kpi_type: "energy", plant_name: "station" },
      });
      const out = {};
      (r.data?.kpis || []).forEach((k) => { out[k.name] = Number(k.value || 0); });
      setGenerationCache((prev) => ({ ...prev, [dateStr]: out }));
      return out;
    } catch (e) {
      setGenerationCache((prev) => ({ ...prev, [dateStr]: {} }));
      return {};
    }
  }, [api, generationCache]);

  // load shutdown kpis for unit
  const loadShutdownKPIsForUnitDate = useCallback(async (unitKey, dateStr) => {
    try {
      const res = await api.get(`/kpi/${encodeURIComponent(unitKey)}/${encodeURIComponent(dateStr)}`);
      if (res.status === 200 && res.data) {
        setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { ...prev[unitKey], ...res.data } }));
      } else {
        setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { running_hour: 24, plant_availability_percent: 100, planned_outage_hour: 0, planned_outage_percent: 0, strategic_outage_hour: 0 } }));
      }
    } catch (err) {
      setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { running_hour: 24, plant_availability_percent: 100, planned_outage_hour: 0, planned_outage_percent: 0, strategic_outage_hour: 0 } }));
    }
  }, [api]);

  /* ---------------- Live KPI calculation on input changes ---------------- */

  // build readings array for activeTab from readingsForm
  const buildReadingsArrayForActiveTab = useCallback((unit) => {
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

  // call /kpi/calc to compute live auto-kpis for activeTab and store in liveAutoKpis
  const computeLiveAutoForActive = useCallback(async (unit) => {
    try {
      const readings = buildReadingsArrayForActiveTab(unit);
      const payload = { date: reportDate, plant_name: unit, readings };
      const r = await api.post("/kpi/calc", payload);
      const out = r.data?.auto_kpis || {};
      setLiveAutoKpis((prev) => ({ ...prev, [unit]: out }));
      // if energy-meter returned generation values, cache them for this date
      if (unit === "Energy-Meter") {
        setGenerationCache((prev) => ({ ...prev, [reportDate]: { ...(prev[reportDate] || {}), unit1_generation: out.unit1_generation || 0, unit2_generation: out.unit2_generation || 0 } }));
      }
      // for Station, nothing special
      return out;
    } catch (e) {
      // swallow error; leave previous liveAutoKpis intact
      console.error("kpi/calc error:", e);
      setLiveAutoKpis((prev) => ({ ...prev, [unit]: prev[unit] || {} }));
      return prev[unit] || {};
    }
  }, [api, reportDate, buildReadingsArrayForActiveTab]);

  // compute live KPIs whenever readingsForm changes for activeTab
  useEffect(() => {
    // debounce briefly to avoid too many calls
    const t = setTimeout(() => {
      computeLiveAutoForActive(activeTab);
    }, 200);
    return () => clearTimeout(t);
  }, [computeLiveAutoForActive, activeTab, readingsForm]);

  /* ----------------- helpers to update fields ----------------- */
  const updateField = (id, field, value) => {
    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      rec[field] = value === "" ? "" : Number(value);

      if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
      else {
        const adj = canAdjust ? Number(rec.adjust || 0) : 0;
        rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
      }

      return { ...prev, [id]: rec };
    });
  };

  const updateManualField = (unit, field, value) => {
    setManualKPI((prev) => ({
      ...prev,
      [unit]: { ...prev[unit], [field]: value === "" ? "" : Number(value) },
    }));
  };

  const getDiff = (name, unitFilter = null) => {
    const unitToUse = unitFilter || activeTab;
    const rec = Object.values(readingsForm).find((r) => r.name === name && (r.unit || "").toString() === unitToUse);
    if (!rec) return 0;
    if (!rec.difference || rec.difference === "—") return 0;
    return Number(rec.difference) || 0;
  };

  /* ---------------- compute local KPI objects for rendering using liveAutoKpis or local computation fallback ---------------- */

  const EM = {
    u1_lsr01_ic1: "1lsr01_ic1",
    u1_lsr02_ic1: "1lsr02_ic1",
    u2_lsr01_ic1: "2lsr01_ic1",
    u2_lsr02_ic1: "2lsr02_ic1",
    rlsr01: "rlsr01",
    rlsr02: "rlsr02",
    rlsr03: "rlsr03",
    rlsr04: "rlsr04",
    sst_10: "SST_10",
    ust_15: "UST_15",
    ust_25: "UST_25",
    tie_1: "1lsr01_ic2_tie",
    tie_2: "1lsr02_ic2_tie",
    tie_3: "2lsr01_ic2_tie",
    tie_4: "2lsr02_ic2_tie",
    unit1_gen: "unit1_gen",
    unit2_gen: "unit2_gen",
  };

  // Energy KPIs: prefer server-calculated liveAutoKpis then fallback to local getDiff-based computation
  const energyKPI = useMemo(() => {
    const live = liveAutoKpis["Energy-Meter"] || {};
    if (Object.keys(live).length > 0) return live;

    // fallback local compute (older behavior)
    try {
      const unit1_unit_aux_mwh = getDiff(EM.u1_lsr01_ic1, "Energy-Meter") + getDiff(EM.u1_lsr02_ic1, "Energy-Meter");
      const unit2_unit_aux_mwh = getDiff(EM.u2_lsr01_ic1, "Energy-Meter") + getDiff(EM.u2_lsr02_ic1, "Energy-Meter");

      const total_station_aux =
        getDiff(EM.rlsr01, "Energy-Meter") +
        getDiff(EM.rlsr02, "Energy-Meter") +
        getDiff(EM.rlsr03, "Energy-Meter") +
        getDiff(EM.rlsr04, "Energy-Meter") +
        getDiff(EM.sst_10, "Energy-Meter") +
        getDiff(EM.ust_15, "Energy-Meter") +
        getDiff(EM.ust_25, "Energy-Meter");

      const total_station_tie =
        getDiff(EM.tie_1, "Energy-Meter") +
        getDiff(EM.tie_2, "Energy-Meter") +
        getDiff(EM.tie_3, "Energy-Meter") +
        getDiff(EM.tie_4, "Energy-Meter");

      const unit1_aux_consumption = unit1_unit_aux_mwh + (total_station_aux + total_station_tie) / 2;
      const unit2_aux_consumption = unit2_unit_aux_mwh + (total_station_aux + total_station_tie) / 2;

      const genCache = generationCache[reportDate] || {};
      const unit1_gen = genCache.unit1_generation ?? getDiff(EM.unit1_gen, "Energy-Meter");
      const unit2_gen = genCache.unit2_generation ?? getDiff(EM.unit2_gen, "Energy-Meter");

      const unit1_plf = unit1_gen > 0 ? (unit1_gen / 3000) * 100 : 0;
      const unit2_plf = unit2_gen > 0 ? (unit2_gen / 3000) * 100 : 0;
      const station_plf = (unit1_gen + unit2_gen) > 0 ? ((unit1_gen + unit2_gen) / 3000) * 100 : 0;

      const unit1_aux_percent = unit1_gen > 0 ? (unit1_aux_consumption / unit1_gen) * 100 : 0;
      const unit2_aux_percent = unit2_gen > 0 ? (unit2_aux_consumption / unit2_gen) * 100 : 0;

      return {
        unit1_generation: Number((unit1_gen || 0).toFixed(3)),
        unit2_generation: Number((unit2_gen || 0).toFixed(3)),
        unit1_unit_aux_mwh: Number(unit1_unit_aux_mwh.toFixed(3)),
        unit2_unit_aux_mwh: Number(unit2_unit_aux_mwh.toFixed(3)),
        total_station_aux_mwh: Number(total_station_aux.toFixed(3)),
        total_station_tie_mwh: Number(total_station_tie.toFixed(3)),
        unit1_aux_consumption_mwh: Number(unit1_aux_consumption.toFixed(3)),
        unit1_aux_percent: Number(unit1_aux_percent.toFixed(3)),
        unit2_aux_consumption_mwh: Number(unit2_aux_consumption.toFixed(3)),
        unit2_aux_percent: Number(unit2_aux_percent.toFixed(3)),
        unit1_plf: Number(unit1_plf.toFixed(3)),
        unit2_plf: Number(unit2_plf.toFixed(3)),
        station_plf: Number(station_plf.toFixed(3)),
      };
    } catch (e) {
      console.error(e);
      return {};
    }
  }, [generationCache, reportDate, readingsForm, liveAutoKpis]);

  // Unit KPI: prefer server-calculated liveAutoKpis for Unit-1/2
  const localUnitKPI = useMemo(() => {
    const live = liveAutoKpis[activeTab] || {};
    if (activeTab === "Unit-1" || activeTab === "Unit-2") {
      if (Object.keys(live).length > 0) return {
        coal: live.coal_consumption || 0,
        specificCoal: live.specific_coal || 0,
        ldo: live.oil_consumption || 0,
        specificOil: live.specific_oil || 0,
        dm: live.dm_water || 0,
        steam: live.steam_consumption || 0,
        specificDM: live.specific_dm_percent || 0,
        gen: (generationCache[reportDate] || {})[(activeTab === "Unit-1" ? "unit1_generation" : "unit2_generation")] || 0,
        specificSteam: live.specific_steam || 0,
        plf: ((generationCache[reportDate] || {})[(activeTab === "Unit-1" ? "unit1_generation" : "unit2_generation")] || 0) > 0 ? (((generationCache[reportDate] || {})[(activeTab === "Unit-1" ? "unit1_generation" : "unit2_generation")] / 3000) * 100) : 0,
      };
    }
    // fallback compute using getDiff (older behavior)
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
      const gen = (generationCache[reportDate] || {})[(activeTab === "Unit-1") ? "unit1_generation" : "unit2_generation"] ?? getDiff((activeTab==="Unit-1") ? "unit1_gen":"unit2_gen", "Energy-Meter");
      const specificCoal = gen > 0 ? Number((coal / gen).toFixed(6)) : 0;
      const specificOil = gen > 0 ? Number((ldo / gen).toFixed(6)) : 0;
      const specificDM = steam > 0 ? Number(((dm / steam) * 100).toFixed(3)) : 0;
      const specificSteam = gen > 0 ? Number((steam / gen).toFixed(6)) : 0;
      const plf = gen > 0 ? Number(((gen / 3000) * 100).toFixed(3)) : 0;
      return { coal, specificCoal, ldo, specificOil, dm, steam, specificDM, gen, specificSteam, plf };
    } catch (e) {
      return {};
    }
  }, [readingsForm, generationCache, reportDate, activeTab, liveAutoKpis]);

  const stationKPIsLocal = useMemo(() => {
    const live = liveAutoKpis["Station"] || {};
    if (Object.keys(live).length > 0) return {
      total_raw_water: live.total_raw_water_used_m3 || 0,
      avg_raw_per_hr: live.avg_raw_water_m3_per_hr || 0,
      total_dm: live.total_dm_water_used_m3 || 0,
      sp_raw_l_per_kwh: live.sp_raw_water_l_per_kwh || 0,
      gen1: (generationCache[reportDate] || {}).unit1_generation || 0,
      gen2: (generationCache[reportDate] || {}).unit2_generation || 0,
      sum_gen: ((generationCache[reportDate] || {}).unit1_generation || 0) + ((generationCache[reportDate] || {}).unit2_generation || 0),
    };
    // fallback
    const total_raw_water = getDiff("raw_water", "Station");
    const avg_raw_per_hr = Number((total_raw_water / 24.0).toFixed(3));
    const u1_dm = getDiff("dm7", "Unit-1") + getDiff("dm11", "Unit-1");
    const u2_dm = getDiff("dm7", "Unit-2") + getDiff("dm11", "Unit-2");
    const total_dm = Number((u1_dm + u2_dm).toFixed(3));
    const gen1 = (generationCache[reportDate] || {}).unit1_generation ?? getDiff("unit1_gen", "Energy-Meter");
    const gen2 = (generationCache[reportDate] || {}).unit2_generation ?? getDiff("unit2_gen", "Energy-Meter");
    const sum_gen = gen1 + gen2;
    const sp_raw_l_per_kwh = sum_gen > 0 ? Number(((total_raw_water * 1000) / sum_gen).toFixed(3)) : 0;
    return { total_raw_water, avg_raw_per_hr, total_dm, sp_raw_l_per_kwh, gen1, gen2, sum_gen };
  }, [readingsForm, generationCache, reportDate, liveAutoKpis]);

  /* ---------------- Submit flow ---------------- */

  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);

  const getChangedList = (unit) => {
    const list = [];
    const items = totalizersByUnit[unit] || [];
    items.forEach((t) => {
      const rec = readingsForm[t.id];
      if (!rec) return;
      const orig = rec._orig || { today: "", adjust: 0 };
      if (String(rec.today) !== String(orig.today) && rec.today !== "") {
        list.push({ label: rec.display_name, value: rec.today, id: t.id });
      } else if (canAdjust && String(rec.adjust) !== String(orig.adjust)) {
        list.push({ label: rec.display_name + " (Adj)", value: rec.adjust, id: t.id });
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
    setShowConfirmPopup(true);
  };

  const hasManualKPIChange = () => {
    const currentManuals = manualKPI[activeTab] || {};
    return Object.values(currentManuals).some((v) => v !== "" && v !== null && v !== undefined);
  };

  const confirmSubmit = async () => {
    setShowConfirmPopup(false);
    setSubmitting(true);
    setMessage("");

    try {
      const items = totalizersByUnit[activeTab] || [];

      // ---- 1) STORE TOTALIZER READINGS ----
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
        })).filter(m=>m.value !== null)
      };

      await api.post("/submit", payload);

      // update local _orig values
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

      // After saving, reload caches and KPIs to show persisted values
      await loadYesterday(reportDate, activeTab, totalizersByUnit[activeTab]);
      // reload generation cache & manual KPIs
      await loadGenerationCacheForDate(reportDate);
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        await loadShutdownKPIsForUnitDate(activeTab, reportDate);
      }

      // Recompute live KPIs (ensures UI reflects persisted server-side calcs)
      await computeLiveAutoForActive(activeTab);

    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err?.response?.data?.detail || "Save error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Reset / Seed helpers ---------------- */
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
    setManualKPI((prev) => ({ ...prev, [activeTab]: Object.fromEntries(Object.keys(prev[activeTab] || {}).map(k => [k, ""])) }));
    setMessage("⚠️ Inputs reset.");
  };

  const handleSeedMaster = async () => {
    setMessage("Loading previous day's closing readings...");
    setSubmitting(true);
    try {
      const d = new Date(reportDate);
      d.setDate(d.getDate() - 1);
      const y = d.toLocaleDateString("en-CA");

      const res = await api.get("/totalizers/readings", { params: { date: y } });
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
      setMessage("❌ Failed to seed readings.");
    } finally {
      setSubmitting(false);
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

  /* ---------------- UI render helpers ---------------- */

  const renderLeftKPIList = () => {
    const singleRow = (label, value, unit = "") => (
      <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-1 transition-colors rounded">
        <div className="text-xs text-gray-600 font-medium">{label}</div>
        <div className="text-sm font-bold text-gray-800">
          {value} <span className="text-xs text-orange-500 font-normal ml-0.5">{unit}</span>
        </div>
      </div>
    );

    if (activeTab === "Unit-1" || activeTab === "Unit-2") {
      const u = localUnitKPI;
      const sKPI = shutdownKPIs[activeTab] || {};
      return (
        <div className="space-y-0.2">
          <div className="text-xs font-bold text-gray-800 uppercase bg-gray-100 p-1 rounded mb-1">Unit Performance</div>
          {singleRow("Daily Generation", (u.gen || 0).toFixed(3), "MWh")}
          {singleRow("PLF", (u.plf || 0).toFixed(2), "%")}
          {singleRow("Running Hour", sKPI.running_hour !== null ? Number(sKPI.running_hour).toFixed(2) : "—", "hr")}
          {singleRow("Availability", sKPI.plant_availability_percent !== null ? Number(sKPI.plant_availability_percent).toFixed(2) : "—", "%")}
          {singleRow("Planned Out", sKPI.planned_outage_hour !== null ? Number(sKPI.planned_outage_hour).toFixed(2) : "—", "hr")}
          {singleRow("Strategic Out", sKPI.strategic_outage_hour !== null ? Number(sKPI.strategic_outage_hour).toFixed(2) : "—", "hr")}

          <div className="text-xs font-bold text-gray-800 uppercase bg-gray-100 p-2 rounded mb-1 mt-4">Fuel & Utilities</div>
          {singleRow("Coal Cons.", (u.coal || 0).toFixed(3), "ton")}
          {singleRow("Specific Coal", (u.specificCoal || 0).toFixed(6), "ton/MWh")}
          {singleRow("LDO Cons.", (u.ldo || 0).toFixed(3), "L")}
          {singleRow("Specific Oil", (u.specificOil || 0).toFixed(6), "L/MWh")}
          {singleRow("Steam Cons.", (u.steam || 0).toFixed(3), "kg")}
          {singleRow("Specific Steam", (u.specificSteam || 0).toFixed(6), "kg/MWh")}
          {singleRow("DM Water", (u.dm || 0).toFixed(3), "m3")}
          {singleRow("Sp. DM %", (u.specificDM || 0).toFixed(3), "%")}
        </div>
      );
    }

    if (activeTab === "Station") {
      const s = stationKPIsLocal;
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-gray-800 uppercase bg-gray-100 p-2 rounded mb-1">Station KPIs</div>
          {singleRow("Station PLF", ((s.gen1 + s.gen2) > 0 ? (((s.gen1 + s.gen2) / 3000) * 100).toFixed(2) : "0.00"), "%")}
          {singleRow("Total Raw Water", (s.total_raw_water || 0).toFixed(3), "m3")}
          {singleRow("Avg Raw Water/hr", (s.avg_raw_per_hr || 0).toFixed(3), "m3/hr")}
          {singleRow("Total DM Water", (s.total_dm || 0).toFixed(3), "m3")}
          {singleRow("Sp Raw Water", (s.sp_raw_l_per_kwh || 0).toFixed(3), "L/kWh")}
          {/* generation numbers are intentionally removed from Station tab display per requirement */}
        </div>
      );
    }

    if (activeTab === "Energy-Meter") {
      const ek = energyKPI || {};
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-gray-800 uppercase bg-gray-100 p-2 rounded mb-1">Energy KPIs</div>
          {singleRow("U1 Gen", (ek.unit1_generation || 0).toFixed(3), "MWh")}
          {singleRow("U2 Gen", (ek.unit2_generation || 0).toFixed(3), "MWh")}
          {singleRow("U1 PLF", (ek.unit1_plf || ek.unit1_plf_percent || 0).toFixed(2), "%")}
          {singleRow("U2 PLF", (ek.unit2_plf || ek.unit2_plf_percent || 0).toFixed(2), "%")}
          {singleRow("Station PLF", (ek.station_plf_percent || ek.station_plf || 0).toFixed(2), "%")}
          {singleRow("U1 Aux %", (ek.unit1_aux_percent || 0).toFixed(2), "%")}
          {singleRow("U2 Aux %", (ek.unit2_aux_percent || 0).toFixed(2), "%")}
          {singleRow("Station Aux", (ek.total_station_aux_mwh || 0).toFixed(3), "MWh")}
          {singleRow("Tie Export", (ek.total_station_tie_mwh || 0).toFixed(3), "MWh")}
        </div>
      );
    }

    return null;
  };

  /* ---------------- Table render ---------------- */

  const currentTotalizers = totalizersByUnit[activeTab] || [];

  const renderTotalizerTable = () => (
    <div className="overflow-auto rounded-md border border-gray-200">
      <table className="min-w-full table-auto">
        <thead className="bg-gray-50 text-xs text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left w-64">Totalizer</th>
            <th className="px-2 py-2 text-right w-28">Yesterday</th>
            <th className="px-2 py-2 text-right w-48">Today</th>
            <th className="px-2 py-2 text-right w-28">Diff</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {currentTotalizers.filter(t => canView(t.name)).map((t) => {
            const rec = readingsForm[t.id];
            if (!rec) return null;
            const isEditable = canEdit(t.name);
            const hasAdjustment = rec.adjust && rec.adjust !== 0;

            return (
              <tr key={t.id} className="odd:bg-white even:bg-gray-50 hover:bg-orange-50 transition-colors">
                <td className="px-3 py-2 text-sm text-gray-700">
                  <div className="font-medium">{t.display_name}</div>
                  <div className="text-xs text-gray-400">{rec.unit}</div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs text-gray-600">{rec.yesterday}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    step="0.001"
                    value={rec.today === "" ? "" : rec.today}
                    onChange={(e) => updateField(t.id, "today", e.target.value)}
                    onDoubleClick={() => canAdjust && handleAdjustClick({ id: t.id, adjust: rec.adjust || 0 })}
                    readOnly={!isEditable}
                    title={canAdjust ? "Double click to adjust" : ""}
                    placeholder={isEditable ? "" : "N/A"}
                    className={`w-40 text-right text-base px-2 py-1 rounded border text-gray-800 ${isEditable ? "border-orange-200 focus:ring-2 focus:ring-orange-400 focus:border-orange-500" : "bg-gray-100 border-gray-200"}`}
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono text-sm text-gray-800 relative">
                  {rec.difference}
                  {hasAdjustment && (
                    <span className="text-orange-500 font-bold ml-1 text-xs" title={`Adjustment: ${rec.adjust}`}>*</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <td colSpan="4" className="px-3 py-2 text-right">
               {lastUpdatedInfo ? (
                 <>Last updated: <strong>{new Date(lastUpdatedInfo.at).toLocaleString()}</strong> by <strong>{lastUpdatedInfo.by}</strong></>
               ) : (
                 <span>No update history for this date</span>
               )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  /* ---------------- confirm & adjust popups ---------------- */

  const renderConfirmPopup = () => {
    if (!showConfirmPopup) return null;
    const changedManualKPIs = Object.entries(manualKPI[activeTab] || {}).filter(([k, v]) => v !== "" && v !== null && v !== undefined);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-orange-600">Confirm Submission</h3>
            <button onClick={() => setShowConfirmPopup(false)} className="text-sm text-gray-500">Close</button>
          </div>

          <div className="max-h-64 overflow-auto border rounded p-2 bg-gray-50">
            <div className="mb-2 text-sm text-gray-700">Date: <strong>{reportDate}</strong> — <strong>{activeTab}</strong></div>

            <div className="mb-2">
              <div className="font-medium text-gray-800 text-sm mb-1">Totalizer Readings</div>
              {confirmList.length > 0 ? (
                <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
                  {confirmList.map((c, i) => <li key={i}><strong>{c.label}</strong>: {c.value}</li>)}
                </ul>
              ) : <div className="text-sm text-gray-500 italic">No totalizer changes</div>}
            </div>

            {changedManualKPIs.length > 0 && (
              <div className="mt-3">
                <div className="font-medium text-gray-800 text-sm mb-1">Manual KPIs</div>
                <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
                  {changedManualKPIs.map(([key, value], idx) => (
                    <li key={idx}>
                      <strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>: {value} {manualUnits[activeTab]?.[key] || ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end space-x-2">
            <button onClick={() => setShowConfirmPopup(false)} className="px-3 py-1 rounded border text-sm">Cancel</button>
            <button onClick={confirmSubmit} disabled={submitting} className="px-4 py-1 rounded bg-orange-600 text-white text-sm">
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
          <h4 className="text-lg font-semibold mb-3">Edit Adjustment - {rec.display_name}</h4>
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
              className="w-full px-2 py-1 border rounded mt-1 focus:border-orange-500 outline-none"
              autoFocus
            />
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button onClick={() => setShowAdjustPopup(false)} className="px-3 py-1 rounded border text-sm">Cancel</button>
            <button onClick={saveAdjust} className="px-3 py-1 rounded bg-orange-600 text-white text-sm">Save</button>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- layout & render ---------------- */

  useEffect(() => {
    (async () => {
      const items = totalizersByUnit[activeTab] || [];
      await loadTodayReadings(reportDate, activeTab, items);
      await loadYesterday(reportDate, activeTab, items);
      await loadGenerationCacheForDate(reportDate);
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        await loadShutdownKPIsForUnitDate(activeTab, reportDate);
      }
      // compute live KPIs for the tab
      await computeLiveAutoForActive(activeTab);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, activeTab, totalizersByUnit]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setMessage("");
  }, [activeTab, reportDate]);

  const handleDateChange = (days) => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() + days);
    setReportDate(d.toLocaleDateString("en-CA"));
  };

  /* ---------------- UI return ---------------- */

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      {renderConfirmPopup()}
      {renderAdjustPopup()}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10"></path></svg>
            Totalizer Daily Entry
          </h1>
          <div className="text-xs text-gray-500">
            User: <strong>{userName}</strong> | Date: <strong>{reportDate}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded bg-white overflow-hidden">
             <button onClick={() => handleDateChange(-1)} className="px-2 py-1 hover:bg-gray-100 border-r" title="Previous Day">◀</button>
             <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="px-2 py-1 text-sm outline-none border-none" />
             <button onClick={() => handleDateChange(1)} className="px-2 py-1 hover:bg-gray-100 border-l" title="Next Day">▶</button>
          </div>

          <button onClick={handleSeedMaster} className="px-3 py-1 rounded bg-gray-200 text-sm hover:bg-gray-300">Seed</button>
          <button onClick={handleResetForm} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">Reset</button>
          <button onClick={handleSubmitClick} className="px-3 py-1 rounded bg-orange-600 text-white text-sm hover:bg-orange-700">{submitting ? "Saving..." : "Submit"}</button>
        </div>
      </div>

      {message && (
        <div className={`p-2 mb-3 rounded text-sm ${message.startsWith("❌") ? "bg-red-100 text-red-700" : message.startsWith("✅") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
          {message}
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-md px-2">
        {["Unit-1", "Unit-2", "Station", "Energy-Meter"].map(tab => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === tab ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" }`}
            >
                {tab}
            </button>
        ))}
      </div>

      <div className="flex gap-4">
        <aside className="w-80 bg-white border rounded p-4 shadow-sm sticky top-4 h-[calc(100vh-180px)] overflow-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">KPIs</h3>
            {/* show spinner for live calc */}
            <div>{/* reserved */}</div>
          </div>
          <div className="h-px bg-gray-100 mb-3" />
          {renderLeftKPIList()}
        </aside>

        <main className="flex-1 overflow-hidden">
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">{activeTab} Readings</h2>
              <div className="text-xs text-gray-500">{currentTotalizers.length} totalizers</div>
            </div>

            <div className="mb-3">
              {currentTotalizers.length > 0 ? renderTotalizerTable() : (
                <div className="p-6 text-center text-gray-500 border border-dashed rounded">No totalizers found for {activeTab}</div>
              )}
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Manual KPIs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(manualKPI[activeTab] || {}).map(([kname, val]) => (
                  <div key={kname} className="p-2 border rounded text-sm bg-white hover:border-orange-300 transition-colors">
                    <div className="text-xs text-gray-600 mb-1 font-medium">{kname.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-xs text-gray-400 font-normal">({manualUnits[activeTab]?.[kname] || ""})</span></div>
                    <input
                      type="number"
                      step="0.001"
                      value={val === "" || val === null || val === undefined ? "" : val}
                      onChange={(e) => updateManualField(activeTab, kname, e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
                      placeholder="Enter value"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
