// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";

/**
 * TotalizerEntryPage — STYLE 2 Compact + Professional
 *
 * Notes:
 *  - Backend endpoints expected: same as before
 *  - Auto-recalculates server KPIs after every submit across relevant plants
 *  - Manual KPI loader is robust to several response shapes
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

  const [totalizersByUnit, setTotalizersByUnit] = useState({
    "Unit-1": [],
    "Unit-2": [],
    Station: [],
    "Energy-Meter": [],
  });

  const [readingsForm, setReadingsForm] = useState({});
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState(null);

  const [serverKPIs, setServerKPIs] = useState({
    "Unit-1": null,
    "Unit-2": null,
    Station: null,
  });

  const [energyCache, setEnergyCache] = useState({});
  const [shutdownKPIs, setShutdownKPIs] = useState({
    "Unit-1": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
    "Unit-2": { running_hour: null, plant_availability_percent: null, planned_outage_hour: null, planned_outage_percent: null, strategic_outage_hour: null },
  });

  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null);

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

  const renderLeftKPIList = () => {
  const kpiGroup = [];

  if (activeTab === "Unit-1" || activeTab === "Unit-2") {
    kpiGroup.push(
      { key: "coal_consumption", label: "Coal Consumption (T)" },
      { key: "specific_coal", label: "Specific Coal (T/MWh)" },
      { key: "oil_consumption", label: "Oil Consumption (L)" },
      { key: "specific_oil", label: "Specific Oil (L/MWh)" },
      { key: "dm_water", label: "DM Water (m³)" },
      { key: "steam_consumption", label: "Steam (kg)" },
      { key: "specific_steam", label: "Specific Steam (kg/MWh)" },
      { key: "specific_dm_percent", label: "Specific DM (%)" },
      { key: "running_hour", label: "Running Hours" },
      { key: "plant_availability_percent", label: "Availability (%)" },
      { key: "planned_outage_hour", label: "Planned Outage (Hr)" },
      { key: "planned_outage_percent", label: "Planned Outage (%)" },
      { key: "strategic_outage_hour", label: "Strategic Outage (Hr)" },
      { key: "strategic_outage_percent", label: "Strategic Outage (%)" },
    );
  }

  if (activeTab === "Station") {
    kpiGroup.push(
      { key: "total_raw_water_used_m3", label: "Raw Water Used (m³)" },
      { key: "avg_raw_water_m3_per_hr", label: "Raw Water / Hr (m³)" },
      { key: "sp_raw_water_l_per_kwh", label: "SP Raw Water (L/kWh)" },
      { key: "total_dm_water_used_m3", label: "Total DM (m³)" },
    );
  }

  if (activeTab === "Energy-Meter") {
    kpiGroup.push(
      { key: "unit1_generation", label: "Unit-1 Generation (MWh)" },
      { key: "unit2_generation", label: "Unit-2 Generation (MWh)" },
      { key: "unit1_unit_aux_mwh", label: "Unit-1 Aux (MWh)" },
      { key: "unit2_unit_aux_mwh", label: "Unit-2 Aux (MWh)" },
      { key: "total_station_aux_mwh", label: "Station Aux (MWh)" },
      { key: "total_station_tie_mwh", label: "Station Tie (MWh)" },
      { key: "unit1_aux_consumption_mwh", label: "U1 Aux Cons (MWh)" },
      { key: "unit1_aux_percent", label: "U1 Aux (%)" },
      { key: "unit2_aux_consumption_mwh", label: "U2 Aux Cons (MWh)" },
      { key: "unit2_aux_percent", label: "U2 Aux (%)" },
      { key: "unit1_plf_percent", label: "U1 PLF (%)" },
      { key: "unit2_plf_percent", label: "U2 PLF (%)" },
      { key: "station_plf_percent", label: "Station PLF (%)" },
    );
  }

  return (
    <div className="space-y-2">
      {kpiGroup.map((k) => {
        const val = renderKpiValue(k.key);
        return (
          <div key={k.key} className="p-2 border rounded shadow-sm bg-white">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-lg font-semibold text-gray-800">
              {val ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
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
      } catch (e) {}
    }
    loadPerm();
  }, [api]);

  /* ---------------- master + readings load ---------------- */

  const loadMasterForUnit = useCallback(async (unit) => {
    try {
      const r = await api.get(`/totalizers/${encodeURIComponent(unit)}/master`);
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

      await loadTodayReadings(reportDate, unit, items);
      await loadYesterdayReadings(reportDate, unit, items);
    } catch (e) {
      console.error("loadMasterForUnit error:", e);
    }
  }, [api, reportDate]);

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
    loadMasterForUnit("Energy-Meter");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // store serverKPIs for UI — Energy-Meter calculation is station-wide; map it to Station slot for display.
      if (plant === "Unit-1" || plant === "Unit-2" || plant === "Station") {
        setServerKPIs((prev) => ({ ...prev, [plant]: out }));
      } else if (plant === "Energy-Meter") {
        setServerKPIs((prev) => ({ ...prev, Station: out }));
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

  /* ---------------- Local KPI computations ---------------- */

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

  const liveEnergyKPI = useMemo(() => {
    const d = (k) => getDiff(k, "Energy-Meter");
    try {
      const unit1_unit_aux_mwh = d("1lsr01_ic1") + d("1lsr02_ic1");
      const unit2_unit_aux_mwh = d("2lsr01_ic1") + d("2lsr02_ic1");
      const total_station_aux_mwh = d("rlsr01") + d("rlsr02") + d("rlsr03") + d("rlsr04") + d("SST_10") + d("UST_15") + d("UST_25");
      const total_station_tie_mwh = d("1lsr01_ic2_tie") + d("1lsr02_ic2_tie") + d("2lsr01_ic2_tie") + d("2lsr02_ic2_tie");
      const unit1_gen = d("unit1_gen");
      const unit2_gen = d("unit2_gen");
      const unit1_aux_consumption_mwh = unit1_unit_aux_mwh + (total_station_aux_mwh + total_station_tie_mwh) / 2.0;
      const unit2_aux_consumption_mwh = unit2_unit_aux_mwh + (total_station_aux_mwh + total_station_tie_mwh) / 2.0;
      const unit1_aux_percent = unit1_gen > 0 ? (unit1_aux_consumption_mwh / unit1_gen) * 100.0 : 0.0;
      const unit2_aux_percent = unit2_gen > 0 ? (unit2_aux_consumption_mwh / unit2_gen) * 100.0 : 0.0;
      const unit1_plf_percent = unit1_gen > 0 ? (unit1_gen / 1500.0) * 100.0 : 0.0;
      const unit2_plf_percent = unit2_gen > 0 ? (unit2_gen / 1500.0) * 100.0 : 0.0;
      const station_plf_percent = (unit1_gen + unit2_gen) > 0 ? ((unit1_gen + unit2_gen) / 3000.0) * 100.0 : 0.0;

      return {
        unit1_generation: Number(unit1_gen.toFixed(3)),
        unit2_generation: Number(unit2_gen.toFixed(3)),
        unit1_unit_aux_mwh: Number(unit1_unit_aux_mwh.toFixed(3)),
        unit2_unit_aux_mwh: Number(unit2_unit_aux_mwh.toFixed(3)),
        total_station_aux_mwh: Number(total_station_aux_mwh.toFixed(3)),
        total_station_tie_mwh: Number(total_station_tie_mwh.toFixed(3)),
        unit1_aux_consumption_mwh: Number(unit1_aux_consumption_mwh.toFixed(3)),
        unit2_aux_consumption_mwh: Number(unit2_aux_consumption_mwh.toFixed(3)),
        unit1_aux_percent: Number(unit1_aux_percent.toFixed(3)),
        unit2_aux_percent: Number(unit2_aux_percent.toFixed(3)),
        unit1_plf_percent: Number(unit1_plf_percent.toFixed(3)),
        unit2_plf_percent: Number(unit2_plf_percent.toFixed(3)),
        station_plf_percent: Number(station_plf_percent.toFixed(3)),
      };
    } catch {
      return {};
    }
  }, [readingsForm]);

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

  // helper: recalc server KPIs for a list of plants sequentially
  const recalcForPlants = useCallback(async (plants = []) => {
    for (const p of plants) {
      try {
        await calculateKPIsForUnit(p);
      } catch (e) {
        console.error("recalc error for", p, e);
      }
    }
  }, [calculateKPIsForUnit]);

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

      await api.post("/totalizers/submit", payload);

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

      // reload yesterday and manual KPIs and shutdown and server KPIs for active tab
      await loadYesterdayReadings(reportDate, activeTab, totalizersByUnit[activeTab]);
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        await loadShutdownKPIsForUnitDate(activeTab, reportDate);
      }

      // --- IMPORTANT: Auto-run server recalculation for related plants to persist KPIs in DB ---
      // Energy-meter affects station-wide energy KPIs and unit generation; Unit changes should refresh Station KPIs as well.
      // We'll recalc Unit-1, Unit-2, Station, Energy-Meter to be safe (sequential).
      await recalcForPlants(["Unit-1", "Unit-2", "Station", "Energy-Meter"]);

      // reload manual KPIs (again) and server KPIs for active tab (serverKPIs are updated inside calculateKPIsForUnit)
      await loadManualKPIForActiveTab();
      if (activeTab === "Unit-1" || activeTab === "Unit-2" || activeTab === "Station") {
        await calculateKPIsForUnit(activeTab);
      } else if (activeTab === "Energy-Meter") {
        await calculateKPIsForUnit("Energy-Meter");
      }
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
    // reset manual KPI UI to initial keys for the tab (keeps any fetched values in the manualKPI state)
    setManualKPI((prev) => ({
      ...prev,
      [activeTab]: {
        ...(initialManualKPI[activeTab] || {}),
        ...(prev[activeTab] || {})
      }
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

  /* ---------------- Manual KPI loader (robust) ---------------- */

  const loadManualKPIForActiveTab = useCallback(async () => {
    try {
      const r = await api.get("/kpi/manual", {
        params: { date: reportDate, unit: activeTab }
      });

      // r.data.kpis might be array of objects with fields {kpi_name,kpi_value,unit} or {name,value,unit} or even {kpi_name,kpi_value}
      const fetched = {};
      const arr = Array.isArray(r.data?.kpis) ? r.data.kpis : (r.data && r.data.kpis === undefined && Array.isArray(r.data) ? r.data : []);
      if (Array.isArray(arr)) {
        arr.forEach((k) => {
          // several shapes supported:
          // { kpi_name, kpi_value } OR { name, value } OR { kpi_name, kpi_value, unit }
          const key = k?.kpi_name ?? k?.name ?? k?.name;
          const val = (k?.kpi_value ?? k?.value ?? k?.kpi_value ?? k?.v ?? null);
          if (key) {
            fetched[key] = (val === null || val === undefined) ? "" : Number(val);
          }
        });
      } else if (typeof r.data === "object" && r.data !== null && Object.keys(r.data).length) {
        // maybe backend returned an object mapping name->value
        Object.entries(r.data).forEach(([k, v]) => {
          if (k === "date" || k === "unit" || k === "kpis") return;
          // store only primitive numeric/string
          fetched[k] = (v === null || v === undefined) ? "" : Number(v);
        });
      }

      // ensure we always provide the initialManualKPI keys (so UI layout stable), then merge fetched keys (supports new/extra manual KPIs)
      setManualKPI((prev) => ({
        ...prev,
        [activeTab]: {
          ...(initialManualKPI[activeTab] || {}),
          ...fetched
        }
      }));
    } catch (err) {
      console.error("Manual KPI load failed", err);
      // on error fallback to initial
      setManualKPI((prev) => ({ ...prev, [activeTab]: { ...(initialManualKPI[activeTab] || {}) } }));
    }
  }, [api, activeTab, reportDate]);

  /* ---------------- KPI panel helpers ---------------- */

  const renderKpiValue = (k) => {
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

  /* ---------------- render components (compact + stylish) ---------------- */

  const currentTotalizers = totalizersByUnit[activeTab] || [];

  const renderTotalizerTable = () => (
    <div className="overflow-auto rounded-md border border-gray-200">
      <table className="min-w-full table-fixed">
        <thead className="bg-gray-100 text-xs text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left w-56">Totalizer</th>
            <th className="px-2 py-2 text-right w-20">Yesterday</th>
            <th className="px-2 py-2 text-right w-36">Today</th>
            <th className="px-2 py-2 text-right w-20">Diff</th>
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
                <td className="px-3 py-2 text-sm text-gray-800">
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
                    className={`w-full text-right text-sm px-2 py-1 rounded border ${isEditable ? "border-orange-300 focus:ring-1 focus:border-orange-400" : "bg-gray-50 border-gray-200"} outline-none`}
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
          <h4 className="text-lg font-semibold mb-2">Edit Adjustment — {rec.display_name}</h4>
          <div className="mb-2 text-xs text-gray-500">Today Reading</div>
          <div className="font-mono text-sm text-gray-800 mb-3">{rec.today === "" ? "—" : rec.today}</div>

          <div>
            <label className="text-xs text-gray-500">Adjustment Value</label>
            <input
              type="number"
              step="0.001"
              value={adjustPopupRecord.adjust}
              onChange={(e) => setAdjustPopupRecord((p) => ({ ...p, adjust: e.target.value === "" ? "" : Number(e.target.value) }))}
              className="w-full px-2 py-2 border rounded mt-2 focus:border-orange-500 outline-none"
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
    <div className="min-h-screen bg-gray-50 p-4">
      {renderConfirmPopup()}
      {renderAdjustPopup()}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10"></path></svg>
            Totalizer Daily — Compact
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

          <button onClick={handleSeedMaster} disabled={loading} className="px-3 py-1 rounded bg-gray-200 text-sm hover:bg-gray-300">Seed</button>
          <button onClick={handleResetForm} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">Reset</button>

          {(activeTab === "Unit-1" || activeTab === "Unit-2" || activeTab === "Station") && (
            <button onClick={() => calculateKPIsForUnit(activeTab)} disabled={loading} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">
              {loading ? <Spinner /> : "Calculate KPI"}
            </button>
          )}

          <button onClick={handleSubmitClick} className="px-3 py-1 rounded bg-orange-600 text-white text-sm hover:bg-orange-700">
            {submitting ? "Saving..." : "Submit"}
          </button>
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
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === tab ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" }`}
            >
                {tab}
            </button>
        ))}
      </div>

      <div className="flex gap-4">
        <aside className="w-72 bg-white border rounded p-3 shadow-sm sticky top-4 h-[calc(100vh-140px)] overflow-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">KPIs</h3>
            <div>
              {(activeTab === "Unit-1" || activeTab === "Unit-2" || activeTab === "Station") && (
                <button onClick={() => calculateKPIsForUnit(activeTab)} disabled={loading} className="px-2 py-1 text-xs bg-orange-50 rounded border text-orange-600">
                  {loading ? <Spinner size={12} /> : "Calc"}
                </button>
              )}
            </div>
          </div>
          <div className="h-px bg-gray-100 mb-3" />
          {renderLeftKPIList()}
        </aside>

        <main className="flex-1 overflow-hidden">
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">{activeTab} Readings</h2>
              <div className="text-xs text-gray-500">{currentTotalizers.length} totalizers</div>
            </div>

            <div className="mb-3">
              {currentTotalizers.length > 0 ? renderTotalizerTable() : (
                <div className="p-4 text-center text-gray-500 border border-dashed rounded">No totalizers found for {activeTab}</div>
              )}
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Manual KPIs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(manualKPI[activeTab] || {}).filter(([kname]) => kname).map(([kname, val]) => (
                  <div key={kname} className="p-2 border rounded bg-white">
                    <div className="text-xs text-gray-600 mb-1 font-medium flex items-center justify-between">
                      <div>{kname.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                      <div className="text-xs text-gray-400">{manualUnits[activeTab]?.[kname] || ""}</div>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      value={val === "" || val === null || val === undefined ? "" : val}
                      onChange={(e) => updateManualField(activeTab, kname, e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-100 outline-none"
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
