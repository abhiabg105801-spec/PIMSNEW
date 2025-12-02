import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

/* -----------------------------------------
   AUTH HELPERS
------------------------------------------ */
const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

const getTokenPayload = (authHeader) => {
  try {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

const Spinner = ({ size = 14 }) => (
  <div
    style={{ width: size, height: size }}
    className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current"
  />
);

/* ========================================================================
   MAIN PAGE
========================================================================= */
export default function TotalizerEntryPage({ auth }) {
  /* -----------------------------------------
       API INSTANCE
  ------------------------------------------ */
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }),
    [authHeader]
  );

  /* -----------------------------------------
       STATE
  ------------------------------------------ */
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [activeTab, setActiveTab] = useState("Unit-1");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [roleId, setRoleId] = useState(null);
  const isAdmin = roleId === 8;
  const isHOD = roleId === 7;
  const canAdjust = isAdmin || isHOD;

  const [permissionMap, setPermissionMap] = useState({});
  const canEdit = (field) => permissionMap[field]?.can_edit ?? true;

  const [totalizersByUnit, setTotalizersByUnit] = useState({
    "Unit-1": [],
    "Unit-2": [],
    Station: [],
    "Energy-Meter": [],
  });

  const [readingsForm, setReadingsForm] = useState({});

  /* --- adjust popup --- */
  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [adjustPopupRecord, setAdjustPopupRecord] = useState(null);

  /* --- KPI only for Energy-Meter --- */
  const [kpi, setKpi] = useState({});
  const [kpiLoading, setKpiLoading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  /* ========================================================================
       LOAD AUTH USER
  ======================================================================== */
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

  /* ========================================================================
       LOAD PERMISSIONS
  ======================================================================== */
  useEffect(() => {
    async function loadPerm() {
      try {
        const r = await api.get("/permissions/me");
        const pm = {};
        (r.data || []).forEach((p) => {
          pm[p.field_name] = {
            can_edit: !!p.can_edit,
            can_view: !!p.can_view,
          };
        });
        setPermissionMap(pm);
      } catch {}
    }
    loadPerm();
  }, [api]);

  /* ========================================================================
       LOAD MASTER
  ======================================================================== */
  const loadMasterForUnit = useCallback(
    async (unit) => {
      try {
        const r = await api.get("/totalizers/list", { params: { unit } });
        const items = r.data || [];

        setTotalizersByUnit((prev) => ({
          ...prev,
          [unit]: items,
        }));

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
                totalizer_id: t.id,
                _orig: { today: "", adjust: 0 },
              };
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("Master load error:", e);
      }
    },
    [api]
  );

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
    loadMasterForUnit("Energy-Meter");
  }, [loadMasterForUnit]);

  /* ========================================================================
       LOAD TODAY
  ======================================================================== */
  const loadTodayReadings = useCallback(
    async (forDate, unit) => {
      try {
        const r = await api.get("/totalizers/readings", {
          params: { date: forDate },
        });

        const rows = r.data || [];
        const rowMap = {};
        rows.forEach((rr) => {
          rowMap[rr.totalizer_id] = {
            today: Number(rr.reading_value || 0),
            adjust: Number(rr.adjust_value || 0),
          };
        });

        setReadingsForm((prev) => {
          const updated = { ...prev };
          (totalizersByUnit[unit] || []).forEach((t) => {
            const rec = updated[t.id];
            if (!rec) return;

            if (rowMap[t.id]) {
              rec.today = rowMap[t.id].today;
              rec.adjust = rowMap[t.id].adjust;
              rec._orig = {
                today: rec.today,
                adjust: rec.adjust,
              };
            } else {
              rec.today = "";
              rec.adjust = 0;
            }

            if (rec.yesterday === "—" || rec.today === "") rec.difference = "—";
            else {
              const adj = canAdjust ? Number(rec.adjust || 0) : 0;
              rec.difference = Number(rec.today - rec.yesterday + adj).toFixed(3);
            }

            updated[t.id] = { ...rec };
          });

          return updated;
        });
      } catch (e) {
        console.error("loadToday error:", e);
      }
    },
    [api, totalizersByUnit, canAdjust]
  );

  /* ========================================================================
       LOAD YESTERDAY
  ======================================================================== */
  const loadYesterday = useCallback(
    async (forDate, unit) => {
      try {
        const d = new Date(forDate);
        d.setDate(d.getDate() - 1);
        const y = d.toISOString().slice(0, 10);

        const r = await api.get("/totalizers/readings", {
          params: { date: y },
        });

        const rows = r.data || [];
        const rowMap = {};
        rows.forEach((rr) => {
          rowMap[rr.totalizer_id] = Number(rr.reading_value || 0);
        });

        setReadingsForm((prev) => {
          const updated = { ...prev };
          (totalizersByUnit[unit] || []).forEach((t) => {
            const rec = updated[t.id];
            if (!rec) return;

            rec.yesterday =
              rowMap[t.id] !== undefined ? rowMap[t.id] : "—";

            if (rec.yesterday === "—" || rec.today === "") rec.difference = "—";
            else {
              const adj = canAdjust ? Number(rec.adjust || 0) : 0;
              rec.difference = Number(
                rec.today - rec.yesterday + adj
              ).toFixed(3);
            }

            updated[t.id] = { ...rec };
          });

          return updated;
        });
      } catch (err) {
        console.error("Yesterday load failed, setting all to —");

        setReadingsForm((prev) => {
          const updated = { ...prev };
          (totalizersByUnit[unit] || []).forEach((t) => {
            const rec = updated[t.id];
            if (rec) {
              rec.yesterday = "—";
              rec.difference = "—";
            }
          });
          return updated;
        });
      }
    },
    [api, totalizersByUnit, canAdjust]
  );

  /* -----------------------------------------
       LOAD KPI ONLY FOR ENERGY-METER
  ------------------------------------------ */
  const loadKPI = useCallback(
    async (date) => {
      try {
        setKpiLoading(true);
        const r = await api.get("/totalizers/kpi/get", {
          params: {
            date,
            kpi_type: "energy",
            plant_name: "Station",
          },
        });
        setKpi(r.data || {});
      } catch {
        setKpi({});
      } finally {
        setKpiLoading(false);
      }
    },
    [api]
  );

  /* ========================================================================
       TRIGGER LOADS
  ======================================================================== */
  useEffect(() => {
    loadTodayReadings(reportDate, activeTab);
    loadYesterday(reportDate, activeTab);

    if (activeTab === "Energy-Meter") {
      loadKPI(reportDate);
    } else {
      setKpi({});
    }
  }, [reportDate, activeTab]);

  /* ========================================================================
       OPEN ADJUST POPUP
  ======================================================================== */
  const openAdjustPopup = (t) => {
    if (!canAdjust || !canEdit(t.name)) return;

    const rec = readingsForm[t.id];
    setAdjustPopupRecord({
      id: t.id,
      name: t.display_name,
      adjust: rec.adjust,
    });
    setShowAdjustPopup(true);
  };

  const saveAdjustPopup = () => {
    const { id, adjust } = adjustPopupRecord;

    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      rec.adjust = Number(adjust);

      if (rec.yesterday === "—" || rec.today === "") rec.difference = "—";
      else {
        rec.difference = Number(
          rec.today - rec.yesterday + rec.adjust
        ).toFixed(3);
      }

      return { ...prev, [id]: rec };
    });

    setShowAdjustPopup(false);
  };

  /* ========================================================================
       RENDER CARD
  ======================================================================== */
  const renderCard = (t) => {
    const rec = readingsForm[t.id];
    if (!rec) return null;

    const orig = rec._orig || { today: "", adjust: 0 };
    const readonly = !canEdit(t.name) || (!isAdmin && orig.today !== "");

    return (
      <div
        key={t.id}
        className="p-3 border rounded-xl bg-zinc-50 shadow-sm cursor-pointer"
        onDoubleClick={() => openAdjustPopup(t)}
      >
        <div className="font-medium text-sm">{t.display_name}</div>

        <div className="text-xs text-gray-600 mt-1">
          Yesterday: <strong>{rec.yesterday}</strong>
        </div>

        <label className="block mt-2 text-xs font-semibold">
          Today's Reading
        </label>
        <input
          type="number"
          value={rec.today}
          readOnly={readonly}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);

            setReadingsForm((prev) => {
              const r = { ...prev[t.id] };
              r.today = v;

              if (r.yesterday === "—" || r.today === "") r.difference = "—";
              else {
                const adj = canAdjust ? Number(r.adjust || 0) : 0;
                r.difference = Number(r.today - r.yesterday + adj).toFixed(3);
              }

              return { ...prev, [t.id]: r };
            });
          }}
          className={`w-full p-2 mt-1 rounded border ${
            readonly
              ? "bg-gray-100 text-gray-600"
              : "bg-white focus:ring-2 focus:ring-orange-500"
          }`}
        />

        <div className="mt-3 text-sm">
          <strong>Difference:</strong>{" "}
          <span className="font-semibold">{rec.difference}</span>
        </div>
      </div>
    );
  };

  /* ========================================================================
       SUBMIT
  ======================================================================== */
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);

  const handleSubmitClick = () => {
    const changed = [];
    const items = totalizersByUnit[activeTab] || [];

    items.forEach((t) => {
      const rec = readingsForm[t.id];
      const orig = rec._orig;

      if (String(rec.today) !== String(orig.today) && rec.today !== "") {
        changed.push({
          label: rec.display_name,
          value: rec.today,
          id: t.id,
        });
      } else if (canAdjust && String(rec.adjust) !== String(orig.adjust)) {
        changed.push({
          label: rec.display_name + " (Adj)",
          value: rec.adjust,
          id: t.id,
        });
      }
    });

    if (changed.length === 0) {
      setMessage("❌ No changes.");
      return;
    }

    setConfirmList(changed);
    setShowConfirmPopup(true);
  };

  /* ========================================================================
       ENERGY KPI CALCULATOR
  ======================================================================== */
  const EM = {
    u1_lsr01_ic1: "1lsr01_ic1",
    u1_lsr02_ic1: "1lsr02_ic1",
    u2_lsr01_ic1: "2lsr01_ic1",
    u2_lsr02_ic1: "2lsr02_ic1",
    rlsr01: "rlsr01",
    rlsr02: "rlsr02",
    rlsr03: "rlsr03",
    rlsr04: "rlsr04",
    sst_10: "sst_10",
    ust_15: "ust_15",
    ust_25: "ust_25",
    tie_1: "1lsr01_ic2_tie",
    tie_2: "1lsr02_ic2_tie",
    tie_3: "2lsr01_ic2_tie",
    tie_4: "2lsr02_ic2_tie",
    unit1_gen: "unit1_gen",
    unit2_gen: "unit2_gen",
  };

  const getDiffByName = (name) => {
    const rec = Object.values(readingsForm).find((r) => r.name === name);
    if (!rec || rec.difference === "—") return 0;
    return Number(rec.difference) || 0;
  };

  const computeEnergyKPIObject = () => {
    const u1aux =
      getDiffByName(EM.u1_lsr01_ic1) + getDiffByName(EM.u1_lsr02_ic1);
    const u2aux =
      getDiffByName(EM.u2_lsr01_ic1) + getDiffByName(EM.u2_lsr02_ic1);

    const stationAux =
      getDiffByName(EM.rlsr01) +
      getDiffByName(EM.rlsr02) +
      getDiffByName(EM.rlsr03) +
      getDiffByName(EM.rlsr04) +
      getDiffByName(EM.sst_10) +
      getDiffByName(EM.ust_15) +
      getDiffByName(EM.ust_25);

    const tie =
      getDiffByName(EM.tie_1) +
      getDiffByName(EM.tie_2) +
      getDiffByName(EM.tie_3) +
      getDiffByName(EM.tie_4);

    const u1cons = u1aux + (stationAux + tie) / 2;
    const u2cons = u2aux + (stationAux + tie) / 2;

    const u1gen = getDiffByName(EM.unit1_gen);
    const u2gen = getDiffByName(EM.unit2_gen);

    return {
      unit1_unit_aux_mwh: Number(u1aux.toFixed(3)),
      unit2_unit_aux_mwh: Number(u2aux.toFixed(3)),
      total_station_aux_mwh: Number(stationAux.toFixed(3)),
      total_station_tie_mwh: Number(tie.toFixed(3)),
      unit1_aux_consumption_mwh: Number(u1cons.toFixed(3)),
      unit1_aux_percent:
        u1gen > 0 ? Number(((u1cons / u1gen) * 100).toFixed(3)) : 0,
      unit2_aux_consumption_mwh: Number(u2cons.toFixed(3)),
      unit2_aux_percent:
        u2gen > 0 ? Number(((u2cons / u2gen) * 100).toFixed(3)) : 0,
    };
  };

  const energyKPI =
    activeTab === "Energy-Meter" ? computeEnergyKPIObject() : null;

  /* ========================================================================
       CONFIRM SUBMIT
  ======================================================================== */
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

      await api.post("/totalizers/submit", payload);

      // update orig
      setReadingsForm((prev) => {
        const updated = { ...prev };
        items.forEach((t) => {
          updated[t.id]._orig = {
            today: updated[t.id].today,
            adjust: updated[t.id].adjust,
          };
        });
        return updated;
      });

      setMessage("✅ Saved successfully");

      if (activeTab === "Energy-Meter") {
        const ek = energyKPI;
        const kpisArr = [
          { name: "unit1_unit_aux_mwh", value: ek.unit1_unit_aux_mwh, unit: "MWh" },
          { name: "unit2_unit_aux_mwh", value: ek.unit2_unit_aux_mwh, unit: "MWh" },
          { name: "total_station_aux_mwh", value: ek.total_station_aux_mwh, unit: "MWh" },
          { name: "total_station_tie_mwh", value: ek.total_station_tie_mwh, unit: "MWh" },
          { name: "unit1_aux_consumption_mwh", value: ek.unit1_aux_consumption_mwh, unit: "MWh" },
          { name: "unit1_aux_percent", value: ek.unit1_aux_percent, unit: "%" },
          { name: "unit2_aux_consumption_mwh", value: ek.unit2_aux_consumption_mwh, unit: "MWh" },
          { name: "unit2_aux_percent", value: ek.unit2_aux_percent, unit: "%" },
        ];

        await api.post("/totalizers/kpi/store", {
          date: reportDate,
          kpi_type: "energy",
          plant_name: "Station",
          kpis: kpisArr,
        });
      }

      await loadYesterday(reportDate, activeTab);
      if (activeTab === "Energy-Meter") await loadKPI(reportDate);
    } catch (err) {
      console.error(err);
      setMessage("❌ Error saving");
    }

    setSubmitting(false);
  };

  /* ========================================================================
       RESET FORM
  ======================================================================== */
  const handleResetForm = () => {
    const items = totalizersByUnit[activeTab] || [];
    setReadingsForm((prev) => {
      const updated = { ...prev };
      items.forEach((t) => {
        updated[t.id].today = "";
        updated[t.id].adjust = 0;
        updated[t.id].difference = "—";
      });
      return updated;
    });
    setMessage("⚠️ Reset done");
  };

  /* ========================================================================
       SEED MASTER (ADMIN)
  ======================================================================== */
  const seedMaster = async () => {
    if (!isAdmin) return setMessage("❌ Only admin can seed!");

    if (!window.confirm("Run seed only once?")) return;

    try {
      const r = await api.post("/totalizers/seed-master");
      setMessage("✅ " + r.data.message);

      await loadMasterForUnit("Unit-1");
      await loadMasterForUnit("Unit-2");
      await loadMasterForUnit("Station");
      await loadMasterForUnit("Energy-Meter");
    } catch {
      setMessage("❌ Seed failed");
    }
  };

  /* ========================================================================
       UI
  ======================================================================== */
  const tabs = ["Unit-1", "Unit-2", "Station", "Energy-Meter"];

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* TOP BAR */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1 rounded-full font-medium ${
                activeTab === t
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Select Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="p-2 rounded border bg-white"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* MAIN FORM */}
        <div className="flex-1 bg-white border rounded-xl p-4 shadow">
          <div className="flex justify-between mb-3">
            <h2 className="text-lg font-semibold">{activeTab} Totalizer Entry</h2>

            {message && (
              <div
                className={`px-3 py-1 rounded ${
                  message.startsWith("❌")
                    ? "bg-red-50 text-red-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(totalizersByUnit[activeTab] || []).map((t) => renderCard(t))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSubmitClick}
              className="px-6 py-2 rounded bg-orange-500 text-white"
            >
              {submitting ? "Saving..." : "Save"}
            </button>

            <button
              onClick={handleResetForm}
              className="px-4 py-2 rounded border"
            >
              Reset
            </button>
          </div>
        </div>

        {/* KPI COLUMN */}
        <div className="w-80 bg-white border rounded-xl p-4 shadow">
          <h3 className="text-sm font-semibold mb-2">KPIs</h3>

          {activeTab === "Energy-Meter" && (
            <>
              {kpiLoading && <Spinner size={16} />}

              <div className="mt-2 text-sm">
                <div className="flex justify-between">
                  <span>U1 Aux MWh</span>
                  <span>{energyKPI.unit1_unit_aux_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>U2 Aux MWh</span>
                  <span>{energyKPI.unit2_unit_aux_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Total Aux</span>
                  <span>{energyKPI.total_station_aux_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Total Tie</span>
                  <span>{energyKPI.total_station_tie_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>U1 Aux Cons</span>
                  <span>{energyKPI.unit1_aux_consumption_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>U1 Aux %</span>
                  <span>{energyKPI.unit1_aux_percent.toFixed(2)}%</span>
                </div>

                <div className="flex justify-between">
                  <span>U2 Aux Cons</span>
                  <span>{energyKPI.unit2_aux_consumption_mwh.toFixed(3)}</span>
                </div>

                <div className="flex justify-between">
                  <span>U2 Aux %</span>
                  <span>{energyKPI.unit2_aux_percent.toFixed(2)}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SEED */}
      {isAdmin && (
        <div className="mt-6 text-center">
          <button
            onClick={seedMaster}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Seed Master (Admin only)
          </button>
        </div>
      )}

      {/* CONFIRM POPUP */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-5 rounded-xl w-96 shadow">
            <h3 className="text-lg font-semibold text-orange-700 text-center mb-3">
              Confirm Changes
            </h3>

            {confirmList.map((c) => (
              <div key={c.id} className="text-sm py-1">
                <strong>{c.label}</strong>: {c.value}
              </div>
            ))}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowConfirmPopup(false)}
                className="px-4 py-1 rounded bg-gray-300"
              >
                Cancel
              </button>

              <button
                onClick={confirmSubmit}
                className="px-4 py-1 rounded bg-orange-600 text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST POPUP */}
      {showAdjustPopup && adjustPopupRecord && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-5 rounded-xl w-80 shadow">
            <h3 className="text-lg font-semibold text-center mb-3">
              Edit Adjustment
            </h3>

            <div className="text-sm mb-2 text-gray-700">
              {adjustPopupRecord.name}
            </div>

            <label className="block text-xs">Adjustment</label>
            <input
              type="number"
              value={adjustPopupRecord.adjust}
              onChange={(e) =>
                setAdjustPopupRecord((p) => ({
                  ...p,
                  adjust: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              className="w-full p-2 border rounded mt-1"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-3 py-1 rounded bg-gray-200"
                onClick={() => setShowAdjustPopup(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 rounded bg-emerald-600 text-white"
                onClick={saveAdjustPopup}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
