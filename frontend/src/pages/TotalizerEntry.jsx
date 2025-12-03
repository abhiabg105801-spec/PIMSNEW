// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

/* ----------------------- Auth helpers ----------------------- */
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

/* =============================================================
   MAIN PAGE
   ============================================================= */
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

  /* ----------------- UI State ----------------- */
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ----------------- Auth State ----------------- */
  const [roleId, setRoleId] = useState(null);
  const isAdmin = roleId === 8;
  const isHOD = roleId === 7;
  const canAdjust = isAdmin || isHOD;

  /* ----------------- Permissions ----------------- */
  const [permissionMap, setPermissionMap] = useState({});
  const canView = (field) => permissionMap[field]?.can_view ?? true;
  const canEdit = (field) => permissionMap[field]?.can_edit ?? true;

  /* ----------------- Master & Readings ----------------- */
  // master grouped by unit
  const [totalizersByUnit, setTotalizersByUnit] = useState({
    "Unit-1": [],
    "Unit-2": [],
    Station: [],
    "Energy-Meter": [],
  });

  // keyed by totalizer id: { today, adjust, yesterday, difference, display_name, name, unit, _orig }
  const [readingsForm, setReadingsForm] = useState({});

  /* ----------------- Adjust Popup ----------------- */
  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null); // { id, name, yesterday, today, adjust }

  /* ----------------- KPI states ----------------- */
  const [kpiLoading, setKpiLoading] = useState(false);
  // cached generation values from backend for station KPIs (unit1_generation, unit2_generation)
  const [generationCache, setGenerationCache] = useState({}); // { date: { unit1_generation, unit2_generation } }

  /* ----------------- Manual KPI state ----------------- */
  // manual KPIs per plant. keys match your requested names.
  const [manualKPI, setManualKPI] = useState({
    "Unit-1": { stack_emission: "" },
    "Unit-2": { stack_emission: "" },
    Station: { clarifier_level: "" },
    "Energy-Meter": {},
  });
  const manualUnits = {
    "Unit-1": { stack_emission: "mg/Nm3" },
    "Unit-2": { stack_emission: "mg/Nm3" },
    Station: { clarifier_level: "%" },
  };

  /* misc */
  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  /* =============================================================
     LOAD AUTH USER
     ============================================================= */
  useEffect(() => {
    const payload = getTokenPayload(authHeader);
    if (payload) {
      setRoleId(payload.role_id);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        if (r.data?.role_id) setRoleId(r.data.role_id);
      })
      .catch(() => {});
  }, [api, authHeader]);

  /* =============================================================
     LOAD PERMISSIONS
     ============================================================= */
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

  /* =============================================================
     LOAD MASTER TOTALIZERS
     - when master loaded we also initialize readingsForm entries and
       immediately load today's/yesterday's readings for that unit
     ============================================================= */
  const loadMasterForUnit = useCallback(
    async (unit) => {
      try {
        const r = await api.get("/totalizers/list", { params: { unit } });
        const items = r.data || [];
        // set master map
        setTotalizersByUnit((prev) => ({ ...prev, [unit]: items }));

        // initialize readingsForm entries (if not present)
        setReadingsForm((prev) => {
          const updated = { ...prev };
          items.forEach((t) => {
            if (!updated[t.id]) {
              updated[t.id] = {
                today: "",
                adjust: 0,
                yesterday: "—", // show dash when no yesterday
                difference: "—",
                display_name: t.display_name,
                name: t.name,
                unit: t.unit || unit, // fallback to unit param
                totalizer_id: t.id,
                _orig: { today: "", adjust: 0 },
              };
            } else {
              // preserve existing values but ensure display fields are up-to-date
              updated[t.id].display_name = t.display_name;
              updated[t.id].name = t.name;
              updated[t.id].unit = t.unit || unit;
            }
          });
          return updated;
        });

        // load today's and yesterday's readings for this unit (pass items so we don't depend on state)
        await loadTodayReadings(reportDate, unit, items);
        await loadYesterday(reportDate, unit, items);
      } catch (e) {
        console.error("loadMasterForUnit error:", e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, reportDate]
  );

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
    loadMasterForUnit("Energy-Meter");
  }, [loadMasterForUnit]);

  /* =============================================================
     LOAD TODAY'S READINGS
     - accepts optional items param (master items) so we don't rely on stale state
     ============================================================= */
  const loadTodayReadings = useCallback(
    async (forDate, unit, itemsParam = null) => {
      try {
        const res = await api.get("/totalizers/readings", { params: { date: forDate } });
        const rows = res.data || [];
        const rowMap = {};
        rows.forEach((r) => {
          rowMap[r.totalizer_id] = { today: Number(r.reading_value || 0), adjust: Number(r.adjust_value || 0) };
        });

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
              // If not found, keep previously saved _orig (so switching tabs doesn't overwrite)
              rec.today = rec._orig?.today ?? "";
              rec.adjust = rec._orig?.adjust ?? 0;
            }

            // recalc difference — only when yesterday numeric
            if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
            else {
              const adj = canAdjust ? Number(rec.adjust || 0) : 0;
              rec.difference = Number(rec.today - Number(rec.yesterday) + adj).toFixed(3);
            }

            updated[t.id] = { ...rec };
          });
          return updated;
        });
      } catch (e) {
        console.error("loadTodayReadings error:", e);
      }
    },
    [api, totalizersByUnit, canAdjust]
  );

  /* =============================================================
     LOAD YESTERDAY'S READINGS
     - accepts optional items param
     - if a totalizer has no yesterday row, we set yesterday = "—" and difference = "—"
     ============================================================= */
  const loadYesterday = useCallback(
    async (forDate, unit, itemsParam = null) => {
      try {
        const d = new Date(forDate);
        d.setDate(d.getDate() - 1);
        const y = d.toISOString().slice(0, 10);

        const res = await api.get("/totalizers/readings", { params: { date: y } });
        const rows = res.data || [];
        const rowMap = {};
        rows.forEach((r) => {
          rowMap[r.totalizer_id] = Number(r.reading_value || 0);
        });

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
        // fallback: mark all as dash
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
    },
    [api, totalizersByUnit, canAdjust]
  );

  /* =============================================================
     Load station KPIs (to pick up unit generation values)
     We'll cache by date so we don't fetch repeatedly.
     ============================================================= */
  const ensureGenerationForDate = useCallback(
    async (dateStr) => {
      if (generationCache[dateStr]) return generationCache[dateStr];
      try {
        const r = await api.get("/totalizers/kpi/get", {
          params: { date: dateStr, kpi_type: "energy", plant_name: "Station" },
        });
        // transform to map
        const out = {};
        (r.data?.kpis || []).forEach((k) => {
          out[k.name] = k.value;
        });
        setGenerationCache((prev) => ({ ...prev, [dateStr]: out }));
        return out;
      } catch {
        setGenerationCache((prev) => ({ ...prev, [dateStr]: {} }));
        return {};
      }
    },
    [api, generationCache]
  );

  /* =============================================================
     Load manual KPI for active tab
     - kpi_type = "manual"
     - plant_name = activeTab
     - we store simple name->value mapping into manualKPI[activeTab]
     ============================================================= */
  const loadManualKPIForActiveTab = useCallback(async () => {
    try {
      const r = await api.get("/totalizers/kpi/get", {
        params: { date: reportDate, kpi_type: "manual", plant_name: activeTab },
      });
      const out = {};
      (r.data?.kpis || []).forEach((k) => {
        out[k.name] = k.value;
      });
      setManualKPI((prev) => ({ ...prev, [activeTab]: { ...(prev[activeTab] || {}), ...out } }));
    } catch (e) {
      // ignore if none
    }
  }, [api, activeTab, reportDate]);

  useEffect(() => {
    // when date or tab changes, reload today's and yesterday's readings for that tab
    (async () => {
      const items = totalizersByUnit[activeTab] || [];
      await loadTodayReadings(reportDate, activeTab, items);
      await loadYesterday(reportDate, activeTab, items);
      await ensureGenerationForDate(reportDate);

      // load manual KPI for activeTab
      await loadManualKPIForActiveTab();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, activeTab]);

  // When reportDate changes we also clear non-persisted input noise but preserve _orig
  useEffect(() => {
    setReadingsForm((prev) => {
      const upd = { ...prev };
      Object.keys(upd).forEach((id) => {
        upd[id] = {
          ...upd[id],
          today: upd[id]._orig?.today ?? upd[id].today ?? "",
          adjust: upd[id]._orig?.adjust ?? upd[id].adjust ?? 0,
          difference: upd[id]._orig?.today && upd[id].yesterday && upd[id].yesterday !== "—"
            ? (Number(upd[id]._orig.today) - Number(upd[id].yesterday || 0) + Number(upd[id]._orig.adjust || 0)).toFixed(3)
            : upd[id].difference ?? "—",
        };
      });
      return upd;
    });
  }, [reportDate]);

  /* =============================================================
     Input update handler
     ============================================================= */
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

  /* =============================================================
     getDiff helper — returns difference value (number) for given totalizer name within a unit
     - name: master.name
     - unitFilter: optional
     ============================================================= */
  const getDiff = (name, unitFilter = null) => {
    const unitToUse = unitFilter || activeTab;
    const rec = Object.values(readingsForm).find((r) => r.name === name && (r.unit || "").toString() === unitToUse);
    if (!rec) return 0;
    if (!rec.difference || rec.difference === "—") return 0;
    return Number(rec.difference) || 0;
  };

  /* =============================================================
     ENERGY KPI computation (frontend)
     ============================================================= */
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

  const computeEnergyKPIObject = () => {
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

    // generation: try cache first (from station KPI), otherwise attempt to read Energy-Meter difference
    const genCache = generationCache[reportDate] || {};
    const unit1_gen = genCache.unit1_generation ?? getDiff(EM.unit1_gen, "Energy-Meter");
    const unit2_gen = genCache.unit2_generation ?? getDiff(EM.unit2_gen, "Energy-Meter");

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
    };
  };

  const energyKPI = useMemo(() => (activeTab === "Energy-Meter" ? computeEnergyKPIObject() : null), [readingsForm, activeTab, generationCache, reportDate]);

  /* =============================================================
     Unit KPI compute & save (async) - same rules as before
     ============================================================= */
  const computeUnitKPI = useCallback(
    async (unitName) => {
      // ensure we have generation numbers from station KPI cache
      const gen = await ensureGenerationForDate(reportDate);
      const unitGen = gen[unitName === "Unit-1" ? "unit1_generation" : "unit2_generation"] ?? 0;

      // feeders names are same but must be filtered by unit (we rely on getDiff(name, unit))
      const feederA = getDiff("feeder_a", unitName);
      const feederB = getDiff("feeder_b", unitName);
      const feederC = getDiff("feeder_c", unitName);
      const feederD = getDiff("feeder_d", unitName);
      const feederE = getDiff("feeder_e", unitName);
      const coalConsumption = feederA + feederB + feederC + feederD + feederE;

      const ldoConsumption = getDiff("ldo_flow", unitName);
      const dmWater = getDiff("dm7", unitName) + getDiff("dm11", unitName);
      const steam = getDiff("main_steam", unitName);

      const specificCoal = unitGen > 0 ? Number((coalConsumption / unitGen).toFixed(6)) : 0;
      const specificOil = unitGen > 0 ? Number((ldoConsumption / unitGen).toFixed(6)) : 0;
      const specificDM = steam > 0 ? Number(((dmWater / steam) * 100).toFixed(3)) : 0;

      const payloadKPIs = [
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_coal_consumption`, value: Number(coalConsumption.toFixed(3)), unit: "ton" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_specific_coal`, value: specificCoal, unit: "ton/MWh" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_ldo_consumption`, value: Number(ldoConsumption.toFixed(3)), unit: "L" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_specific_oil`, value: specificOil, unit: "L/MWh" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_dm_water_consumption`, value: Number(dmWater.toFixed(3)), unit: "m3" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_steam_generation`, value: Number(steam.toFixed(3)), unit: "kg" },
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_specific_dm_percent`, value: specificDM, unit: "%" },
        // store generation as well for reference
        { name: `${unitName.toLowerCase().replace(/\s+/g, "")}_generation`, value: Number(unitGen.toFixed(3)), unit: "MWh" },
      ];

      // save each KPI via backend upsert
      try {
        await api.post("/totalizers/kpi/store", {
          date: reportDate,
          kpi_type: "energy",
          plant_name: unitName,
          kpis: payloadKPIs,
        });
        return { success: true, payload: payloadKPIs };
      } catch (err) {
        console.error("Failed to save unit KPI:", err);
        return { success: false, error: err };
      }
    },
    [api, ensureGenerationForDate, reportDate]
  );

  /* =============================================================
     Submit flow: sends /totalizers/submit, then:
       - snapshots _orig
       - if activeTab is Unit-1 or Unit-2 -> compute & auto-save unit KPI
       - if activeTab is Energy-Meter -> compute and save station KPIs (existing logic)
       - additionally: save manual KPI inputs for current activeTab (kpi_type: "manual")
     ============================================================= */
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

    // Non-admin cannot modify existing values
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

  // helper: check whether manual KPI was changed compared to backend/original
  const hasManualKPIChange = () => {
    const currentManuals = manualKPI[activeTab] || {};
    // If any manual value is non-empty, consider changed (we don't have an orig for manual; user must Save)
    return Object.values(currentManuals).some((v) => v !== "" && v !== null && v !== undefined);
  };

  const confirmSubmit = async () => {
    setShowConfirmPopup(false);
    setSubmitting(true);
    setMessage("");

    try {
      const items = totalizersByUnit[activeTab] || [];

      const payload = {
        date: reportDate,
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
      };

      // save totalizer readings
      await api.post("/totalizers/submit", payload);

      // snapshot back (mark as originally saved)
      setReadingsForm((prev) => {
        const updated = { ...prev };
        items.forEach((t) => {
          const rec = updated[t.id];
          if (rec) {
            rec._orig = { today: rec.today, adjust: rec.adjust };
          }
        });
        return updated;
      });

      setMessage("✅ Saved successfully");

      // Auto-save KPIs for Unit-1 or Unit-2
      if (activeTab === "Unit-1" || activeTab === "Unit-2") {
        const res = await computeUnitKPI(activeTab);
        if (res.success) setMessage((m) => (m ? m + " • KPIs saved" : "✅ KPIs saved"));
        else setMessage((m) => (m ? m + " • KPI save failed" : "❌ KPI save failed"));
      }

      // If Energy-Meter tab, compute & save station KPIs as before (use computeEnergyKPIObject)
      if (activeTab === "Energy-Meter") {
        const ek = computeEnergyKPIObject();
        const kpisArr = [
          { name: "unit1_generation", value: ek.unit1_generation, unit: "MWh" },
          { name: "unit2_generation", value: ek.unit2_generation, unit: "MWh" },
          { name: "unit1_unit_aux_mwh", value: ek.unit1_unit_aux_mwh, unit: "MWh" },
          { name: "unit2_unit_aux_mwh", value: ek.unit2_unit_aux_mwh, unit: "MWh" },
          { name: "total_station_aux_mwh", value: ek.total_station_aux_mwh, unit: "MWh" },
          { name: "total_station_tie_mwh", value: ek.total_station_tie_mwh, unit: "MWh" },
          { name: "unit1_aux_consumption_mwh", value: ek.unit1_aux_consumption_mwh, unit: "MWh" },
          { name: "unit1_aux_percent", value: ek.unit1_aux_percent, unit: "%" },
          { name: "unit2_aux_consumption_mwh", value: ek.unit2_aux_consumption_mwh, unit: "MWh" },
          { name: "unit2_aux_percent", value: ek.unit2_aux_percent, unit: "%" },
        ];
        try {
          await api.post("/totalizers/kpi/store", {
            date: reportDate,
            kpi_type: "energy",
            plant_name: "Station",
            kpis: kpisArr,
          });
          // refresh cached generation
          await ensureGenerationForDate(reportDate);
          setMessage((m) => (m ? m + " • Station KPI saved" : "✅ Station KPI saved"));
        } catch (err) {
          console.error("KPI store error", err);
          setMessage((m) => (m ? m + " • KPI save failed" : "❌ KPI save failed"));
        }
      }

      // Save manual KPI values for the active tab (if provided)
      const manualForTab = manualKPI[activeTab] || {};
      const manualKpisPayload = [];
      Object.keys(manualForTab).forEach((kname) => {
        const v = manualForTab[kname];
        if (v !== "" && v !== null && v !== undefined) {
          manualKpisPayload.push({
            name: kname,
            value: Number(v),
            unit: manualUnits[activeTab]?.[kname] || null,
          });
        }
      });

      if (manualKpisPayload.length > 0) {
        try {
          await api.post("/totalizers/kpi/store", {
            date: reportDate,
            kpi_type: "manual",
            plant_name: activeTab,
            kpis: manualKpisPayload,
          });
          setMessage((m) => (m ? m + " • Manual KPI saved" : "✅ Manual KPI saved"));
          // reload manual KPIs so UI reflects upserted values (and they become stable)
          await loadManualKPIForActiveTab();
        } catch (err) {
          console.error("Manual KPI save failed", err);
          setMessage((m) => (m ? m + " • Manual KPI save failed" : "❌ Manual KPI save failed"));
        }
      }

      // Refresh yesterday (and KPI cache) after submit
      await loadYesterday(reportDate, activeTab, totalizersByUnit[activeTab]);
      await ensureGenerationForDate(reportDate);
    } catch (e) {
      console.error(e);
      const det = e?.response?.data?.detail || "Error saving";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* =============================================================
     Reset Form (clears current inputs for active tab)
     ============================================================= */
  const handleResetForm = () => {
    const items = totalizersByUnit[activeTab] || [];
    setReadingsForm((prev) => {
      const updated = { ...prev };
      items.forEach((t) => {
        if (!updated[t.id]) return;
        updated[t.id].today = "";
        updated[t.id].adjust = 0;
        updated[t.id].difference = "—";
      });
      return updated;
    });
    setMessage("⚠️ Current inputs have been reset.");
  };

  /* =============================================================
     Seed Master (Admin only)
     ============================================================= */
  const seedMaster = async () => {
    if (!isAdmin) return setMessage("❌ Only admin can seed!");
    if (!window.confirm("Seed master? Run only ONCE.")) return;
    try {
      const r = await api.post("/totalizers/seed-master");
      setMessage("✅ " + r.data.message);
      await loadMasterForUnit("Unit-1");
      await loadMasterForUnit("Unit-2");
      await loadMasterForUnit("Station");
      await loadMasterForUnit("Energy-Meter");
    } catch (e) {
      setMessage("❌ Error seeding master");
    }
  };

  /* =============================================================
     Adjust popup
     - double click card to open (only for adjust-capable users)
     ============================================================= */
  const openAdjustPopup = (t) => {
    if (!canAdjust || !canEdit(t.name)) return;
    const rec = readingsForm[t.id];
    setAdjustPopupRecord({
      id: t.id,
      name: t.display_name,
      yesterday: rec?.yesterday ?? "—",
      today: rec?.today ?? "",
      adjust: rec?.adjust ?? 0,
    });
    setShowAdjustPopup(true);
  };
  const saveAdjustPopup = () => {
    const { id, adjust } = adjustPopupRecord;
    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      rec.adjust = Number(adjust || 0);

      if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
      else rec.difference = Number(rec.today - rec.yesterday + rec.adjust).toFixed(3);

      return { ...prev, [id]: rec };
    });
    setShowAdjustPopup(false);
  };

  /* =============================================================
     render card (compact), double-click opens adjust popup
     - using small paddings to make 5-per-row visually compact
     ============================================================= */
  const renderCard = (t) => {
    const rec = readingsForm[t.id];
    if (!rec) return null;
    const orig = rec._orig || { today: "", adjust: 0 };
    const origExists = orig.today !== "";
    const readOnly = !canEdit(t.name) || (!isAdmin && origExists);

    return (
      <div
        key={t.id}
        className="p-2 border rounded-lg bg-zinc-50 shadow-sm cursor-pointer"
        onDoubleClick={() => openAdjustPopup(t)}
        title={canAdjust && canEdit(t.name) ? "Double click to edit adjustment" : ""}
      >
        <div className="font-medium text-sm truncate">{t.display_name}</div>

        <div className="text-xs text-gray-500 mt-1">
          Yesterday: <span className="font-semibold">{rec.yesterday}</span>
        </div>

        <label className="block mt-2 text-xs font-semibold">Today's</label>
        <input
          type="number"
          value={rec.today === "" ? "" : rec.today}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            setReadingsForm((prev) => {
              const r = { ...prev[t.id] };
              r.today = v;
              if (r.yesterday === "—" || r.today === "" || r.today === null) r.difference = "—";
              else {
                const adj = canAdjust ? Number(r.adjust || 0) : 0;
                r.difference = Number(r.today - r.yesterday + adj).toFixed(3);
              }
              return { ...prev, [t.id]: r };
            });
          }}
          className={`w-full p-1 mt-1 rounded border text-sm ${
            readOnly ? "bg-gray-100 text-gray-600" : "bg-white focus:ring-1 focus:ring-orange-400"
          }`}
        />

        <div className="mt-1 text-sm">
          <strong>Diff:</strong> <span className="font-semibold">{rec.difference}</span>
        </div>
      </div>
    );
  };

  /* =============================================================
     UI JSX
     ============================================================= */
  const tabs = ["Unit-1", "Unit-2", "Station", "Energy-Meter"];

  // Unit KPIs computed locally (for display) — compute from current readings (and cached generation)
  const localUnit1KPI = useMemo(() => {
    const feederA = getDiff("feeder_a", "Unit-1");
    const feederB = getDiff("feeder_b", "Unit-1");
    const feederC = getDiff("feeder_c", "Unit-1");
    const feederD = getDiff("feeder_d", "Unit-1");
    const feederE = getDiff("feeder_e", "Unit-1");
    const coal = feederA + feederB + feederC + feederD + feederE;
    const ldo = getDiff("ldo_flow", "Unit-1");
    const dm = getDiff("dm7", "Unit-1") + getDiff("dm11", "Unit-1");
    const steam = getDiff("main_steam", "Unit-1");
    const gen = (generationCache[reportDate] || {}).unit1_generation ?? getDiff("unit1_gen", "Energy-Meter");
    const specificCoal = gen > 0 ? Number((coal / gen).toFixed(6)) : 0;
    const specificOil = gen > 0 ? Number((ldo / gen).toFixed(6)) : 0;
    const specificDM = steam > 0 ? Number(((dm / steam) * 100).toFixed(3)) : 0;
    return { coal, specificCoal, ldo, specificOil, dm, steam, specificDM, gen };
  }, [readingsForm, generationCache, reportDate]);

  const localUnit2KPI = useMemo(() => {
    const feederA = getDiff("feeder_a", "Unit-2");
    const feederB = getDiff("feeder_b", "Unit-2");
    const feederC = getDiff("feeder_c", "Unit-2");
    const feederD = getDiff("feeder_d", "Unit-2");
    const feederE = getDiff("feeder_e", "Unit-2");
    const coal = feederA + feederB + feederC + feederD + feederE;
    const ldo = getDiff("ldo_flow", "Unit-2");
    const dm = getDiff("dm7", "Unit-2") + getDiff("dm11", "Unit-2");
    const steam = getDiff("main_steam", "Unit-2");
    const gen = (generationCache[reportDate] || {}).unit2_generation ?? getDiff("unit2_gen", "Energy-Meter");
    const specificCoal = gen > 0 ? Number((coal / gen).toFixed(6)) : 0;
    const specificOil = gen > 0 ? Number((ldo / gen).toFixed(6)) : 0;
    const specificDM = steam > 0 ? Number(((dm / steam) * 100).toFixed(3)) : 0;
    return { coal, specificCoal, ldo, specificOil, dm, steam, specificDM, gen };
  }, [readingsForm, generationCache, reportDate]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* TOP BAR */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-2">
          {tabs.map((t) => {
            const active = t === activeTab;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1 rounded-full font-medium transition-all ${active ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Select Date</label>
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="p-2 rounded border bg-white" />
        </div>
      </div>

      {/* MAIN */}
      <div className="flex gap-6">
        {/* left: totalizer cards + manual KPI */}
        <div className="flex-1 bg-white border rounded-xl p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-600">{activeTab} Totalizer Entry</h2>
            {message && <div className={`px-3 py-1 rounded ${message.startsWith("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(totalizersByUnit[activeTab] || []).map((t) => renderCard(t))}
          </div>

          {/* Manual KPI inputs (per activeTab) */}
          <div className="mt-4">
            {(activeTab === "Unit-1" || activeTab === "Unit-2" || activeTab === "Station") && (
              <div className="mt-4 p-3 border rounded-lg bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Manual KPIs ({activeTab})</div>
                  <div className="text-xs text-gray-500">Enter manual measurements</div>
                </div>

                <div className="mt-3 space-y-3">
                  {activeTab === "Unit-1" && (
                    <div>
                      <label className="block text-xs text-gray-600">Stack Emission ({manualUnits["Unit-1"].stack_emission})</label>
                      <input
                        type="number"
                        value={manualKPI["Unit-1"]?.stack_emission ?? ""}
                        onChange={(e) => setManualKPI((prev) => ({ ...prev, "Unit-1": { ...(prev["Unit-1"] || {}), stack_emission: e.target.value === "" ? "" : Number(e.target.value) } }))}
                        className="w-full p-2 border rounded mt-1"
                      />
                    </div>
                  )}

                  {activeTab === "Unit-2" && (
                    <div>
                      <label className="block text-xs text-gray-600">Stack Emission ({manualUnits["Unit-2"].stack_emission})</label>
                      <input
                        type="number"
                        value={manualKPI["Unit-2"]?.stack_emission ?? ""}
                        onChange={(e) => setManualKPI((prev) => ({ ...prev, "Unit-2": { ...(prev["Unit-2"] || {}), stack_emission: e.target.value === "" ? "" : Number(e.target.value) } }))}
                        className="w-full p-2 border rounded mt-1"
                      />
                    </div>
                  )}

                  {activeTab === "Station" && (
                    <div>
                      <label className="block text-xs text-gray-600">Clarifier Level ({manualUnits["Station"].clarifier_level})</label>
                      <input
                        type="number"
                        value={manualKPI["Station"]?.clarifier_level ?? ""}
                        onChange={(e) => setManualKPI((prev) => ({ ...prev, "Station": { ...(prev["Station"] || {}), clarifier_level: e.target.value === "" ? "" : Number(e.target.value) } }))}
                        className="w-full p-2 border rounded mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={handleSubmitClick} disabled={submitting} className="px-6 py-2 rounded-md text-white bg-orange-500 hover:bg-orange-600">
              {submitting ? "Saving..." : "Save"}
            </button>
            <button onClick={handleResetForm} className="px-4 py-2 rounded-md border">Reset Form</button>
          </div>
        </div>

        {/* right: KPIs column */}
        <div className="w-72 bg-white border rounded-xl p-4 shadow flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-600">KPIs</h3>
            {kpiLoading && <Spinner size={12} />}
          </div>

          <div className="h-px bg-gray-100" />

          {/* Energy-Meter live KPIs */}
          {activeTab === "Energy-Meter" && energyKPI && (
            <>
              <div className="text-xs text-gray-500">Energy-Meter (Live)</div>
              <div className="grid grid-cols-1 gap-2 mt-2 text-sm">
                <div className="flex justify-between"><div>U1 Gen</div><div className="font-semibold">{energyKPI.unit1_generation.toFixed(3)}</div></div>
                <div className="flex justify-between"><div>U2 Gen</div><div className="font-semibold">{energyKPI.unit2_generation.toFixed(3)}</div></div>
                <div className="flex justify-between"><div>U1 Aux</div><div className="font-semibold">{energyKPI.unit1_unit_aux_mwh.toFixed(3)}</div></div>
                <div className="flex justify-between"><div>U2 Aux</div><div className="font-semibold">{energyKPI.unit2_unit_aux_mwh.toFixed(3)}</div></div>
                <div className="flex justify-between"><div>Total Aux</div><div className="font-semibold">{energyKPI.total_station_aux_mwh.toFixed(3)}</div></div>
                <div className="flex justify-between"><div>U1 Aux %</div><div className="font-semibold">{energyKPI.unit1_aux_percent.toFixed(2)}%</div></div>
                <div className="flex justify-between"><div>U2 Aux %</div><div className="font-semibold">{energyKPI.unit2_aux_percent.toFixed(2)}%</div></div>
              </div>
            </>
          )}

          {/* Unit KPIs grouped with colors */}
          {(activeTab === "Unit-1" || activeTab === "Unit-2") && (
            <>
              <div className="text-xs text-gray-500">Calculated KPIs</div>

              {/* coal group */}
              <div className="p-2 rounded-md" style={{ background: "#FFF7E6" }}>
                <div className="text-xs text-gray-700 font-medium">COAL</div>
                <div className="flex justify-between text-sm"><div>Consumption</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.coal : localUnit2KPI.coal).toFixed(3)}</div></div>
                <div className="flex justify-between text-sm"><div>Specific Coal</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.specificCoal : localUnit2KPI.specificCoal).toFixed(6)}</div></div>
              </div>

              {/* LDO group */}
              <div className="p-2 rounded-md" style={{ background: "#FFF1E6" }}>
                <div className="text-xs text-gray-700 font-medium">LDO</div>
                <div className="flex justify-between text-sm"><div>Consumption</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.ldo : localUnit2KPI.ldo).toFixed(3)}</div></div>
                <div className="flex justify-between text-sm"><div>Specific Oil</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.specificOil : localUnit2KPI.specificOil).toFixed(6)}</div></div>
              </div>

              {/* DM group */}
              <div className="p-2 rounded-md" style={{ background: "#E6FBFF" }}>
                <div className="text-xs text-gray-700 font-medium">DM WATER</div>
                <div className="flex justify-between text-sm"><div>DM Water</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.dm : localUnit2KPI.dm).toFixed(3)}</div></div>
                <div className="flex justify-between text-sm"><div>Specific DM %</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.specificDM : localUnit2KPI.specificDM).toFixed(3)}%</div></div>
              </div>

              {/* Generation group */}
              <div className="p-2 rounded-md" style={{ background: "#E6EDFF" }}>
                <div className="text-xs text-gray-700 font-medium">GENERATION</div>
                <div className="flex justify-between text-sm"><div>Generation</div><div className="font-semibold">{(activeTab === "Unit-1" ? localUnit1KPI.gen : localUnit2KPI.gen).toFixed(3)}</div></div>
              </div>
            </>
          )}

          {/* Station fallback when no KPIs */}
          {activeTab === "Station" && <div className="text-sm text-gray-500">Station KPIs shown on Energy-Meter save</div>}
        </div>
      </div>

      {/* bottom seed */}
      <div className="mt-6">
        {isAdmin && <div className="flex justify-center"><button onClick={seedMaster} className="px-4 py-2 rounded bg-blue-600 text-white">Seed Master (Admin only)</button></div>}
      </div>

      {/* Confirm popup */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-5 rounded-xl w-96 shadow">
            <h3 className="text-lg font-semibold text-center text-orange-700 mb-3">Confirm Changes</h3>
            {confirmList.map((c) => <div key={c.id} className="text-sm py-1"><strong>{c.label}</strong>: {c.value}</div>)}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowConfirmPopup(false)} className="px-4 py-1 rounded bg-gray-300">Cancel</button>
              <button onClick={confirmSubmit} className="px-4 py-1 rounded bg-orange-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust popup */}
      {showAdjustPopup && adjustPopupRecord && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-5 rounded-xl w-80 shadow">
            <h3 className="text-lg font-semibold text-center mb-3">Edit Adjustment</h3>

            <div className="text-sm mb-2">
              <div className="text-gray-700 font-semibold">{adjustPopupRecord.name}</div>
              <div className="mt-2 text-gray-600 text-xs">Yesterday: <span className="font-bold">{adjustPopupRecord.yesterday}</span></div>
              <div className="mt-1 text-gray-600 text-xs">Today: <span className="font-bold">{adjustPopupRecord.today === "" ? "—" : adjustPopupRecord.today}</span></div>
            </div>

            <div>
              <label className="block text-xs text-gray-600">Adjustment value</label>
              <input type="number" value={adjustPopupRecord.adjust} onChange={(e) => setAdjustPopupRecord((p) => ({ ...p, adjust: e.target.value === "" ? "" : Number(e.target.value) }))} className="w-full p-2 rounded border mt-1" />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAdjustPopup(false)} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
              <button onClick={saveAdjustPopup} className="px-3 py-1 rounded bg-emerald-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
