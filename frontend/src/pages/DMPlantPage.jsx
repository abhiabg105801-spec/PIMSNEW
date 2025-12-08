// pages/DMPlantPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/**
 * DMPlantPage.jsx
 *
 * - Adds a multi-column chemical matrix view for common boiler/steam/water parameters.
 * - Uses a single API endpoint POST /dm-plant/add-matrix to save the entire matrix at once
 *   (you chose Option B). Payload format:
 *   {
 *     date: "YYYY-MM-DD",
 *     time: "HH:MM:SS",
 *     unit: "Unit-1",
 *     matrix: {
 *       "<parameter_key>": {
 *         "Condensate Water": "<value_or_empty>",
 *         "Feed Water": "<value_or_empty>",
 *         "Drum Water": "<value_or_empty>",
 *         "Saturated Steam": "<value_or_empty>",
 *         "Super Heated Steam": "<value_or_empty>",
 *         "Hot Reheated Steam": "<value_or_empty>"
 *       },
 *       ...
 *     }
 *   }
 *
 * - If you prefer a different payload shape for /dm-plant/add-matrix, change submitMatrix().
 * - The rest of your existing behaviour (sidebar, permissions, report read) is preserved.
 */

const API_URL = "http://localhost:8080/api";

const Spinner = ({ size = 14 }) => (
  <div
    style={{ width: size, height: size }}
    className="inline-block animate-spin border-2 border-t-transparent rounded-full border-current"
  />
);

/* ----------- Static lists ------------ */

// The columns to show in the chemical matrix (matches your screenshot)
const DM_COLUMNS = [
  "Condensate Water",
  "Feed Water",
  "Drum Water",
  "Saturated Steam",
  "Super Heated Steam",
  "Hot Reheated Steam",
];

// Full parameter list (rows) for the chemical matrix
const DM_PARAMETERS = [
  { key: "conductivity", label: "Conductivity (Micromhos/cm)" },
  { key: "ph", label: "pH" },
  { key: "b_reading", label: "B Reading in ml (Free)" },
  { key: "phosphate", label: "Phosphate (ppm)" },
  { key: "si02", label: "SiO2 (ppm)" },
  { key: "cl_ppm", label: "Cl (ppm) / TDS" },
  { key: "nh3", label: "NH3 (ppm)" },
  { key: "n2h4", label: "N2H4 (ppm)" },
  { key: "fe_ppm", label: "Fe (ppm)" },
  { key: "hardness", label: "Na / Hardness (ppm)" },
  { key: "turbidity", label: "Turbidity (NTU)" },
  { key: "o2", label: "O2 (ppm)" },
];

/* ----------- Helper functions ------------ */

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

/* initialize an empty matrixForm object */
function makeEmptyMatrix() {
  const obj = {};
  DM_PARAMETERS.forEach((p) => {
    obj[p.key] = {};
    DM_COLUMNS.forEach((c) => {
      obj[p.key][c] = "";
    });
  });
  return obj;
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

  // ----- auth / permissions
  const [roleId, setRoleId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [permissionMap, setPermissionMap] = useState({});
  const [permLoading, setPermLoading] = useState(false);

  // ----- UI state
  const [activeUnit, setActiveUnit] = useState("Unit-1");
  const [activeSection, setActiveSection] = useState(
    // default to first section of Unit-1
    null
  );

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // collapsible sidebar units
  const units = [...new Set(SECTION_DEFINITIONS.map((s) => s.unit))];
  const initialCollapsed = {};
  units.forEach((u) => {
    initialCollapsed[u] = false;
  });
  const [unitExpanded, setUnitExpanded] = useState(initialCollapsed);

  // section form and fields
  const paramsForActive = useMemo(
    () => SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [],
    [activeUnit, activeSection]
  );
  const [sectionForm, setSectionForm] = useState(() =>
    emptySectionForm("Unit-1", SECTION_DEFINITIONS.find((s) => s.unit === "Unit-1")?.section || SECTION_DEFINITIONS[0].section, paramsForActive)
  );

  // matrix form (multi-column grid)
  const [matrixForm, setMatrixForm] = useState(() => makeEmptyMatrix());

  // report summary
  const [reportStats, setReportStats] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // raw values cache and expanded state
  const rawCache = useRef({}); // key => array of raw entries
  const [allRawData, setAllRawData] = useState({}); // reactive copy for rendering
  const [expandedRows, setExpandedRows] = useState({}); // key => bool
  const [rawLoadingKeys, setRawLoadingKeys] = useState({}); // key => bool

  // convenience flags
  const isDMEditor = roleId === 5 || roleId === 8;
  const isAdmin = roleId === 8;

  // ---------- AUTH / PERMISSIONS: get current user (token payload or /auth/me)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, authHeader]);

  // fetch permissions (kept for compatibility)
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

  // --------- when activeUnit/activeSection changes, reset forms as appropriate
  useEffect(() => {
    // If nothing chosen yet, pick a sensible default:
    if (!activeSection) {
      const def = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit);
      if (def) {
        setActiveSection(def.section);
        return;
      }
    }

    const params = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
    setSectionForm(emptySectionForm(activeUnit, activeSection, params));

    // Reset matrix if the switch happens
    setMatrixForm(makeEmptyMatrix());

    // clear expanded / raw cache for UI clarity (optional)
    setExpandedRows({});
    rawCache.current = {};
    setAllRawData({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUnit, activeSection]);

  // helper permission checks
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

  // update entry value (legacy per-section entry)
  const updateEntryValue = (idx, patch) => {
    setSectionForm((s) => {
      const next = { ...s, entries: s.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)) };
      return next;
    });
  };

  // update matrix cell
  const updateMatrixCell = (parameterKey, column, value) => {
    setMatrixForm((old) => ({
      ...old,
      [parameterKey]: {
        ...old[parameterKey],
        [column]: value,
      },
    }));
  };

  // toggle unit expansion
  const toggleUnit = (u) => setUnitExpanded((prev) => ({ ...prev, [u]: !prev[u] }));

  // ---------------- SUBMIT SECTION (bulk) - legacy path (keeps working)
  const handleSubmitSection = async () => {
    setMessage("");
    if (!isDMEditor) {
      setMessage("❌ You are not authorized to submit DM Plant data.");
      return;
    }

    const filled = sectionForm.entries.filter((e) => e.value !== "" && e.value !== null);
    if (filled.length === 0) {
      setMessage("⚠️ Please fill at least one parameter value before submitting.");
      return;
    }

    for (let i = 0; i < filled.length; i++) {
      const ent = filled[i];
      if (isNaN(Number(ent.value))) {
        setMessage(`⚠️ Value for ${ent.label} must be numeric.`);
        return;
      }
    }

    setSubmitting(true);
    try {
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
      // refresh report for the same date (sectionForm.date)
      fetchReportStats(sectionForm.date);
      // reset form entries for current section
      const params = SECTION_DEFINITIONS.find((s) => s.unit === activeUnit && s.section === activeSection)?.params || [];
      setSectionForm(emptySectionForm(activeUnit, activeSection, params));
      // clear raw cache for that date because new entries may be present
      rawCache.current = {};
      setAllRawData({});
      setExpandedRows({});
    } catch (e) {
      console.error("submit error", e);
      const det = e.response?.data?.detail || e.message || "Error saving section";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- SUBMIT MATRIX (Option B: single API call)
  const submitMatrix = async () => {
    setMessage("");
    if (!isDMEditor) {
      setMessage("❌ You are not authorized to submit DM Plant data.");
      return;
    }

    // Validate numeric values where present
    for (const pKey of Object.keys(matrixForm)) {
      for (const col of DM_COLUMNS) {
        const v = matrixForm[pKey][col];
        if (v !== "" && v !== null) {
          if (isNaN(Number(v))) {
            setMessage(`⚠️ Value for ${pKey} in ${col} must be numeric.`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      // payload structure for /dm-plant/add-matrix (adjustable if your backend expects different)
      const payload = {
        date: sectionForm.date,
        time: sectionForm.time,
        unit: activeUnit,
        matrix: matrixForm,
      };

      await api.post("/dm-plant/add-matrix", payload);
      setMessage("✅ Matrix data submitted successfully.");
      // refresh report
      fetchReportStats(sectionForm.date);
      // optionally clear matrix (kept filled so user can see)
      // setMatrixForm(makeEmptyMatrix());
    } catch (e) {
      console.error("matrix submit error", e);
      const det = e.response?.data?.detail || e.message || "Error saving matrix";
      setMessage(`❌ ${det}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- FETCH REPORT SUMMARY (uses sectionForm.date)
  const fetchReportStats = async (dateToFetch = null) => {
    setReportLoading(true);
    setReportStats(null);
    setMessage("");
    try {
      const dateParam = dateToFetch || sectionForm.date;
      const res = await api.get(`/dm-plant/report`, { params: { date: dateParam } });
      setReportStats(res.data);
      // clear raw cache because date changed
      rawCache.current = {};
      setAllRawData({});
      setExpandedRows({});
    } catch (e) {
      console.error("report fetch error", e);
      const det = e.response?.data?.detail || "Could not fetch DM plant report.";
      setMessage(`⚠️ ${det}`);
    } finally {
      setReportLoading(false);
    }
  };

  // When the form date changes, fetch the report for that date automatically.
  useEffect(() => {
    if (sectionForm?.date) {
      fetchReportStats(sectionForm.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionForm.date]);

  // parse stats into rows (existing code kept)
  const parseStats = (statsObj) => {
    if (!statsObj || !statsObj.stats) return [];
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

  // fetch raw values for a particular row (caching)
  const fetchRawForRow = async (r) => {
    const key = `${r.unit}_${r.section}_${r.parameter}`;
    if (rawCache.current[key]) {
      // already cached
      setAllRawData((old) => ({ ...old, [key]: rawCache.current[key] }));
      return;
    }

    // mark loading for this key
    setRawLoadingKeys((s) => ({ ...s, [key]: true }));

    try {
      const res = await api.get("/dm-plant/raw", {
        params: {
          date: sectionForm.date,
          unit: r.unit,
          section: r.section,
          parameter: r.parameter,
        },
      });
      rawCache.current[key] = res.data || [];
      setAllRawData((old) => ({ ...old, [key]: rawCache.current[key] }));
    } catch (e) {
      console.error("raw fetch error", e);
      rawCache.current[key] = [];
      setAllRawData((old) => ({ ...old, [key]: [] }));
    } finally {
      setRawLoadingKeys((s) => {
        const copy = { ...s };
        delete copy[key];
        return copy;
      });
    }
  };

  // toggle expand row (and fetch raw if needed)
  const toggleExpandRow = async (r) => {
    const key = `${r.unit}_${r.section}_${r.parameter}`;
    const isExpanded = !!expandedRows[key];
    // toggle
    setExpandedRows((s) => ({ ...s, [key]: !isExpanded }));

    // if expanding and not cached, fetch
    if (!isExpanded && !rawCache.current[key]) {
      await fetchRawForRow(r);
    }
  };

  const sectionsForActiveUnit = SECTION_DEFINITIONS.filter((s) => s.unit === activeUnit).map((s) => s.section);

  /* ---------- Decide when to show the matrix ----------
     We will display the multi-column matrix view when the current unit has the common steam/water sections.
     If the activeSection is one of the DM_COLUMNS (a chemical stream), we'll show the matrix view that lets user
     input all streams at once for that unit.
  */
  const matrixApplicable = DM_COLUMNS.includes(activeSection);

  return (
    <div className="flex gap-6 p-6 max-w-7xl mx-auto">
      {/* Left vertical nav (scrollable independent) */}
      <aside
        className="w-60 bg-white border border-gray-300 rounded-lg shadow-sm py-4 px-3 flex flex-col"
        style={{ maxHeight: "calc(100vh - 48px)", position: "sticky", top: "24px" }}
      >
        {/* Date + Report Button */}
        <div className="pb-3">
          <label className="block text-xs text-gray-600 font-medium">Date</label>

          <button
            onClick={() => (window.location.href = "/dm-plant-report")}
            className="mt-3 px-3 py-2 w-full bg-[#E06A1B] hover:bg-[#C65E17] text-white text-sm rounded-md shadow-sm transition"
          >
            View DM Plant Report
          </button>
        </div>

        {/* Units + Sections Navigation */}
        <div className="flex-1 overflow-y-auto pr-1">
          {units.map((u) => (
            <div key={u} className="mb-3">
              {/* Unit Expand Button */}
              <button
                onClick={() => toggleUnit(u)}
                className={`
            w-full px-3 py-2 rounded-md font-semibold flex items-center justify-between
            ${unitExpanded[u] ? "bg-[#E06A1B] text-white" : "bg-gray-100 text-[#6B6B6B] hover:bg-gray-200"}
          `}
              >
                <span>{u}</span>
                <span className="text-xs opacity-90">{unitExpanded[u] ? "▾" : "▸"}</span>
              </button>

              {/* Section List */}
              {unitExpanded[u] && (
                <div className="pl-4 mt-2 space-y-1">
                  {SECTION_DEFINITIONS.filter((s) => s.unit === u).map((sec) => (
                    <button
                      key={sec.section}
                      onClick={() => {
                        setActiveUnit(u);
                        setActiveSection(sec.section);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md text-sm ${
                        activeUnit === u && activeSection === sec.section ? "bg-orange-100 text-[#E06A1B] font-medium" : "text-gray-600 hover:bg-gray-100"
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

        {/* Footer Info */}
        <div className="pt-3 text-xs text-gray-500">
          <div className="mb-2">
            <strong>Role:</strong> {roleLoading ? <Spinner size={12} /> : currentUser?.role_id ?? roleId}
          </div>
          <div className="text-[#E06A1B] font-medium">{message}</div>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{activeUnit} — {activeSection}</h2>
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

          {/* Section form (date/time/unit/section) */}
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
                <input type="text" value={activeUnit} readOnly className="w-full p-2 rounded border border-gray-200 bg-gray-50" />
              </div>

              <div>
                <label className="block text-xs text-gray-500">Section</label>
                <input
                  type="text"
                  value={activeSection || ""}
                  readOnly
                  className="w-full p-2 rounded border border-gray-200 bg-gray-50"
                />
              </div>
            </div>

            {/* ---------- MATRIX VIEW OR LEGACY PER-SECTION ENTRIES ---------- */}
            {matrixApplicable ? (
              /* MATRIX VIEW: show the multi-column grid for chemical inputs */
              <div className="overflow-x-auto mt-4 border rounded">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border px-3 py-2 text-sm font-semibold">Test Result</th>
                      {DM_COLUMNS.map((col) => (
                        <th key={col} className="border px-3 py-2 text-sm font-semibold text-center">{col}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {DM_PARAMETERS.map((p) => {
                      // permission check - parameter keys may be used to form permissionMap field names
                      const visible = canView(p.key);
                      if (!visible) return null;
                      // editable if admin OR DM editor (we enforce "only empty editable" behaviour at submit time if required)
                      const editableField = isAdmin || isDMEditor;
                      return (
                        <tr key={p.key} className="hover:bg-orange-50">
                          <td className="border px-3 py-2 text-sm font-medium bg-gray-50">{p.label}</td>

                          {DM_COLUMNS.map((col) => {
                            const value = matrixForm[p.key]?.[col] ?? "";
                            const readOnly = !editableField; // if not editor, read-only
                            return (
                              <td key={col} className="border px-1 py-1 text-center">
                                <input
                                  type="number"
                                  step="any"
                                  value={value}
                                  readOnly={readOnly}
                                  onChange={(e) => updateMatrixCell(p.key, col, e.target.value)}
                                  className={`w-full p-1 text-sm border rounded ${readOnly ? "bg-orange-50 text-orange-800 border-orange-200 cursor-not-allowed" : "bg-white border-gray-300"}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex gap-3 mt-3 p-3">
                  <button
                    disabled={!isDMEditor || submitting}
                    onClick={submitMatrix}
                    className={`px-4 py-2 rounded font-medium shadow ${submitting ? "bg-gray-300 text-gray-600" : "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:from-orange-600 hover:to-amber-500"}`}
                  >
                    {submitting ? "Submitting..." : "Save Matrix Data"}
                  </button>

                  <button
                    onClick={() => {
                      setMatrixForm(makeEmptyMatrix());
                      setMessage("");
                    }}
                    className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Reset Matrix
                  </button>

                  <div className="text-sm text-gray-500 self-center ml-auto">
                    {isAdmin ? "Admin: full edit" : isDMEditor ? "Editor: edit allowed" : "View only"}
                  </div>
                </div>
              </div>
            ) : (
              /* LEGACY per-parameter cards (kept for non-matrix sections) */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sectionForm.entries.map((e, idx) => {
                  const fieldName = e.parameter;
                  const editable = isAdmin || (isDMEditor && (e.value === "" || e.value === null));
                  const visible = canView(fieldName);
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
                      {!editable && <div className="text-xs text-gray-400 mt-1">Only admin can edit existing values.</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Buttons for legacy per-section save (if not using matrix) */}
            {!matrixApplicable && (
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
            )}
          </div>

          {/* Report viewer */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium">Daily DM Stats for {sectionForm.date}</h3>
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
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No DM Plant data available for this date.</td>
                    </tr>
                  )}

                  {!reportLoading &&
                    reportStats &&
                    parseStats(reportStats)
                      .filter((r) => r.unit === activeUnit && r.section === activeSection)
                      .map((r, i) => {
                        const key = `${r.unit}_${r.section}_${r.parameter}`;
                        const expanded = !!expandedRows[key];
                        const raws = allRawData[key] || [];
                        const loadingKey = !!rawLoadingKeys[key];

                        return (
                          <React.Fragment key={key}>
                            <tr onClick={() => toggleExpandRow(r)} className="border-t hover:bg-orange-50 cursor-pointer">
                              <td className="px-3 py-2 text-sm">{r.unit}</td>
                              <td className="px-3 py-2 text-sm">{r.section}</td>
                              <td className="px-3 py-2 text-sm flex items-center gap-2">
                                {r.parameter}
                                <span className="text-xs text-gray-500">{expanded ? "▾" : "▸"}</span>
                              </td>
                              <td className="px-3 py-2 text-sm text-right">{r.avg}</td>
                              <td className="px-3 py-2 text-sm text-right">{r.min}</td>
                              <td className="px-3 py-2 text-sm text-right">{r.max}</td>
                              <td className="px-3 py-2 text-sm text-right">{r.count}</td>
                            </tr>

                            {expanded && (
                              <tr className="bg-gray-50">
                                <td colSpan={7} className="p-3">
                                  {loadingKey ? (
                                    <div className="flex items-center gap-2">
                                      <Spinner /> <span>Loading raw values...</span>
                                    </div>
                                  ) : raws.length === 0 ? (
                                    <div className="text-gray-500 text-sm px-2 py-1">No raw data available.</div>
                                  ) : (
                                    <table className="min-w-full text-sm border mt-2">
                                      <thead>
                                        <tr className="bg-gray-200">
                                          <th className="px-2 py-1 text-left">Time</th>
                                          <th className="px-2 py-1 text-left">Value</th>
                                          <th className="px-2 py-1 text-left">Remarks</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {raws.map((rv, idx) => (
                                          <tr key={idx} className="border-t">
                                            <td className="px-2 py-1">{rv.time}</td>
                                            <td className="px-2 py-1">{rv.value}</td>
                                            <td className="px-2 py-1">{rv.remarks || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button onClick={() => fetchReportStats(sectionForm.date)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------- Note ---------------
 - This file preserves your original sidebar, permission checks and report viewer.
 - The multi-column matrix saves via POST /dm-plant/add-matrix (single call).
 - If your backend expects a different payload for add-matrix, update submitMatrix() accordingly.
 - If you want the matrix auto-filled from server (existing values for date/unit), we can add a GET endpoint call
   to fetch an existing matrix and populate matrixForm on date change.
------------------------------------- */

/* Keep the original SECTION_DEFINITIONS and CHEMICAL_PARAMETERS that were referenced at top of user's file */
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
