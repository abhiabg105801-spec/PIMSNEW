// src/pages/TotalizerEntryPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";

// HeroIcons
import { 
  ChartBarIcon, FireIcon, CloudIcon, BoltIcon, FunnelIcon, 
  ArrowPathIcon, CheckCircleIcon, CalculatorIcon, TrashIcon,
  TableCellsIcon, BeakerIcon
} from "@heroicons/react/24/solid";

const API_URL = "http://localhost:8080/api";

// --- HELPERS ---
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

// --- KPI MAPPING ---
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

  /* ---------------- STATE ---------------- */
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

  const [serverKPIs, setServerKPIs] = useState({ "Unit-1": null, "Unit-2": null, Station: null });
  const [energyCache, setEnergyCache] = useState({});
  const [shutdownKPIs, setShutdownKPIs] = useState({
    "Unit-1": { running_hour: null, plant_availability_percent: null },
    "Unit-2": { running_hour: null, plant_availability_percent: null },
  });

  const [highlightedKPIs, setHighlightedKPIs] = useState({});
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);
  const [previewAutoKPIs, setPreviewAutoKPIs] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  /* ---------------- AUTH & INIT ---------------- */
  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

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

  /* ---------------- DATA LOADING LOGIC ---------------- */
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
              today: "", adjust: 0, yesterday: "—", difference: "—",
              display_name: t.display_name, name: t.name, unit: t.unit || unit,
              totalizer_id: t.id, _orig: { today: "", adjust: 0 },
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
    } catch (e) { console.error(e); }
  }, [api, reportDate]);

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
    loadMasterForUnit("Energy-Meter");
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
          const rec = updated[t.id] || { today: "", adjust: 0, yesterday: "—", difference: "—", display_name: t.display_name, name: t.name, unit: t.unit || unit, totalizer_id: t.id, _orig: { today: "", adjust: 0 } };
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
    } catch (e) { console.error(e); }
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
    } catch (e) { }
  }, [api, totalizersByUnit, canAdjust]);

  const loadEnergyCacheForDate = useCallback(async (dateStr) => {
    if (energyCache[dateStr]) return energyCache[dateStr];
    try {
      const r = await api.get("/kpi/energy", { params: { date: dateStr } });
      let out = {};
      if (Array.isArray(r.data?.kpis)) r.data.kpis.forEach(k => { out[k.name] = Number(k.value || 0); });
      else if (typeof r.data === "object" && r.data !== null) out = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, Number(v || 0)]));
      setEnergyCache((prev) => ({ ...prev, [dateStr]: out }));
      return out;
    } catch (e) { return {}; }
  }, [api, energyCache]);

  const calculateKPIsForUnit = useCallback(async (unit = null) => {
    const plant = unit || activeTab;
    setLoading(true);
    setMessage("");
    try {
      await loadEnergyCacheForDate(reportDate);
      const readings = (totalizersByUnit[plant] || []).map((t) => {
        const rec = readingsForm[t.id] || { today: "", adjust: 0 };
        return { totalizer_id: t.id, reading_value: rec.today === "" ? null : Number(rec.today), adjust_value: canAdjust ? Number(rec.adjust || 0) : 0 };
      }).filter(Boolean);

      const payload = { date: reportDate, plant_name: plant, readings };
      const r = await api.post("/kpi/calc", payload);
      const out = r.data?.auto_kpis || null;
      if (["Unit-1", "Unit-2", "Station"].includes(plant)) setServerKPIs((prev) => ({ ...prev, [plant]: out }));
      setMessage("✅ KPI calculated.");
      return out;
    } catch (e) { setMessage("❌ Calculation failed."); return null; }
    finally { setLoading(false); }
  }, [api, activeTab, reportDate, readingsForm, totalizersByUnit, canAdjust, loadEnergyCacheForDate]);

  const loadShutdownKPIsForUnitDate = useCallback(async (unitKey, dateStr) => {
    try {
      const res = await api.get(`/kpi/shutdown/${encodeURIComponent(unitKey)}`, { params: { date: dateStr } });
      if (res.status === 200 && res.data) setShutdownKPIs((prev) => ({ ...prev, [unitKey]: { ...prev[unitKey], ...res.data } }));
    } catch {}
  }, [api]);

  /* ---------------- FIELD UPDATES ---------------- */
  const updateField = (id, field, value) => {
    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      rec[field] = value === "" ? "" : Number(value);
      if (rec.yesterday === "—" || rec.today === "" || rec.today === null) rec.difference = "—";
      else {
        const adj = canAdjust ? Number(rec.adjust || 0) : 0;
        rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
      }
      const impacted = KPI_DEPENDENCY_MAP[rec.name] || [];
      if (impacted.length > 0) {
        const newState = {}; impacted.forEach(k => newState[k] = true);
        setHighlightedKPIs(newState);
        setTimeout(() => setHighlightedKPIs({}), 1400);
      }
      return { ...prev, [id]: rec };
    });
  };

  const updateManualField = (unit, field, value) => {
    setManualKPI((prev) => ({ ...prev, [unit]: { ...prev[unit], [field]: value === "" ? "" : Number(value) } }));
  };

  const getDiff = (name, unitFilter = null) => {
    const unitToUse = unitFilter || activeTab;
    const rec = Object.values(readingsForm).find((r) => r.name === name && (r.unit || "").toString() === unitToUse);
    return (!rec || !rec.difference || rec.difference === "—") ? 0 : Number(rec.difference);
  };

  /* ---------------- KPI COMPUTATION ---------------- */
  const localUnitKPI = useMemo(() => {
    if (!(activeTab === "Unit-1" || activeTab === "Unit-2")) return null;
    const coal = ["a", "b", "c", "d", "e"].reduce((acc, f) => acc + getDiff(`feeder_${f}`, activeTab), 0);
    const ldo = getDiff("ldo_flow", activeTab);
    const dm = getDiff("dm7", activeTab) + getDiff("dm11", activeTab);
    const steam = getDiff("main_steam", activeTab);
    return { coal, ldo, dm, steam };
  }, [readingsForm, activeTab]);

  const localStationKPI = useMemo(() => {
    if (activeTab !== "Station") return null;
    const total_raw_water = getDiff("raw_water", "Station");
    const u1_dm = getDiff("dm7", "Unit-1") + getDiff("dm11", "Unit-1");
    const u2_dm = getDiff("dm7", "Unit-2") + getDiff("dm11", "Unit-2");
    return { total_raw_water, avg_raw_per_hr: Number((total_raw_water / 24.0).toFixed(3)), total_dm: Number((u1_dm + u2_dm).toFixed(3)) };
  }, [readingsForm, activeTab]);

  /* ---------------- RESET & SEED ACTIONS ---------------- */
  const handleResetForm = () => {
    const items = totalizersByUnit[activeTab] || [];
    setReadingsForm((prev) => {
      const updated = { ...prev };
      items.forEach((t) => {
        if (!updated[t.id]) return;
        // Revert to original values
        updated[t.id].today = updated[t.id]._orig?.today ?? "";
        updated[t.id].adjust = updated[t.id]._orig?.adjust ?? 0;
        
        // Recalc differences
        if (updated[t.id].yesterday === "—" || updated[t.id].today === "" || updated[t.id].today === null) {
            updated[t.id].difference = "—";
        } else {
            const adj = canAdjust ? Number(updated[t.id].adjust || 0) : 0;
            updated[t.id].difference = Number(updated[t.id].today - updated[t.id].yesterday + adj).toFixed(3);
        }
      });
      return updated;
    });
    // Reset Manual KPIs by reloading
    loadManualKPIForActiveTab();
    setMessage("⚠️ Form reset to saved values.");
  };

  const handleSeedData = async () => {
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
          // Only seed if today is empty
          if (prevValue !== undefined && (rec.today === "" || rec.today === null)) {
            updated[t.id].today = prevValue;
            updated[t.id].adjust = rec._orig?.adjust ?? 0;
            const adj = canAdjust ? Number(updated[t.id].adjust || 0) : 0;
            const yestVal = rec.yesterday === "—" ? 0 : rec.yesterday;
            updated[t.id].difference = Number(updated[t.id].today - yestVal + adj).toFixed(3);
          }
        });
        return updated;
      });
      setMessage("ℹ️ Readings seeded from previous day.");
    } catch (e) {
      setMessage("❌ Failed to seed readings.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SUBMIT LOGIC ---------------- */
  const handleSubmitClick = () => {
    const list = [];
    (totalizersByUnit[activeTab] || []).forEach((t) => {
        const rec = readingsForm[t.id];
        const orig = rec?._orig || { today: "", adjust: 0 };
        if (String(rec.today) !== String(orig.today) && rec.today !== "") list.push({ label: rec.display_name, value: rec.today, old: orig.today ?? "", id: t.id });
        else if (canAdjust && String(rec.adjust) !== String(orig.adjust)) list.push({ label: rec.display_name + " (Adj)", value: rec.adjust, old: orig.adjust ?? 0, id: t.id });
    });
    
    const manualChanged = Object.values(manualKPI[activeTab] || {}).some((v) => v !== "" && v !== null && v !== undefined);
    
    if (list.length === 0 && !manualChanged) { setMessage("❌ No changes."); return; }
    if (!isAdmin && !isHOD && list.some(ch => readingsForm[ch.id]._orig.today !== "")) {
        setMessage(`❌ Only Admin/HOD can modify existing values`); return;
    }
    setConfirmList(list);
    setPreviewAutoKPIs(null);
    setShowConfirmPopup(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmPopup(false);
    setSubmitting(true);
    setMessage("");
    try {
        const items = totalizersByUnit[activeTab] || [];
        const payload = {
            date: reportDate, username: userName, plant_name: activeTab,
            readings: items.map((t) => {
                const rec = readingsForm[t.id];
                if (!rec || rec.today === "" || rec.today === null) return null;
                return { totalizer_id: t.id, reading_value: Number(rec.today), adjust_value: canAdjust ? Number(rec.adjust || 0) : 0 };
            }).filter(Boolean),
            manual_kpis: Object.entries(manualKPI[activeTab] || {}).map(([name, val]) => ({
                name, value: val === "" || val === null ? null : Number(val),
                unit: manualUnits[activeTab]?.[name] || null,
            })).filter(m => m.value !== null),
        };
        await api.post("/totalizers/submit", payload);
        
        setReadingsForm(prev => {
            const upd = {...prev};
            items.forEach(t => { if(upd[t.id]) upd[t.id]._orig = {today: upd[t.id].today, adjust: upd[t.id].adjust}; });
            return upd;
        });
        setLastUpdatedInfo({ at: new Date().toISOString(), by: userName });
        setMessage("✅ Readings saved");
        
        await loadYesterdayReadings(reportDate, activeTab, items);
        await loadManualKPIForActiveTab();
        if(activeTab.startsWith("Unit")) await loadShutdownKPIsForUnitDate(activeTab, reportDate);
        await calculateKPIsForUnit(activeTab);

    } catch(err) { setMessage(`❌ ${err?.response?.data?.detail || "Save error"}`); }
    finally { setSubmitting(false); }
  };

  const loadManualKPIForActiveTab = useCallback(async () => {
    try {
        const r = await api.get("/kpi/manual", { params: { date: reportDate, unit: activeTab } });
        const fetched = {};
        (r.data?.kpis || []).forEach((k) => { fetched[k.kpi_name || k.kpi] = k.kpi_value ?? k.value; });
        setManualKPI(prev => ({ ...prev, [activeTab]: { ...(initialManualKPI[activeTab] || {}), ...fetched } }));
    } catch { }
  }, [api, activeTab, reportDate]);

  /* ---------------- EFFECTS ---------------- */
  useEffect(() => {
    (async () => {
        const items = totalizersByUnit[activeTab] || [];
        await loadTodayReadings(reportDate, activeTab, items);
        await loadYesterdayReadings(reportDate, activeTab, items);
        await loadManualKPIForActiveTab();
        if (activeTab.startsWith("Unit")) await loadShutdownKPIsForUnitDate(activeTab, reportDate);
    })();
  }, [reportDate, activeTab, totalizersByUnit]);

  useEffect(() => { if (message) setTimeout(() => setMessage(""), 4000); }, [message]);

  const handleAdjustClick = (record) => { setAdjustPopupRecord(record); setShowAdjustPopup(true); };
  const saveAdjust = () => { updateField(adjustPopupRecord.id, "adjust", adjustPopupRecord.adjust); setShowAdjustPopup(false); };

  /* ---------------- RENDERERS ---------------- */
  const renderKpiValue = (k) => {
    const s = serverKPIs[activeTab] || {};
    if (s && s[k] !== undefined && s[k] !== null) return s[k];
    
    // Fallback to local
    if (activeTab.startsWith("Unit") && localUnitKPI) {
        if(k === "coal_consumption") return localUnitKPI.coal;
        if(k === "oil_consumption") return localUnitKPI.ldo;
        if(k === "dm_water") return localUnitKPI.dm;
        if(k === "steam_consumption") return localUnitKPI.steam;
    }
    if (activeTab === "Station" && localStationKPI) {
        if(k === "total_raw_water_used_m3") return localStationKPI.total_raw_water;
    }
    return null;
  };

  const KpiCard = ({ label, value, unit, Icon }) => (
    <div className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-50 text-orange-600 rounded-md"><Icon className="w-5 h-5"/></div>
        <div className="text-sm font-medium text-zinc-600">{label}</div>
      </div>
      <div className="text-right">
        <div className="text-base font-bold text-zinc-800">{value === null ? "—" : typeof value === 'number' ? value.toFixed(2) : value}</div>
        <div className="text-[10px] text-zinc-400 font-bold">{unit}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-800 overflow-hidden">
      
      {/* --- 1. LEFT SIDEBAR (Menu) --- */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-6 border-b border-zinc-100 flex items-center gap-2">
            <div className="h-8 w-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">J</div>
            <h1 className="text-lg font-bold text-zinc-800 tracking-tight">JSL PIMS</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {["Unit-1", "Unit-2", "Station", "Energy-Meter"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                ${activeTab === tab 
                  ? "bg-orange-50 text-orange-700 shadow-sm border border-orange-100" 
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
            >
              <BoltIcon className={`w-5 h-5 ${activeTab === tab ? "text-orange-500" : "text-zinc-400"}`} />
              {tab}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100">
            <div className="text-xs text-zinc-400 font-medium">Logged in as</div>
            <div className="text-sm font-bold text-zinc-700 truncate">{userName}</div>
        </div>
      </aside>

      {/* --- 2. MIDDLE PANEL (Form) --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-50/50">
        
        {/* Header Actions */}
        <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
             <div className="flex items-center bg-zinc-100 rounded-md p-1 border border-zinc-200">
                <button onClick={() => setReportDate(d => {const x=new Date(d); x.setDate(x.getDate()-1); return x.toLocaleDateString("en-CA")})} className="p-1 hover:bg-white rounded shadow-sm text-zinc-500"><ArrowPathIcon className="w-4 h-4 rotate-180"/></button>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-zinc-700 w-32 text-center focus:ring-0"/>
                <button onClick={() => setReportDate(d => {const x=new Date(d); x.setDate(x.getDate()+1); return x.toLocaleDateString("en-CA")})} className="p-1 hover:bg-white rounded shadow-sm text-zinc-500"><ArrowPathIcon className="w-4 h-4"/></button>
             </div>
             <div className="h-6 w-px bg-zinc-200 mx-2"></div>
             <span className="text-sm font-semibold text-zinc-600">Entry for <span className="text-orange-600">{activeTab}</span></span>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={handleSeedData} className="px-3 py-1.5 text-xs font-bold text-zinc-500 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50">Seed Data</button>
             <button onClick={handleResetForm} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-zinc-200 rounded-md hover:bg-red-50">Reset</button>
             <button onClick={handleSubmitClick} disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-orange-600 rounded-md hover:bg-orange-700 shadow-md flex items-center gap-2">
                {submitting ? <Spinner/> : <CheckCircleIcon className="w-4 h-4"/>} Submit
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
            
            {/* Totalizer Table */}
            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">Flow Totalizers</h3>
                    <span className="text-xs text-zinc-400">Values in standard units</span>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-100 border-b border-zinc-200">
                        <tr>
                            <th className="px-4 py-3 font-bold w-1/3">Parameter</th>
                            <th className="px-4 py-3 font-bold text-right">Current</th>
                            <th className="px-4 py-3 font-bold text-right text-zinc-400">Previous</th>
                            <th className="px-4 py-3 font-bold text-right">Diff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {(totalizersByUnit[activeTab] || []).filter(t => canView(t.name)).map(t => {
                            const rec = readingsForm[t.id];
                            if(!rec) return null;
                            const isEd = canEdit(t.name);
                            return (
                                <tr key={t.id} className="hover:bg-orange-50/30 transition-colors group">
                                    <td className="px-4 py-2 font-medium text-zinc-700">{t.display_name}</td>
                                    <td className="px-4 py-2 text-right">
                                        <input 
                                            type="number" 
                                            value={rec.today} 
                                            onChange={e => updateField(t.id, 'today', e.target.value)}
                                            onDoubleClick={() => canAdjust && handleAdjustClick({id: t.id, adjust: rec.adjust||0})}
                                            readOnly={!isEd}
                                            className={`w-32 text-right text-sm font-bold bg-transparent border-b border-transparent focus:border-orange-500 focus:ring-0 p-1 
                                                ${!isEd ? 'text-zinc-400 cursor-not-allowed' : 'text-zinc-900 group-hover:bg-white'}`}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right text-zinc-400 font-mono">{rec.yesterday}</td>
                                    <td className="px-4 py-2 text-right font-bold font-mono text-orange-600 bg-zinc-50/50">{rec.difference}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Manual KPI Table */}
            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50/50">
                    <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">Manual Parameters</h3>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-100 border-b border-zinc-200">
                        <tr>
                            <th className="px-4 py-3 font-bold w-1/2">Parameter Name</th>
                            <th className="px-4 py-3 font-bold text-right">Unit</th>
                            <th className="px-4 py-3 font-bold text-right">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {Object.entries(manualKPI[activeTab] || {}).map(([k, val]) => (
                             <tr key={k} className="hover:bg-orange-50/30 transition-colors group">
                                <td className="px-4 py-2 font-medium text-zinc-700 capitalize">
                                    {k.replace(/_/g, " ")}
                                </td>
                                <td className="px-4 py-2 text-right text-zinc-400 text-xs font-bold">
                                    {manualUnits[activeTab]?.[k] || "-"}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <input 
                                        type="number" 
                                        value={val} 
                                        onChange={e => updateManualField(activeTab, k, e.target.value)}
                                        className="w-32 text-right text-sm font-bold bg-transparent border-b border-transparent focus:border-orange-500 focus:ring-0 p-1 text-zinc-900 group-hover:bg-white"
                                        placeholder="Enter value"
                                    />
                                </td>
                             </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="h-10"></div> {/* Spacer */}
        </div>
      </main>

      {/* --- 3. RIGHT PANEL (KPIs) --- */}
      <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50">
            <button 
                onClick={() => calculateKPIsForUnit(activeTab)} 
                disabled={loading}
                className="w-full py-2.5 bg-white border border-orange-200 text-orange-700 font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:border-orange-300 transition-all flex justify-center items-center gap-2"
            >
                {loading ? <Spinner/> : <CalculatorIcon className="w-4 h-4"/>} Calculate Results
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {/* Dynamic KPI List */}
             {activeTab.startsWith("Unit") && (
                <>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-2">Performance</div>
                    <KpiCard label="Generation" value={activeTab === 'Unit-1' ? serverKPIs[activeTab]?.unit1_generation : serverKPIs[activeTab]?.unit2_generation} unit="MWh" Icon={BoltIcon}/>
                    <KpiCard label="PLF" value={activeTab === 'Unit-1' ? serverKPIs[activeTab]?.unit1_plf_percent : serverKPIs[activeTab]?.unit2_plf_percent} unit="%" Icon={ChartBarIcon}/>
                    
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-4">Consumption</div>
                    <KpiCard label="Coal Cons." value={renderKpiValue("coal_consumption")} unit="MT" Icon={FireIcon}/>
                    <KpiCard label="Sp. Coal" value={renderKpiValue("specific_coal")} unit="kg/kWh" Icon={ChartBarIcon}/>
                    <KpiCard label="LDO Cons." value={renderKpiValue("oil_consumption")} unit="KL" Icon={FunnelIcon}/>
                    <KpiCard label="DM Water" value={renderKpiValue("dm_water")} unit="m³" Icon={CloudIcon}/>
                </>
             )}

             {activeTab === "Station" && (
                <>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-2">Water Metrics</div>
                    <KpiCard label="Total Raw Water" value={renderKpiValue("total_raw_water_used_m3")} unit="m³" Icon={CloudIcon}/>
                    <KpiCard label="Avg Raw Water" value={renderKpiValue("avg_raw_water_m3_per_hr")} unit="m³/hr" Icon={CloudIcon}/>
                    <KpiCard label="Total DM Water" value={renderKpiValue("total_dm_water_used_m3")} unit="m³" Icon={CloudIcon}/>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-4">Overall</div>
                    <KpiCard label="Station PLF" value={serverKPIs.Station?.station_plf_percent} unit="%" Icon={ChartBarIcon}/>
                </>
             )}
        </div>
      </aside>

      {/* --- POPUPS --- */}
      {message && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4">
            {message}
        </div>
      )}

      {showAdjustPopup && adjustPopupRecord && (
         <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold text-zinc-800 mb-4">Adjust Reading</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Totalizer ID</label>
                        <div className="text-sm font-mono text-zinc-800">{adjustPopupRecord.id}</div>
                    </div>
                    <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase">Adjustment Value</label>
                         <input 
                            type="number" 
                            autoFocus
                            value={adjustPopupRecord.adjust}
                            onChange={e => setAdjustPopupRecord(p => ({...p, adjust: e.target.value}))}
                            className="w-full mt-1 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                         />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowAdjustPopup(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancel</button>
                        <button onClick={saveAdjust} className="px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm">Save</button>
                    </div>
                </div>
            </div>
         </div>
      )}

      {showConfirmPopup && (
         <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6 text-orange-600"/> Confirm Submission</h3>
                
                <div className="flex-1 overflow-auto bg-zinc-50 p-4 rounded-lg border border-zinc-100 mb-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Changed Values</h4>
                    <ul className="space-y-2">
                        {confirmList.map((c, i) => (
                            <li key={i} className="text-sm flex justify-between">
                                <span className="font-medium text-zinc-700">{c.label}</span>
                                <span>
                                    <span className="text-zinc-400 line-through mr-2">{c.old}</span>
                                    <span className="font-bold text-orange-600">{c.value}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowConfirmPopup(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancel</button>
                    <button onClick={confirmSubmit} disabled={submitting} className="px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm flex items-center gap-2">
                        {submitting && <Spinner/>} Confirm & Save
                    </button>
                </div>
             </div>
         </div>
      )}

    </div>
  );
}