// src/pages/TotalizerEntryPage.js
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
  /* ----------------- Setup API instance ----------------- */
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

  /* ----------------- Master & Readings ----------------- */
  const [totalizersByUnit, setTotalizersByUnit] = useState({
    "Unit-1": [],
    "Unit-2": [],
    Station: [],
  });

  const [readingsForm, setReadingsForm] = useState({});

  /* ----------------- Confirm popup ----------------- */
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmList, setConfirmList] = useState([]);

  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  /* =============================================================
      LOAD AUTH USER
     ============================================================= */
  useEffect(() => {
    let cancelled = false;
    const payload = getTokenPayload(authHeader);
    if (payload) {
      setRoleId(payload.role_id);
      return;
    }

    api.get("/auth/me")
      .then((r) => {
        if (!cancelled && r.data?.role_id) {
          setRoleId(r.data.role_id);
        }
      })
      .catch(() => {})
      .finally(() => {});

    return () => {
      cancelled = true;
    };
  }, [api, authHeader]);

  /* =============================================================
      PERMISSIONS
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

  const canView = (field) =>
    permissionMap[field]?.can_view ?? true;
  const canEdit = (field) =>
    permissionMap[field]?.can_edit ?? true;

  /* =============================================================
      LOAD MASTER TOTALIZERS (RUN ONCE)
     ============================================================= */
  const loadMasterForUnit = useCallback(
    async (unit) => {
      try {
        const r = await api.get("/totalizers/list", { params: { unit } });
        const items = r.data || [];

        setTotalizersByUnit((prev) => ({ ...prev, [unit]: items }));

        // Initialize readings form entries
        setReadingsForm((prev) => {
          const updated = { ...prev };
          items.forEach((t) => {
            if (!updated[t.id]) {
              updated[t.id] = {
                reading_value: "",
                adjust_value: 0,
                yesterday: 0,
                difference: "",
                display_name: t.display_name,
                name: t.name,
                unit: t.unit,
                totalizer_id: t.id,
                _orig: { reading_value: "", adjust_value: 0 },
              };
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("loadMasterForUnit error:", e);
      }
    },
    [api]
  );

  useEffect(() => {
    loadMasterForUnit("Unit-1");
    loadMasterForUnit("Unit-2");
    loadMasterForUnit("Station");
  }, [loadMasterForUnit]);

  /* =============================================================
      LOAD TODAY'S TOTALIZERS → AUTO POPULATE INPUT
     ============================================================= */
  const loadTodayReadings = useCallback(
    async (forDate, unit) => {
      try {
        const r = await api.get("/totalizers/readings", { params: { date: forDate } });
        const rows = r.data || [];

        const rowMap = {};
        rows.forEach((rr) => {
          rowMap[rr.totalizer_id] = {
            reading_value: Number(rr.reading_value || 0),
            adjust_value: Number(rr.adjust_value || 0),
          };
        });

        setReadingsForm((prev) => {
          const updated = { ...prev };
          const items = totalizersByUnit[unit] || [];

          items.forEach((t) => {
            const rec = updated[t.id] || {
              reading_value: "",
              adjust_value: 0,
              yesterday: 0,
              difference: "",
              display_name: t.display_name,
              totalizer_id: t.id,
              _orig: { reading_value: "", adjust_value: 0 },
            };

            if (rowMap[t.id]) {
              rec.reading_value = rowMap[t.id].reading_value;
              rec.adjust_value = rowMap[t.id].adjust_value;
              rec._orig = {
                reading_value: rec.reading_value,
                adjust_value: rec.adjust_value,
              };
            } else {
              rec.reading_value = "";
              rec.adjust_value = 0;
              rec._orig = { reading_value: "", adjust_value: 0 };
            }

            updated[t.id] = rec;
          });

          return updated;
        });
      } catch (e) {
        console.error("loadTodayReadings error:", e);
      }
    },
    [api, totalizersByUnit]
  );

  /* =============================================================
      LOAD YESTERDAY READINGS → BASE FOR DIFFERENCE
     ============================================================= */
  const loadYesterday = useCallback(
    async (forDate, unit) => {
      try {
        const d = new Date(forDate);
        d.setDate(d.getDate() - 1);
        const y = d.toISOString().slice(0, 10);

        const r = await api.get("/totalizers/readings", { params: { date: y } });
        const rows = r.data || [];

        const rowMap = {};
        rows.forEach((rr) => {
          rowMap[rr.totalizer_id] = Number(rr.reading_value || 0);
        });

        setReadingsForm((prev) => {
          const updated = { ...prev };
          const items = totalizersByUnit[unit] || [];

          items.forEach((t) => {
            const rec = updated[t.id];
            if (!rec) return;

            rec.yesterday = rowMap[t.id] ?? 0;

            // recalc
            if (rec.reading_value === "") rec.difference = "";
            else {
              const today = Number(rec.reading_value || 0);
              const adj = canAdjust ? Number(rec.adjust_value || 0) : 0;
              rec.difference = Number((today - rec.yesterday + adj).toFixed(3));
            }

            updated[t.id] = rec;
          });

          return updated;
        });
      } catch (e) {
        // no yesterday → all zero
        setReadingsForm((prev) => {
          const updated = { ...prev };
          const items = totalizersByUnit[unit] || [];
          items.forEach((t) => {
            const rec = updated[t.id];
            if (rec) {
              rec.yesterday = 0;
              if (rec.reading_value === "") rec.difference = "";
              else
                rec.difference = Number(
                  (Number(rec.reading_value || 0) + (canAdjust ? Number(rec.adjust_value || 0) : 0)).toFixed(3)
                );
              updated[t.id] = rec;
            }
          });
          return updated;
        });
      }
    },
    [api, totalizersByUnit, canAdjust]
  );

  /* =============================================================
      TRIGGER TODAY & YESTERDAY LOADS
     ============================================================= */
  useEffect(() => {
    loadTodayReadings(reportDate, activeTab);
    loadYesterday(reportDate, activeTab);
  }, [reportDate, activeTab, loadTodayReadings, loadYesterday]);

  /* =============================================================
      Input Update Handler
     ============================================================= */
  const updateField = (id, field, value) => {
    setReadingsForm((prev) => {
      const rec = { ...prev[id] };
      rec[field] = value === "" ? "" : Number(value);

      if (rec.reading_value === "") rec.difference = "";
      else {
        const today = Number(rec.reading_value || 0);
        const adj = canAdjust ? Number(rec.adjust_value || 0) : 0;
        const y = Number(rec.yesterday || 0);
        rec.difference = Number((today - y + adj).toFixed(3));
      }

      return { ...prev, [id]: rec };
    });
  };

  /* =============================================================
      Submit Preparation
     ============================================================= */
  const getChangedList = (unit) => {
    const list = [];
    const items = totalizersByUnit[unit] || [];

    items.forEach((t) => {
      const rec = readingsForm[t.id];
      if (!rec) return;

      const orig = rec._orig || { reading_value: "", adjust_value: 0 };

      // If value changed
      if (String(rec.reading_value) !== String(orig.reading_value) && rec.reading_value !== "") {
        list.push({ label: rec.display_name, value: rec.reading_value, id: t.id });
      } else if (canAdjust && String(rec.adjust_value) !== String(orig.adjust_value) && rec.adjust_value !== 0) {
        list.push({ label: rec.display_name + " (Adj)", value: rec.adjust_value, id: t.id });
      }
    });

    return list;
  };

  const handleSubmitClick = () => {
    const changed = getChangedList(activeTab);
    if (changed.length === 0) {
      setMessage("❌ No changes.");
      return;
    }

    // Non-admin cannot modify existing values
    if (!isAdmin && !isHOD) {
      for (const ch of changed) {
        const rec = readingsForm[ch.id];
        if (rec._orig.reading_value !== "") {
          setMessage(`❌ Only Admin/HOD can modify existing values (${ch.label})`);
          return;
        }
      }
    }

    setConfirmList(changed);
    setShowConfirmPopup(true);
  };

  /* =============================================================
      Confirm Submit
     ============================================================= */
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
            if (!rec || rec.reading_value === "") return null;
            return {
              totalizer_id: t.id,
              reading_value: Number(rec.reading_value),
              adjust_value: canAdjust ? Number(rec.adjust_value || 0) : 0,
            };
          })
          .filter(Boolean),
      };

      await api.post("/totalizers/submit", payload);

      // snapshot back
      setReadingsForm((prev) => {
        const updated = { ...prev };
        items.forEach((t) => {
          const rec = updated[t.id];
          if (rec) {
            rec._orig = {
              reading_value: rec.reading_value,
              adjust_value: rec.adjust_value,
            };
          }
        });
        return updated;
      });

      setMessage("✅ Saved successfully");

      // refresh yesterday after submit
      loadYesterday(reportDate, activeTab);

    } catch (e) {
      const det = e?.response?.data?.detail || "Error saving";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting(false);
    }
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
    } catch (e) {
      setMessage("❌ Error seeding master");
    }
  };

  /* =============================================================
      RENDER TOTALIZER CARD
     ============================================================= */
  const renderCard = (t) => {
    const rec = readingsForm[t.id];
    if (!rec) return null;

    const editable = canEdit(t.name);
    const orig = rec._orig || { reading_value: "", adjust_value: 0 };
    const origExists = orig.reading_value !== "";

    const readOnly = !editable || (!isAdmin && origExists);

    return (
      <div key={t.id} className="p-3 border rounded-xl bg-zinc-50 shadow-sm">
        <div className="font-medium text-sm">{t.display_name}</div>

        <div className="text-xs text-gray-600 mt-1">
          Yesterday: <span className="font-semibold">{rec.yesterday}</span>
        </div>

        {/* Today reading */}
        <label className="block mt-2 text-xs font-semibold text-gray-700">Today's Reading</label>
        <input
          type="number"
          value={rec.reading_value === "" ? "" : rec.reading_value}
          readOnly={readOnly}
          onChange={(e) => updateField(t.id, "reading_value", e.target.value)}
          className={`w-full p-2 mt-1 rounded border ${
            readOnly
              ? "bg-gray-100 text-gray-600 cursor-not-allowed"
              : "bg-white focus:ring-2 focus:ring-orange-500"
          }`}
        />

        {/* Adjustment */}
        {canAdjust && (
          <>
            <label className="block mt-2 text-xs font-semibold text-gray-700">Adjustment</label>
            <input
              type="number"
              value={rec.adjust_value}
              onChange={(e) => updateField(t.id, "adjust_value", e.target.value)}
              className="w-full p-2 mt-1 rounded border bg-white focus:ring-2 focus:ring-orange-500"
            />
          </>
        )}

        <div className="mt-3 text-sm">
          <strong>Difference:</strong>{" "}
          <span className="font-semibold">{rec.difference === "" ? "—" : rec.difference}</span>
        </div>
      </div>
    );
  };

  /* =============================================================
      UI / JSX
     ============================================================= */
  return (
    <div className="flex gap-6 max-w-7xl mx-auto">

      {/* Sidebar */}
      <aside className="w-48 bg-white rounded-xl border p-3 flex flex-col gap-5 shadow-sm">
        <div>
          <label className="text-xs text-gray-500 font-medium">Select Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full p-2 mt-1 rounded border bg-gray-50"
          />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Tabs</div>
          {["Unit-1", "Unit-2", "Station"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`p-2 text-left rounded-md ${
                activeTab === t
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            onClick={seedMaster}
            className="p-2 bg-blue-600 text-white rounded-md"
          >
            Seed Master
          </button>
        )}

        <div className="text-xs text-gray-600">
          Role: <strong>{roleId ?? "-"}</strong>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1">
        <div className="bg-white border rounded-xl p-4 shadow">

          <div className="flex justify-between">
            <h2 className="text-lg font-semibold text-gray-600">
              {activeTab} Totalizer Entry
            </h2>

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

          <div className="w-full h-px bg-gray-200 mt-3 mb-5" />

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(totalizersByUnit[activeTab] || []).map((t) => renderCard(t))}
          </div>

          {/* Buttons */}
          <div className="mt-6">
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="px-6 py-2 rounded-md text-white bg-orange-500 hover:bg-orange-600"
            >
              {submitting ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => loadYesterday(reportDate, activeTab)}
              className="ml-3 px-5 py-2 rounded-md border"
            >
              Refresh Yesterday
            </button>
          </div>

          {/* Confirm Popup */}
          {showConfirmPopup && (
            <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
              <div className="bg-white p-5 rounded-xl w-96 shadow">
                <h3 className="text-lg font-semibold text-center text-orange-700 mb-3">
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
        </div>
      </main>
    </div>
  );
}
