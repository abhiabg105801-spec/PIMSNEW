import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

/* ---------------------- Toast Component ---------------------- */
const Toast = ({ show, type = "success", message }) => {
  if (!show) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-2 rounded shadow-lg text-white text-sm flex items-center gap-2 z-50 animate-fadeIn
      ${type === "error" ? "bg-red-600" : "bg-green-600"}`}
    >
      {type === "error" ? "⚠️" : "✅"} {message}
    </div>
  );
};

/* ---------------------- Modal ---------------------- */
const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 relative animate-slideUp">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-black text-xl"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

/* ---------------------- Small UI components ---------------------- */
const TextInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) => (
  <div>
    <label className="text-xs font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      name={name}
      value={value}
      onChange={onChange}
      type={type}
      className="w-full border p-2 rounded mt-1 text-sm"
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
      className="w-full border p-2 rounded mt-1 text-sm"
    />
  </div>
);

const SelectInput = ({
  label,
  name,
  value,
  onChange,
  children,
  required = false,
}) => (
  <div>
    <label className="text-xs font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full border p-2 rounded mt-1 text-sm"
    >
      {children}
    </select>
  </div>
);

/* ============================================================
   MAIN PAGE
============================================================ */
export default function PlantShutdownPage({ auth }) {
  const API_BASE = "http://localhost:8080/api/shutdowns";
  const headers = { Authorization: auth };

  /* ------------ TOAST -------------- */
  const [toast, setToast] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, message: msg });
    setTimeout(
      () => setToast({ show: false, type: "success", message: "" }),
      3000
    );
  };

  /* ------------ Shutdown Form State -------------- */
  const initialShutdown = {
    unit: "",
    shutdown_type: "",
    datetime_from: "",
    responsible_agency: "",
    reason: "",
    remarks: "",
    shift_incharge: "",
    pretrip_status: "",
    first_cause: "",
    action_taken: "",
    restoration_sequence: "",
    notification_no: "",
    why_why_done: false, // NEW
  };
  const [shutdownForm, setShutdownForm] = useState(initialShutdown);
  const [editingShutdownId, setEditingShutdownId] = useState(null);

  const fileRef = useRef(null);
  const [rcaFile, setRcaFile] = useState(null);

  /* ------------ Sync Form State -------------- */
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

  /* ------------ Details Modal -------------- */
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  /* ------------ History -------------- */
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const normalizeDT = (s) => (s && s.length === 16 ? s + ":00" : s);

  const fmt = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  /* ------------ Fetch Last 5 -------------- */
  const fetchLatest = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/latest`, { headers });
      setHistory(res.data || []);
    } catch {
      showToast("Failed to fetch shutdowns", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  /* ============================================================
     Shutdown Handlers
  ============================================================ */
  const onShutdownChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShutdownForm((s) => ({
      ...s,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onFileChange = (e) => setRcaFile(e.target.files?.[0] || null);

  const resetShutdownForm = () => {
    setShutdownForm(initialShutdown);
    setEditingShutdownId(null);
    setRcaFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitShutdown = async (e) => {
    e.preventDefault();

    if (!shutdownForm.unit || !shutdownForm.datetime_from) {
      showToast("Unit and From Time required", "error");
      return;
    }

    const fd = new FormData();
    Object.entries(shutdownForm).forEach(([k, v]) =>
      fd.append(k, k === "datetime_from" ? normalizeDT(v) : v)
    );
    if (rcaFile) fd.append("rca_file", rcaFile);

    try {
      if (editingShutdownId) {
        await axios.put(`${API_BASE}/${editingShutdownId}`, fd, { headers });
        showToast("Shutdown updated successfully");
      } else {
        await axios.post(`${API_BASE}/`, fd, { headers });
        showToast("Shutdown created successfully");
      }

      resetShutdownForm();
      fetchLatest();
    } catch {
      showToast("Failed to save shutdown", "error");
    }
  };

  const startEditShutdown = (rec) => {
    setEditingShutdownId(rec.id);
    setShutdownForm({
      unit: rec.unit || "",
      shutdown_type: rec.shutdown_type || "",
      datetime_from: rec.datetime_from?.slice(0, 16) || "",
      responsible_agency: rec.responsible_agency || "",
      reason: rec.reason || "",
      remarks: rec.remarks || "",
      shift_incharge: rec.shift_incharge || "",
      pretrip_status: rec.pretrip_status || "",
      first_cause: rec.first_cause || "",
      action_taken: rec.action_taken || "",
      restoration_sequence: rec.restoration_sequence || "",
      notification_no: rec.notification_no || "",
      why_why_done: rec.why_why_done || false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ============================================================
     Sync Handlers
  ============================================================ */
  const startAddSync = (rec) => {
    setSyncTargetId(rec.id);
    setSyncForm({
      sync_datetime: rec.sync_datetime?.slice(0, 16) || "",
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

  const submitSync = async (e) => {
    e.preventDefault();

    if (!syncTargetId) return showToast("No record selected", "error");
    if (!syncForm.sync_datetime)
      return showToast("Sync Date & Time required", "error");

    const fd = new FormData();
    fd.append("sync_datetime", normalizeDT(syncForm.sync_datetime));
    ["sync_shift_incharge", "oil_used_kl", "coal_t", "oil_stabilization_kl", "import_percent", "sync_notes"].forEach(
      (k) => syncForm[k] && fd.append(k, syncForm[k])
    );

    try {
      await axios.put(`${API_BASE}/${syncTargetId}/sync`, fd, { headers });
      showToast("Sync details saved");
      setSyncModalOpen(false);
      fetchLatest();
    } catch {
      showToast("Sync failed", "error");
    }
  };

  /* ============================================================
     Details Modal Loader
  ============================================================ */
  const openDetails = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/${id}`, { headers });
      setSelectedRecord(res.data);
      setDetailsModalOpen(true);
    } catch {
      showToast("Failed to load details", "error");
    }
  };

  /* ============================================================
     JSX START
  ============================================================ */
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 animate-fadeIn">

      {/* Toast */}
      <Toast show={toast.show} type={toast.type} message={toast.message} />

      <h1 className="text-2xl font-semibold text-[#E06A1B]">Shutdown & Synchronisation</h1>

      {/* -------------------------------------------------
          SHUTDOWN FORM
      ------------------------------------------------- */}
      <section className="bg-white p-4 rounded-xl shadow border">
        <h2 className="text-lg font-semibold mb-1">Shutdown Log</h2>

        <form onSubmit={submitShutdown} className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectInput label="Unit" name="unit" value={shutdownForm.unit} onChange={onShutdownChange} required>
              <option value="">Select Unit</option>
              <option value="Unit-1">Unit-1</option>
              <option value="Unit-2">Unit-2</option>
            </SelectInput>

            <SelectInput label="Shutdown Type" name="shutdown_type" value={shutdownForm.shutdown_type} onChange={onShutdownChange}>
              <option value="">Select Type</option>
              <option value="Forced Outage">Forced Outage</option>
              <option value="Planned Outage">Planned Outage</option>
              <option value="Strategic Outage">Strategic Outage</option>
            </SelectInput>

            <TextInput
              label="From (Date & Time)"
              name="datetime_from"
              type="datetime-local"
              value={shutdownForm.datetime_from}
              onChange={onShutdownChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Responsible Agency" name="responsible_agency" value={shutdownForm.responsible_agency} onChange={onShutdownChange} />
            <TextInput label="Notification No." name="notification_no" value={shutdownForm.notification_no} onChange={onShutdownChange} />
            <TextInput label="Shift Incharge" name="shift_incharge" value={shutdownForm.shift_incharge} onChange={onShutdownChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Pre-trip Status" name="pretrip_status" value={shutdownForm.pretrip_status} onChange={onShutdownChange} />
            <TextInput label="First Cause" name="first_cause" value={shutdownForm.first_cause} onChange={onShutdownChange} />
            <TextInput label="Action Taken" name="action_taken" value={shutdownForm.action_taken} onChange={onShutdownChange} />
          </div>

          <TextArea label="Reason" name="reason" value={shutdownForm.reason} onChange={onShutdownChange} />
          <TextArea label="Remarks" name="remarks" value={shutdownForm.remarks} onChange={onShutdownChange} />
          <TextArea label="Restoration Sequence" name="restoration_sequence" value={shutdownForm.restoration_sequence} onChange={onShutdownChange} />

          {/* Why-Why Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="why_why_done"
              checked={shutdownForm.why_why_done}
              onChange={onShutdownChange}
            />
            <label className="text-sm">Why-Why Analysis Completed</label>
          </div>

          <div>
            <label className="text-xs font-medium">RCA File</label>
            <input type="file" ref={fileRef} onChange={onFileChange} className="mt-1 text-sm" />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-[#E06A1B] text-white py-2 rounded hover:bg-[#c55d18]">
              {editingShutdownId ? "Update Shutdown" : "Save Shutdown"}
            </button>
            <button type="button" onClick={resetShutdownForm} className="px-4 py-2 border rounded">
              Reset
            </button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------
          SYNC MODAL
      ------------------------------------------------- */}
      <Modal open={syncModalOpen} onClose={() => setSyncModalOpen(false)}>
        <h3 className="text-xl font-semibold mb-3 text-[#E06A1B]">Synchronisation</h3>

        <form onSubmit={submitSync} className="space-y-3">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput label="Sync Date & Time" name="sync_datetime" type="datetime-local" value={syncForm.sync_datetime} onChange={onSyncChange} required />
            <TextInput label="Shift Incharge" name="sync_shift_incharge" value={syncForm.sync_shift_incharge} onChange={onSyncChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput label="Oil (KL)" type="number" name="oil_used_kl" value={syncForm.oil_used_kl} onChange={onSyncChange} />
            <TextInput label="Coal (T)" type="number" name="coal_t" value={syncForm.coal_t} onChange={onSyncChange} />
            <TextInput label="Oil Stabilization (KL)" type="number" name="oil_stabilization_kl" value={syncForm.oil_stabilization_kl} onChange={onSyncChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput label="Import (%)" type="number" name="import_percent" value={syncForm.import_percent} onChange={onSyncChange} />
          </div>

          <TextArea label="Sync Notes" name="sync_notes" value={syncForm.sync_notes} onChange={onSyncChange} rows={3} />

          <div className="flex gap-3">
            <button className="flex-1 bg-[#E06A1B] text-white py-2 rounded hover:bg-[#c55d18]">Save Sync</button>
            <button type="button" className="px-4 py-2 rounded border" onClick={() => setSyncModalOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------
          DETAILS MODAL (DOUBLE CLICK)
      ------------------------------------------------- */}
      <Modal open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)}>
        {selectedRecord && (
          <div className="space-y-3 text-sm">

            <h2 className="text-xl font-semibold text-[#E06A1B]">Shutdown Details</h2>

            <div className="grid grid-cols-2 gap-3">
              <div><b>Unit:</b> {selectedRecord.unit}</div>
              <div><b>Type:</b> {selectedRecord.shutdown_type}</div>

              <div><b>From:</b> {fmt(selectedRecord.datetime_from)}</div>
              <div><b>To:</b> {fmt(selectedRecord.datetime_to)}</div>

              <div><b>Duration:</b> {selectedRecord.duration || "-"}</div>
              <div><b>Responsible:</b> {selectedRecord.responsible_agency || "-"}</div>

              <div><b>Shift Incharge:</b> {selectedRecord.shift_incharge}</div>
              <div><b>Notification No:</b> {selectedRecord.notification_no}</div>

              <div><b>Why-Why Completed:</b> {selectedRecord.why_why_done ? "Yes" : "No"}</div>
              <div><b>Uploaded:</b> {fmt(selectedRecord.uploaded_at)}</div>
            </div>

            <div>
              <b>Reason:</b>
              <div className="border p-2 rounded bg-gray-50">{selectedRecord.reason}</div>
            </div>

            <div>
              <b>Remarks:</b>
              <div className="border p-2 rounded bg-gray-50">{selectedRecord.remarks}</div>
            </div>

            <div>
              <b>Action Taken:</b>
              <div className="border p-2 rounded bg-gray-50">{selectedRecord.action_taken}</div>
            </div>

            {selectedRecord.rca_file_path && (
              <a
                href={`http://localhost:8080/${selectedRecord.rca_file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Download RCA File
              </a>
            )}

            <hr className="my-3" />

            <h3 className="text-lg font-semibold text-[#E06A1B]">Sync Details</h3>

            <div className="grid grid-cols-2 gap-3">
              <div><b>Sync Time:</b> {fmt(selectedRecord.sync_datetime)}</div>
              <div><b>Sync Shift Incharge:</b> {selectedRecord.sync_shift_incharge}</div>
              <div><b>Oil (KL):</b> {selectedRecord.oil_used_kl}</div>
              <div><b>Coal (T):</b> {selectedRecord.coal_t}</div>
              <div><b>Oil Stabilization (KL):</b> {selectedRecord.oil_stabilization_kl}</div>
              <div><b>Import (%):</b> {selectedRecord.import_percent}</div>
            </div>

            <div>
              <b>Sync Notes:</b>
              <div className="border p-2 rounded bg-gray-50">{selectedRecord.sync_notes}</div>
            </div>

          </div>
        )}
      </Modal>

      {/* -------------------------------------------------
          LAST 5 TABLE
      ------------------------------------------------- */}
      <section className="bg-white p-1 rounded-xl shadow border">
        <div className="flex justify-between mb-3">
          <h2 className="text-lg font-semibold">Last 5 Shutdowns</h2>
          <button onClick={fetchLatest} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#E06A1B] text-white">
              <tr>
                <th className="p-1 border">From</th>
                <th className="p-1 border">Unit</th>
                <th className="p-1 border">Type</th>
                <th className="p-1 border">Reason</th>
                <th className="p-1 border">Duration</th>
                <th className="p-1 border">Sync</th>
                <th className="p-1 border">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    No records found
                  </td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-orange-50 cursor-pointer"
                    onDoubleClick={() => openDetails(r.id)}
                  >
                    <td className="p-2 border">{fmt(r.datetime_from)}</td>
                    <td className="p-2 border">{r.unit}</td>
                    <td className="p-2 border">{r.shutdown_type || "-"}</td>
                    <td className="p-2 border max-w-[180px] truncate" title={r.reason}>
                      {r.reason || "-"}
                    </td>
                    <td className="p-2 border">{r.duration || "-"}</td>
                    <td className="p-2 border">
                      {r.datetime_to ? (
                        <span className="text-green-600 font-semibold">Synced</span>
                      ) : (
                        <span className="text-red-600 font-semibold">Pending</span>
                      )}
                    </td>

                    <td className="p-2 border text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditShutdown(r);
                          }}
                          className="text-[#E06A1B] text-xs"
                        >
                          Edit
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startAddSync(r);
                          }}
                          className="text-blue-600 text-xs"
                        >
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
