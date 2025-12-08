// PlantShutdownPage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

/* ---------------------- Small UI components ---------------------- */
const TextInput = ({ label, name, value, onChange, type = "text", required = false }) => (
  <div>
    <label className="text-xs font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      name={name}
      value={value}
      onChange={onChange}
      type={type}
      className="w-full border p-2 rounded mt-1"
    />
  </div>
);

const TextArea = ({ label, name, value, onChange, rows = 3 }) => (
  <div>
    <label className="text-xs font-medium text-gray-700">{label}</label>
    <textarea
      name={name}
      rows={rows}
      value={value}
      onChange={onChange}
      className="w-full border p-2 rounded mt-1"
    />
  </div>
);

const SelectInput = ({ label, name, value, onChange, children, required = false }) => (
  <div>
    <label className="text-xs font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
    <select name={name} value={value} onChange={onChange} className="w-full border p-2 rounded mt-1">
      {children}
    </select>
  </div>
);

/* ---------------------- Modal ---------------------- */
const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-500 hover:text-black">✕</button>
        {children}
      </div>
    </div>
  );
};

/* ---------------------- Main Component ---------------------- */
export default function PlantShutdownPage({ auth }) {
  const API_BASE = "http://localhost:8080/api/shutdowns";
  const headers = { Authorization: auth };

  /* ---------- Shutdown form state (all fields) ---------- */
  const initialShutdown = {
    unit: "",
    shutdown_type: "",
    datetime_from: "",              // only 'From' in shutdown form
    responsible_agency: "",
    reason: "",
    remarks: "",
    shift_incharge: "",
    pretrip_status: "",
    first_cause: "",
    action_taken: "",
    restoration_sequence: "",
    notification_no: "",
  };
  const [shutdownForm, setShutdownForm] = useState(initialShutdown);
  const [editingShutdownId, setEditingShutdownId] = useState(null);

  /* file */
  const fileRef = useRef(null);
  const [rcaFile, setRcaFile] = useState(null);

  /* ---------- Sync modal state (all sync fields) ---------- */
  const initialSync = {
    sync_datetime: "",
    sync_shift_incharge: "",
    oil_used_kl: "",
    coal_t: "",
    oil_stabilization_kl: "",
    import_percent: "",
    sync_notes: "",
  };
  const [syncForm, setSyncForm] = useState(initialSync);
  const [syncTargetId, setSyncTargetId] = useState(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  /* ---------- Other state ---------- */
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  /* ---------- Helpers ---------- */
  const normalizeDT = (s) => {
    if (!s) return s;
    return s.length === 16 ? s + ":00" : s;
  };
  const fmt = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  /* ---------- Fetch latest 5 ---------- */
  const fetchLatest = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/latest`, { headers });
      setHistory(res.data || []);
    } catch (err) {
      console.error("fetchLatest err:", err);
      setMessage("Failed to fetch latest shutdowns.");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Shutdown handlers ---------- */
  const onShutdownChange = (e) => {
    const { name, value } = e.target;
    setShutdownForm((s) => ({ ...s, [name]: value }));
  };

  const onFileChange = (e) => {
    setRcaFile(e.target.files?.[0] || null);
  };

  const resetShutdownForm = () => {
    setShutdownForm(initialShutdown);
    setEditingShutdownId(null);
    setRcaFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitShutdown = async (e) => {
    e.preventDefault();
    setMessage("");
    // required
    if (!shutdownForm.unit || !shutdownForm.datetime_from) {
      setMessage("Unit and From (Date & Time) are required.");
      return;
    }

    const fd = new FormData();
    // append all shutdown fields (only send non-empty values)
    Object.entries(shutdownForm).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        fd.append(k, k === "datetime_from" ? normalizeDT(v) : v);
      }
    });
    if (rcaFile) fd.append("rca_file", rcaFile, rcaFile.name);

    try {
      if (editingShutdownId) {
        await axios.put(`${API_BASE}/${editingShutdownId}`, fd, { headers });
        setMessage("Shutdown updated.");
      } else {
        await axios.post(`${API_BASE}/`, fd, { headers });
        setMessage("Shutdown created.");
      }
      resetShutdownForm();
      fetchLatest();
    } catch (err) {
      console.error("submitShutdown err:", err);
      if (err.response?.status === 422) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          setMessage(detail.map(d => (d.loc ? `${d.loc.join(".")}: ${d.msg}` : d.msg)).join("; "));
        } else setMessage(JSON.stringify(err.response.data));
      } else {
        setMessage(err.response?.data?.detail || "Failed to save shutdown.");
      }
    }
  };

  const startEditShutdown = (rec) => {
    setEditingShutdownId(rec.id);
    setShutdownForm({
      unit: rec.unit || "",
      shutdown_type: rec.shutdown_type || "",
      datetime_from: rec.datetime_from ? rec.datetime_from.slice(0, 16) : "",
      responsible_agency: rec.responsible_agency || "",
      reason: rec.reason || "",
      remarks: rec.remarks || "",
      shift_incharge: rec.shift_incharge || "",
      pretrip_status: rec.pretrip_status || "",
      first_cause: rec.first_cause || "",
      action_taken: rec.action_taken || "",
      restoration_sequence: rec.restoration_sequence || "",
      notification_no: rec.notification_no || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- Sync modal handlers ---------- */
  const startAddSync = (rec) => {
    setSyncTargetId(rec.id);
    setSyncForm({
      sync_datetime: rec.sync_datetime ? rec.sync_datetime.slice(0, 16) : "",
      sync_shift_incharge: rec.sync_shift_incharge || rec.shift_incharge || "",
      oil_used_kl: rec.oil_used_kl ?? "",
      coal_t: rec.coal_t ?? "",
      oil_stabilization_kl: rec.oil_stabilization_kl ?? "",
      import_percent: rec.import_percent ?? "",
      sync_notes: rec.sync_notes || "",
    });
    setSyncModalOpen(true);
  };

  const onSyncChange = (e) => {
    const { name, value } = e.target;
    setSyncForm((s) => ({ ...s, [name]: value }));
  };

  const resetSync = () => {
    setSyncForm(initialSync);
    setSyncTargetId(null);
  };

  const submitSync = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!syncTargetId) {
      setMessage("No shutdown selected for synchronisation.");
      return;
    }
    if (!syncForm.sync_datetime) {
      setMessage("Sync Date & Time is required.");
      return;
    }

    const fd = new FormData();
    fd.append("sync_datetime", normalizeDT(syncForm.sync_datetime));
    // append optional sync fields
    ["sync_shift_incharge", "oil_used_kl", "coal_t", "oil_stabilization_kl", "import_percent", "sync_notes"]
      .forEach(k => {
        const v = syncForm[k];
        if (v !== undefined && v !== null && v !== "") fd.append(k, v);
      });

    try {
      // Option A: separate endpoint
      await axios.put(`${API_BASE}/${syncTargetId}/sync`, fd, { headers });
      setMessage("Synchronisation saved.");
      setSyncModalOpen(false);
      resetSync();
      fetchLatest();
    } catch (err) {
      console.error("submitSync err:", err);
      if (err.response?.status === 422) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          setMessage(detail.map(d => (d.loc ? `${d.loc.join(".")}: ${d.msg}` : d.msg)).join("; "));
        } else setMessage(JSON.stringify(err.response.data));
      } else {
        setMessage(err.response?.data?.detail || "Failed to save synchronisation.");
      }
    }
  };

  /* ---------------------- JSX ---------------------- */
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-[#E06A1B]">Shutdown & Synchronisation</h1>

      {/* message */}
      {message && (
        <div className="p-3 rounded bg-orange-50 text-[#E06A1B] border border-[#E06A1B]/30">
          {message}
        </div>
      )}

      {/* Shutdown form */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Shutdown Log (create / edit)</h2>

        <form onSubmit={submitShutdown} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectInput label="Unit" name="unit" value={shutdownForm.unit} onChange={onShutdownChange} required>
              <option value="">Select Unit</option>
              <option value="Unit-1">Unit-1</option>
              <option value="Unit-2">Unit-2</option>
            </SelectInput>

            <SelectInput
  label="Shutdown Type"
  name="shutdown_type"
  value={shutdownForm.shutdown_type}
  onChange={onShutdownChange}
>
  <option value="">Select Shutdown Type</option>
  <option value="Forced Outage">Forced Outage</option>
  <option value="Planned Outage">Planned Outage</option>
  <option value="Strategic Outage">Strategic Outage</option>
</SelectInput>
            <TextInput label="From (Date & Time)" name="datetime_from" type="datetime-local" value={shutdownForm.datetime_from} onChange={onShutdownChange} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Responsible Agency" name="responsible_agency" value={shutdownForm.responsible_agency} onChange={onShutdownChange} />
            <TextInput label="Breakdown Notification No." name="notification_no" value={shutdownForm.notification_no} onChange={onShutdownChange} />
            <TextInput label="Name of Shift Incharge" name="shift_incharge" value={shutdownForm.shift_incharge} onChange={onShutdownChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Pre-trip Status" name="pretrip_status" value={shutdownForm.pretrip_status} onChange={onShutdownChange} />
            <TextInput label="First Cause" name="first_cause" value={shutdownForm.first_cause} onChange={onShutdownChange} />
            <TextInput label="Action Taken" name="action_taken" value={shutdownForm.action_taken} onChange={onShutdownChange} />
          </div>

          <TextArea label="Reason" name="reason" value={shutdownForm.reason} onChange={onShutdownChange} rows={3} />
          <TextArea label="Remarks" name="remarks" value={shutdownForm.remarks} onChange={onShutdownChange} rows={2} />
          <TextArea label="Restoration Sequence" name="restoration_sequence" value={shutdownForm.restoration_sequence} onChange={onShutdownChange} rows={2} />

          <div>
            <label className="text-xs font-medium">RCA File (optional)</label>
            <input type="file" ref={fileRef} onChange={onFileChange} className="mt-1" />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-[#E06A1B] text-white py-2 rounded">
              {editingShutdownId ? "Update Shutdown" : "Save Shutdown"}
            </button>
            <button type="button" onClick={resetShutdownForm} className="px-4 py-2 border rounded">Reset</button>
          </div>
        </form>
      </section>

      {/* Sync modal */}
      <Modal open={syncModalOpen} onClose={() => setSyncModalOpen(false)}>
        <h3 className="text-lg font-semibold text-[#E06A1B] mb-3">Synchronisation</h3>
        <form onSubmit={submitSync} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput label="Sync Date & Time (To)" name="sync_datetime" type="datetime-local" value={syncForm.sync_datetime} onChange={onSyncChange} required />
            <TextInput label="Shift Incharge (Sync)" name="sync_shift_incharge" value={syncForm.sync_shift_incharge} onChange={onSyncChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Oil (KL) Used" name="oil_used_kl" type="number" value={syncForm.oil_used_kl} onChange={onSyncChange} />
            <TextInput label="Coal (T)" name="coal_t" type="number" value={syncForm.coal_t} onChange={onSyncChange} />
            <TextInput label="Oil Stabilization (KL)" name="oil_stabilization_kl" type="number" value={syncForm.oil_stabilization_kl} onChange={onSyncChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput label="Import (%)" name="import_percent" type="number" value={syncForm.import_percent} onChange={onSyncChange} />
            <TextInput label=" " name="__spacer" value="" onChange={() => {}} />
          </div>

          <TextArea label="Sync Notes" name="sync_notes" value={syncForm.sync_notes} onChange={onSyncChange} rows={3} />

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-[#E06A1B] text-white py-2 rounded">Save Sync</button>
            <button type="button" onClick={() => { setSyncModalOpen(false); resetSync(); }} className="px-4 py-2 border rounded">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* History (last 5) */}
      <section className="bg-white p-4 rounded shadow">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Last 5 Shutdowns</h2>
          <div className="flex gap-2">
            <button onClick={fetchLatest} className="px-3 py-1 bg-gray-100 rounded">Refresh</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[#E06A1B] text-white text-xs">
              <tr>
                <th className="p-2 border">From</th>
                <th className="p-2 border">Unit</th>
                <th className="p-2 border">Shutdown Type</th>
                <th className="p2 border">Reason</th>
                <th className="p-2 border">Duration</th>
                <th className="p-2 border">Sync Status</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center">No records found</td></tr>
              ) : (
                history.map((r) => (
                  <tr key={r.id} className="hover:bg-orange-50">
                    <td className="p-2 border">{fmt(r.datetime_from)}</td>
                    <td className="p-2 border">{r.unit}</td>
                    <td className="p-2 border">{r.shutdown_type || "-"}</td>
                    <td className="p-2 border max-w-[220px] truncate" title={r.reason}>{r.reason || "-"}</td>
                    <td className="p-2 border">{r.duration || (r.datetime_to ? "Calculating..." : "-")}</td>
                    <td className="p-2 border">{r.datetime_to ? "Synced" : "Not Synced"}</td>
                    <td className="p-2 border text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => startEditShutdown(r)} className="text-[#E06A1B] text-xs">Edit</button>
                        <button onClick={() => startAddSync(r)} className="text-blue-600 text-xs">
                          {r.datetime_to ? "Edit Sync" : "Add Sync"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
