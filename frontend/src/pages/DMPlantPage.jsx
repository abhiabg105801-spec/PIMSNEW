// pages/DMPlantPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/**
 * DMPlantPage.jsx
 * - Vertical unit tabs -> collapsible section lists -> parameter form
 * - Bulk submit: POST /api/dm-plant/add-section
 * - Report fetch: GET  /api/dm-plant/report?date=YYYY-MM-DD
 *
 * Notes:
 * - Auth token: passed via `auth` prop or read from localStorage "authToken"
 * - SAMPLE_PDF_PATH uses the uploaded file path in your environment:
 *     "/mnt/data/dm plant daily report dated 14.12.2023 (1).pdf"
 *
 * Role editing rules implemented:
 *  - role_id === 8 (Admin) -> can edit any field (always)
 *  - role_id === 5 (DM editor) -> can edit a field only if it is empty
 *  - Others -> cannot submit
 *
 * Sidebar is scrollable (independent); page does not require vertical scrolling to reach sidebar items.
 */

const API_URL = "http://localhost:8080/api";
// uploaded sample PDF path (use local path from your environment)
const SAMPLE_PDF_PATH = "/mnt/data/dm plant daily report dated 14.12.2023 (1).pdf";

const Spinner = ({ size = 14 }) => (
  <div
    style={{ width: size, height: size }}
    className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current"
  />
);

const CHEMICAL_PARAMETERS = [
  { key: "pH", label: "pH" },
  { key: "do_ppm", label: "DO (ppm)" },
  { key: "tds_ppm", label: "TDS (ppm)" },
  { key: "conductivity", label: "Conductivity" },
  { key: "hardness", label: "Hardness" },
  { key: "fe_ppm", label: "Fe (ppm)" },
];

const SECTION_DEFINITIONS = [
  // Unit-1
  { unit: "Unit-1", section: "Condensate Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-1", section: "Drum Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-1", section: "Feed Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-1", section: "Hot Reheated Steam", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-1", section: "Saturated Steam", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-1", section: "Super Heated Steam", params: CHEMICAL_PARAMETERS },

  // Unit-2
  { unit: "Unit-2", section: "Condensate Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-2", section: "Drum Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-2", section: "Feed Water", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-2", section: "Hot Reheated Steam", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-2", section: "Saturated Steam", params: CHEMICAL_PARAMETERS },
  { unit: "Unit-2", section: "Super Heated Steam", params: CHEMICAL_PARAMETERS },

  // Station
  {
    unit: "Station",
    section: "Circulating Water",
    params: [
      { key: "cl_ppm", label: "Cl (ppm)" },
      { key: "tds_ppm", label: "TDS (ppm)" },
      { key: "temp_c", label: "Temp (°C)" },
      { key: "turbidity_ntu", label: "Turbidity (NTU)" },
    ],
  },

  // Coal
  {
    unit: "Coal",
    section: "Proximate Analysis",
    params: [
      { key: "moisture_pct", label: "Moisture (%)" },
      { key: "ash_pct", label: "Ash (%)" },
      { key: "fixed_carbon_pct", label: "Fixed Carbon (%)" },
      { key: "volatile_pct", label: "Volatile (%)" },
      { key: "gcv_kcalkg", label: "GCV (kcal/kg)" },
    ],
  },
  {
    unit: "Coal",
    section: "Sieve Analysis",
    params: [
      { key: "pct_200mesh", label: "% 200 Mesh" },
      { key: "pct_100mesh", label: "% 100 Mesh" },
      { key: "pct_gt_50mesh", label: "% >50 Mesh" },
    ],
  },
  {
    unit: "Coal",
    section: "Combustible Analysis",
    params: [
      { key: "combustible_ba", label: "BA (%)" },
      { key: "combustible_eco", label: "ECO (%)" },
      { key: "combustible_esp", label: "ESP (%)" },
    ],
  },

  // DM
  {
    unit: "DM",
    section: "Tank Levels & Usage",
    params: [
      { key: "tank1_level_m", label: "Tank1 Level (m)" },
      { key: "tank2_level_m", label: "Tank2 Level (m)" },
      { key: "dm_produced_t", label: "Produced (T)" },
      { key: "dm_used_t", label: "Used (T)" },
    ],
  },

  // Chem
  {
    unit: "Chem",
    section: "Chemical Consumption",
    params: [
      { key: "ammonia_l", label: "Ammonia (L)" },
      { key: "hydrazine_l", label: "Hydrazine (L)" },
      { key: "tsp_kg", label: "Tri Sodium Phosphate (kg)" },
    ],
  },
  {
    unit: "Chem",
    section: "Chemical Stock",
    params: [
      { key: "ammonia_stock_l", label: "Ammonia Stock (L)" },
      { key: "hydrazine_stock_l", label: "Hydrazine Stock (L)" },
      { key: "naoh_stock_kg", label: "Sodium Hydroxide (kg)" },
      { key: "hcl_stock_kg", label: "HCl (kg)" },
      { key: "tsp_stock_kg", label: "Tri Sodium Phosphate (kg)" },
    ],
  },
];

const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") ? `Bearer ${localStorage.getItem("authToken")}` : "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};
const getTokenPayload = (authHeader) => {
  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json;
  } catch {
    return null;
  }
};

function emptySectionForm(unit, section, params) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const entries = (params || []).map((p) => ({ parameter: p.key, label: p.label, value: "", remarks: "" }));
  return { date, time, unit, section, entries };
}

export default function DMPlantPage({ auth }) {
  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      }),
    [authHeader]
  );

  const [roleId, setRoleId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [permissionMap, setPermissionMap] = useState({});
  const [permLoading, setPermLoading] = useState(false);

  // UI
  const [activeUnit, setActiveUnit] = useState("Unit-1");
  const [activeSection, setActiveSection] = useState(
    SECTION_DEFINITIONS.find((s) => s.unit === "Unit-1")?.section || SECTION_DEFINITIONS[0].section
  );
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Collapsible units state (true = expanded)
  const units = [...new Set(SECTION_DEFINITIONS.map((s) => s.unit))];
  const initialCollapsed = {};
  units.forEach((u) => {
    initialCollapsed[u] = true; // default expanded
  });
  const [unitExpanded, setUnitExpanded] = useState(initialCollapsed);

  // form for selected section
  const paramsForActive = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
  const [sectionForm, setSectionForm] = useState(emptySectionForm(activeUnit, activeSection, paramsForActive));

  // report
  const [reportStats, setReportStats] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    setRoleLoading(true);
    let cancelled = false;
    const payload = getTokenPayload(authHeader);
    if (payload) {
      if (!cancelled) {
        setRoleId(payload.role_id || payload.role || null);
        setCurrentUser(payload);
        setRoleLoading(false);
      }
      return () => {
        cancelled = true;
      };
    }
    api
      .get("/auth/me")
      .then((r) => {
        if (!cancelled) {
          setCurrentUser(r.data);
          setRoleId(r.data?.role_id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, authHeader]);

  // fetch permissions (kept for compatibility but DM page logic ignores them for edit rights)
  useEffect(() => {
    let cancelled = false;
    async function fetchPerms() {
      setPermLoading(true);
      try {
        if (roleId) {
          const r = await api.get(`/admin/permissions/${roleId}`);
          if (cancelled) return;
          const map = {};
          (r.data || []).forEach((p) => {
            map[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view };
          });
          setPermissionMap(map);
          return;
        }
        const r2 = await api.get("/permissions/me");
        if (cancelled) return;
        const map2 = {};
        (r2.data || []).forEach((p) => {
          map2[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view };
        });
        setPermissionMap(map2);
      } catch (e) {
        try {
          const r2 = await api.get("/permissions/me");
          if (!cancelled) {
            const map2 = {};
            (r2.data || []).forEach((p) => {
              map2[p.field_name] = { can_edit: !!p.can_edit, can_view: !!p.can_view };
            });
            setPermissionMap(map2);
          }
        } catch {
          if (!cancelled) setPermissionMap({});
        }
      } finally {
        if (!cancelled) setPermLoading(false);
      }
    }
    fetchPerms();
    return () => {
      cancelled = true;
    };
  }, [api, roleId]);

  // convenience flags
  const isDMEditor = roleId === 5 || roleId === 8;
  const isAdmin = roleId === 8;

  // sync sectionForm when active unit/section change
  useEffect(() => {
    const params = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
    setSectionForm(emptySectionForm(activeUnit, activeSection, params));
  }, [activeUnit, activeSection]);

  // helper permissions (canView uses permissionMap, but editing rules use roleId logic)
  const canView = (fieldName) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[fieldName];
    if (!p) return true;
    return !!p.can_view;
  };
  const canEdit = (fieldName) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) return true;
    const p = permissionMap[fieldName];
    if (!p) return false;
    return !!p.can_edit;
  };

  // update entry value
  const updateEntryValue = (idx, patch) => {
    setSectionForm((s) => {
      const next = { ...s, entries: s.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)) };
      return next;
    });
  };

  // toggle unit expansion
  const toggleUnit = (u) => setUnitExpanded((prev) => ({ ...prev, [u]: !prev[u] }));

  // submit section in bulk (POST /dm-plant/add-section)
  const handleSubmitSection = async () => {
    setMessage("");
    if (!isDMEditor) {
      setMessage("❌ You are not authorized to submit DM Plant data.");
      return;
    }

    // Basic validation: at least one numeric entry filled
    const filled = sectionForm.entries.filter((e) => e.value !== "" && e.value !== null);
    if (filled.length === 0) {
      setMessage("⚠️ Please fill at least one parameter value before submitting.");
      return;
    }

    // Validate numeric and check editing rights per entry
    for (let i = 0; i < filled.length; i++) {
      const ent = filled[i];
      if (isNaN(Number(ent.value))) {
        setMessage(`⚠️ Value for ${ent.label} must be numeric.`);
        return;
      }
      // editing rule: only admin can change existing non-empty values.
      // Our form only allows editing empty fields for role 5 by UI, but double-check server-side
      // (this check is mostly to provide user-friendly message)
    }

    setSubmitting(true);
    try {
      // Build payload in the contract format
      const payload = {
        date: sectionForm.date,
        time: sectionForm.time,
        unit: sectionForm.unit,
        section: sectionForm.section,
        entries: sectionForm.entries
          .filter((e) => e.value !== "" && e.value !== null)
          .map((e) => ({
            parameter: e.parameter,
            value: Number(e.value),
            remarks: e.remarks && e.remarks.trim() !== "" ? e.remarks.trim() : null,
          })),
      };

      await api.post("/dm-plant/add-section", payload);

      setMessage("✅ Section data submitted successfully.");
      // refresh report & reset form for this section
      fetchReportStats();
      const params = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
      setSectionForm(emptySectionForm(activeUnit, activeSection, params));
    } catch (e) {
      console.error("submit error", e);
      const det = e.response?.data?.detail || e.message || "Error saving section";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting(false);
    }
  };

  // report fetch
  const fetchReportStats = async () => {
    setReportLoading(true);
    setReportStats(null);
    setMessage("");
    try {
      const res = await api.get(`/dm-plant/report`, { params: { date: reportDate } });
      setReportStats(res.data);
    } catch (e) {
      console.error("report fetch error", e);
      const det = e.response?.data?.detail || "Could not fetch DM plant report.";
      setMessage(`⚠️ ${det}`);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchReportStats();
    // eslint-disable-next-line
  }, [reportDate]);

  // Convert report stats into rows
  const parseStats = (statsObj) => {
    if (!statsObj || !statsObj.stats) return [];
    // Expect stats to be an object where keys are "Unit | Section | Parameter" or stringified tuple
    return Object.entries(statsObj.stats).map(([k, v]) => {
      let unit = "",
        section = "",
        parameter = "";
      if (k.includes("|")) {
        const parts = k.split("|").map((p) => p.trim());
        unit = parts[0] || "";
        section = parts[1] || "";
        parameter = parts[2] || "";
      } else {
        // try parse tuple-like string
        try {
          const inside = k.trim().startsWith("(") && k.trim().endsWith(")") ? k.trim().slice(1, -1) : k;
          const parts = inside.split(",").map((p) => p.trim().replace(/^['"]|['"]$/g, ""));
          unit = parts[0] || "";
          section = parts[1] || "";
          parameter = parts[2] || "";
        } catch {
          unit = k;
          section = "";
          parameter = "";
        }
      }
      return {
        unit,
        section,
        parameter,
        avg: v.avg ?? "-",
        min: v.min ?? "-",
        max: v.max ?? "-",
        count: v.count ?? 0,
      };
    });
  };

  const sectionsForActiveUnit = SECTION_DEFINITIONS.filter((s) => s.unit === activeUnit).map((s) => s.section);

  return (
    <div className="flex gap-6 p-6 max-w-7xl mx-auto">
      {/* Left vertical nav (scrollable independent) */}
      <aside
        className="w-72 bg-white rounded-lg shadow py-4 px-2 flex flex-col"
        style={{ maxHeight: "calc(100vh - 48px)", position: "sticky", top: "24px" }}
      >
        <div className="px-3 pb-3">
          <label className="block text-xs text-gray-500">Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full p-2 rounded border border-gray-300"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {units.map((u) => (
            <div key={u} className="mb-2">
              <div className="flex items-center gap-2 px-2">
                <button
                  onClick={() => {
                    // toggle expand / collapse
                    toggleUnit(u);
                  }}
                  className={`flex-1 text-left px-3 py-2 rounded-md font-medium flex items-center justify-between ${
                    unitExpanded[u] ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <span>{u}</span>
                  <span className="text-xs opacity-80">{unitExpanded[u] ? "▾" : "▸"}</span>
                </button>
              </div>

              {/* sections nested (collapsible) */}
              {unitExpanded[u] && (
                <div className="pl-4 mt-2 space-y-1">
                  {SECTION_DEFINITIONS.filter((s) => s.unit === u).map((sec) => (
                    <button
                      key={sec.section}
                      onClick={() => {
                        setActiveUnit(u);
                        setActiveSection(sec.section);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-sm text-sm ${
                        activeUnit === u && activeSection === sec.section
                          ? "bg-orange-100 text-orange-800"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {sec.section}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-3 pt-3">
          <a href={SAMPLE_PDF_PATH} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
            View sample DM Plant PDF
          </a>
          <div className="mt-3 text-xs text-gray-500">
            <div>
              <strong>Role:</strong> {roleLoading ? <Spinner size={12} /> : (currentUser?.role_id ?? roleId ?? "Unknown")}
            </div>
            <div className="mt-2 text-orange-700">{message}</div>
          </div>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {activeUnit} — {activeSection}
            </h2>
            <div className="text-sm text-gray-600">
              {permLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size={12} /> Loading permissions
                </span>
              ) : (
                <span className="text-green-600">Permissions loaded</span>
              )}
            </div>
          </div>

          {/* Section form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Date</label>
                <input
                  type="date"
                  value={sectionForm.date}
                  onChange={(e) => setSectionForm((s) => ({ ...s, date: e.target.value }))}
                  className="w-full p-2 rounded border border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500">Time</label>
                <input
                  type="time"
                  value={sectionForm.time}
                  onChange={(e) => setSectionForm((s) => ({ ...s, time: e.target.value }))}
                  className="w-full p-2 rounded border border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500">Unit</label>
                <input type="text" value={sectionForm.unit} readOnly className="w-full p-2 rounded border border-gray-200 bg-gray-50" />
              </div>

              <div>
                <label className="block text-xs text-gray-500">Section</label>
                <input
                  type="text"
                  value={sectionForm.section}
                  readOnly
                  className="w-full p-2 rounded border border-gray-200 bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sectionForm.entries.map((e, idx) => {
                const fieldName = e.parameter;
                // Editable if admin OR (role 5/8 DM editor and field currently empty AND role is editor)
                const editable = isAdmin || (isDMEditor && (e.value === "" || e.value === null));
                const visible = canView(fieldName);
                // note: canEdit(fieldName) from permissionMap is not enforced strictly for DM; role logic used instead.
                if (!visible) return null;
                return (
                  <div key={fieldName} className="p-3 border rounded">
                    <label className="block text-xs text-gray-600 mb-1">{e.label}</label>
                    <input
                      type="number"
                      step="any"
                      value={e.value}
                      readOnly={!editable}
                      onChange={(ev) => updateEntryValue(idx, { value: ev.target.value })}
                      className={`w-full p-2 rounded border ${!editable ? "bg-orange-50 text-orange-800 border-orange-200 cursor-not-allowed" : "bg-white border-gray-300"}`}
                    />
                    <input
                      type="text"
                      placeholder="Remarks (optional)"
                      value={e.remarks}
                      onChange={(ev) => updateEntryValue(idx, { remarks: ev.target.value })}
                      className="w-full p-2 rounded border border-gray-200 mt-2 text-sm"
                    />
                    {!editable && (
                      <div className="text-xs text-gray-400 mt-1">Only admin can edit existing values.</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-3">
              <button
                disabled={!isDMEditor || submitting}
                onClick={handleSubmitSection}
                className={`px-4 py-2 rounded font-medium shadow ${submitting ? "bg-gray-300 text-gray-600" : "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:from-orange-600 hover:to-amber-500"}`}
              >
                {submitting ? "Submitting..." : "Submit Section Data"}
              </button>

              <button
                onClick={() => {
                  const params = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
                  setSectionForm(emptySectionForm(activeUnit, activeSection, params));
                  setMessage("");
                }}
                className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
              >
                Reset Form
              </button>
            </div>
          </div>

          {/* Report viewer */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium">Daily DM Stats</h3>
              <div className="text-sm text-gray-500">{reportLoading ? <Spinner /> : reportStats ? `${reportStats.total_entries || 0} entries aggregated` : ""}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-medium">Unit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Section</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Parameter</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Avg</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Min</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Max</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center">
                        <Spinner />
                      </td>
                    </tr>
                  )}
                  {!reportLoading && reportStats && parseStats(reportStats).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                        No DM Plant data available for this date.
                      </td>
                    </tr>
                  )}
                  {!reportLoading &&
                    reportStats &&
                    parseStats(reportStats).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 text-sm">{r.unit}</td>
                        <td className="px-3 py-2 text-sm">{r.section}</td>
                        <td className="px-3 py-2 text-sm">{r.parameter}</td>
                        <td className="px-3 py-2 text-sm text-right">{r.avg}</td>
                        <td className="px-3 py-2 text-sm text-right">{r.min}</td>
                        <td className="px-3 py-2 text-sm text-right">{r.max}</td>
                        <td className="px-3 py-2 text-sm text-right">{r.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button onClick={fetchReportStats} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                Refresh
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
