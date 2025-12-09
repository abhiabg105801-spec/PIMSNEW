import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

// --- Icons (Inline SVGs for zero-dependency) ---
const Icons = {
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Sync: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Alert: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
};

// --- Theme Constants ---
const THEME = {
  primary: "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-200 transition-all",
  secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all",
  input: "w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder-gray-400",
  label: "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1",
  card: "bg-white rounded-xl shadow-sm border border-gray-100",
};

/* ---------------------- Toast ---------------------- */
const Toast = ({ show, type = "success", message }) => {
  if (!show) return null;
  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium flex items-center gap-3 z-50 animate-fadeIn ${type === "error" ? "bg-red-500" : "bg-green-600"}`}>
      {type === "error" ? <Icons.Alert /> : <Icons.Check />} {message}
    </div>
  );
};

/* ---------------------- Modal ---------------------- */
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`${THEME.card} w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative animate-scaleIn`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-l-4 border-orange-500 pl-3">
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-100 p-1.5 rounded-full">
            <Icons.Close />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

/* ---------------------- UI Primitives ---------------------- */
const TextInput = ({ label, name, value, onChange, type = "text", required = false, className = "" }) => (
  <div className={className}>
    <label className={THEME.label}>
      {label} {required && <span className="text-orange-600">*</span>}
    </label>
    <input name={name} value={value} onChange={onChange} type={type} className={THEME.input} />
  </div>
);

const TextArea = ({ label, name, value, onChange, rows = 2, className = "" }) => (
  <div className={className}>
    <label className={THEME.label}>{label}</label>
    <textarea name={name} rows={rows} value={value} onChange={onChange} className={`${THEME.input} resize-none`} />
  </div>
);

const SelectInput = ({ label, name, value, onChange, children, required = false, className = "" }) => (
  <div className={className}>
    <label className={THEME.label}>
      {label} {required && <span className="text-orange-600">*</span>}
    </label>
    <select name={name} value={value} onChange={onChange} className={`${THEME.input} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23E06A1B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px] bg-[right_12px_center] bg-no-repeat`}>
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

  /* ------------ State -------------- */
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Forms
  const initialShutdown = {
    unit: "", shutdown_type: "", datetime_from: "", responsible_agency: "", reason: "",
    remarks: "", shift_incharge: "", pretrip_status: "", first_cause: "",
    action_taken: "", restoration_sequence: "", notification_no: "", why_why_done: false,
  };
  const [shutdownForm, setShutdownForm] = useState(initialShutdown);
  const [editingShutdownId, setEditingShutdownId] = useState(null);
  
  const initialSync = {
    sync_datetime: "", sync_shift_incharge: "", oil_used_kl: "", coal_t: "",
    oil_stabilization_kl: "", import_percent: "", sync_notes: "",
  };
  const [syncForm, setSyncForm] = useState(initialSync);
  
  // Modals & Files
  const [syncTargetId, setSyncTargetId] = useState(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const fileRef = useRef(null);
  const [rcaFile, setRcaFile] = useState(null);

  /* ------------ Helpers -------------- */
  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, message: msg });
    setTimeout(() => setToast({ show: false, type: "success", message: "" }), 3000);
  };
  
  const normalizeDT = (s) => (s && s.length === 16 ? s + ":00" : s);
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : "-";

  const fetchLatest = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/latest`, { headers });
      setHistory(res.data || []);
    } catch { showToast("Fetch failed", "error"); }
    setLoading(false);
  };

  useEffect(() => { fetchLatest(); }, []);

  /* ------------ Handlers -------------- */
  const onShutdownChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShutdownForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const submitShutdown = async (e) => {
    e.preventDefault();
    if (!shutdownForm.unit || !shutdownForm.datetime_from) return showToast("Required fields missing", "error");

    const fd = new FormData();
    Object.entries(shutdownForm).forEach(([k, v]) => fd.append(k, k === "datetime_from" ? normalizeDT(v) : v));
    if (rcaFile) fd.append("rca_file", rcaFile);

    try {
      const url = editingShutdownId ? `${API_BASE}/${editingShutdownId}` : `${API_BASE}/`;
      const method = editingShutdownId ? axios.put : axios.post;
      await method(url, fd, { headers });
      
      showToast(editingShutdownId ? "Updated successfully" : "Created successfully");
      resetShutdownForm();
      fetchLatest();
    } catch { showToast("Operation failed", "error"); }
  };

  const resetShutdownForm = () => {
    setShutdownForm(initialShutdown);
    setEditingShutdownId(null);
    setRcaFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEditShutdown = (rec) => {
    setEditingShutdownId(rec.id);
    setShutdownForm({
      ...initialShutdown,
      ...rec,
      datetime_from: rec.datetime_from?.slice(0, 16) || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitSync = async (e) => {
    e.preventDefault();
    if (!syncForm.sync_datetime) return showToast("Sync Date required", "error");

    const fd = new FormData();
    fd.append("sync_datetime", normalizeDT(syncForm.sync_datetime));
    Object.entries(syncForm).forEach(([k, v]) => k !== "sync_datetime" && v && fd.append(k, v));

    try {
      await axios.put(`${API_BASE}/${syncTargetId}/sync`, fd, { headers });
      showToast("Synced successfully");
      setSyncModalOpen(false);
      fetchLatest();
    } catch { showToast("Sync failed", "error"); }
  };

  const startAddSync = (rec) => {
    setSyncTargetId(rec.id);
    setSyncForm({
      ...initialSync,
      ...rec,
      sync_datetime: rec.sync_datetime?.slice(0, 16) || "",
      sync_shift_incharge: rec.sync_shift_incharge || rec.shift_incharge || "",
    });
    setSyncModalOpen(true);
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800 animate-fadeIn">
      <Toast show={toast.show} type={toast.type} message={toast.message} />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Plant Shutdown & Synchronization</h1>
            <p className="text-sm text-gray-500 mt-1">Manage outage logs and restoration sequences.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={resetShutdownForm} className={`${THEME.secondary} px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide`}>
              Clear Form
            </button>
            <button onClick={fetchLatest} className={`${THEME.secondary} px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2`}>
              <Icons.Refresh /> Refresh Data
            </button>
          </div>
        </div>

        {/* --- MAIN FORM --- */}
        <div className={THEME.card}>
          <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between rounded-t-xl">
             <h2 className="font-bold text-gray-700 flex items-center gap-2">
               <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
               {editingShutdownId ? "Edit Existing Record" : "Log New Shutdown"}
             </h2>
             {editingShutdownId && (
               <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded font-bold">Editing Mode</span>
             )}
          </div>

          <form onSubmit={submitShutdown} className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            {/* Row 1 */}
            <SelectInput label="Unit" name="unit" value={shutdownForm.unit} onChange={onShutdownChange} required>
              <option value="">-- Select --</option>
              <option value="Unit-1">Unit-1</option>
              <option value="Unit-2">Unit-2</option>
            </SelectInput>
            <SelectInput label="Type" name="shutdown_type" value={shutdownForm.shutdown_type} onChange={onShutdownChange}>
              <option value="">-- Select --</option>
              <option value="Forced Outage">Forced Outage</option>
              <option value="Planned Outage">Planned Outage</option>
              <option value="Strategic Outage">Strategic Outage</option>
            </SelectInput>
            <TextInput label="From (Date & Time)" name="datetime_from" type="datetime-local" value={shutdownForm.datetime_from} onChange={onShutdownChange} required className="md:col-span-2" />

            {/* Row 2 */}
            <TextInput label="Notification No." name="notification_no" value={shutdownForm.notification_no} onChange={onShutdownChange} />
            <TextInput label="Responsible Agency" name="responsible_agency" value={shutdownForm.responsible_agency} onChange={onShutdownChange} />
            <TextInput label="Shift Incharge" name="shift_incharge" value={shutdownForm.shift_incharge} onChange={onShutdownChange} className="md:col-span-2" />

            {/* Row 3 - Tech Details */}
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <TextInput label="Pre-trip Status" name="pretrip_status" value={shutdownForm.pretrip_status} onChange={onShutdownChange} />
              <TextInput label="First Cause" name="first_cause" value={shutdownForm.first_cause} onChange={onShutdownChange} />
              <TextInput label="Action Taken" name="action_taken" value={shutdownForm.action_taken} onChange={onShutdownChange} />
            </div>

            {/* Row 4 - Text Areas */}
            <TextArea label="Reason for Outage" name="reason" value={shutdownForm.reason} onChange={onShutdownChange} className="md:col-span-2" />
            <TextArea label="Restoration Sequence" name="restoration_sequence" value={shutdownForm.restoration_sequence} onChange={onShutdownChange} className="md:col-span-2" />
            <TextArea label="Remarks / Observations" name="remarks" value={shutdownForm.remarks} onChange={onShutdownChange} className="md:col-span-4" />

            {/* Footer Actions */}
            <div className="lg:col-span-4 flex items-end justify-between border-t border-gray-100 pt-5 mt-2">
              <div className="flex gap-6 items-center">
                 <label className="flex items-center gap-2 cursor-pointer group">
                   <div className="relative flex items-center">
                     <input type="checkbox" name="why_why_done" checked={shutdownForm.why_why_done} onChange={onShutdownChange} className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow transition-all checked:border-orange-500 checked:bg-orange-500 hover:shadow-md" />
                     <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                       <Icons.Check />
                     </span>
                   </div>
                   <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">RCA / Why-Why Done</span>
                 </label>

                 <div className="flex flex-col">
                   <span className={THEME.label}>Upload RCA File</span>
                   <input type="file" ref={fileRef} onChange={(e) => setRcaFile(e.target.files?.[0])} className="text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                 </div>
              </div>

              <button type="submit" className={`${THEME.primary} px-8 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider`}>
                {editingShutdownId ? "Update Log" : "Save Log"}
              </button>
            </div>
          </form>
        </div>

        {/* --- DATA TABLE --- */}
        <div className={`${THEME.card} overflow-hidden`}>
          <div className="p-4 bg-gray-50/50 border-b border-gray-100">
             <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Recent History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Unit / Type</th>
                  <th className="px-5 py-3">Outage Time</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading records...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No records found. Start logging above.</td></tr>
                ) : (
                  history.map((r) => (
                    <tr 
                      key={r.id} 
                      onDoubleClick={() => { setSelectedRecord(r); setDetailsModalOpen(true); }}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3">
                        {r.datetime_to ? (
                           <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Synced
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                             <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Pending
                           </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold text-gray-800">{r.unit}</div>
                        <div className="text-xs text-gray-500">{r.shutdown_type || "Unknown Type"}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{fmt(r.datetime_from)}</td>
                      <td className="px-5 py-3 max-w-xs truncate text-gray-600" title={r.reason}>{r.reason || "-"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{r.duration || "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEditShutdown(r); }} className="text-gray-400 hover:text-orange-600 p-1.5 hover:bg-orange-50 rounded-md transition-all" title="Edit">
                            <Icons.Edit />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); startAddSync(r); }} className={`p-1.5 rounded-md transition-all ${r.datetime_to ? 'text-green-500 hover:bg-green-50' : 'text-blue-500 hover:bg-blue-50'}`} title="Sync">
                            <Icons.Sync />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* --- SYNC MODAL --- */}
      <Modal open={syncModalOpen} onClose={() => setSyncModalOpen(false)} title="Update Synchronization Details">
        <form onSubmit={submitSync} className="grid grid-cols-1 md:grid-cols-2 gap-5">
           <TextInput label="Sync Date & Time" name="sync_datetime" type="datetime-local" value={syncForm.sync_datetime} onChange={(e) => setSyncForm(s => ({...s, sync_datetime: e.target.value}))} required />
           <TextInput label="Shift Incharge" name="sync_shift_incharge" value={syncForm.sync_shift_incharge} onChange={(e) => setSyncForm(s => ({...s, sync_shift_incharge: e.target.value}))} />
           
           <div className="md:col-span-2 grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
             <TextInput label="Oil Used (KL)" type="number" name="oil_used_kl" value={syncForm.oil_used_kl} onChange={(e) => setSyncForm(s => ({...s, oil_used_kl: e.target.value}))} className="bg-white" />
             <TextInput label="Coal Used (T)" type="number" name="coal_t" value={syncForm.coal_t} onChange={(e) => setSyncForm(s => ({...s, coal_t: e.target.value}))} className="bg-white" />
             <TextInput label="Oil Stab. (KL)" type="number" name="oil_stabilization_kl" value={syncForm.oil_stabilization_kl} onChange={(e) => setSyncForm(s => ({...s, oil_stabilization_kl: e.target.value}))} className="bg-white" />
           </div>

           <TextInput label="Import (%)" type="number" name="import_percent" value={syncForm.import_percent} onChange={(e) => setSyncForm(s => ({...s, import_percent: e.target.value}))} />
           <TextArea label="Sync Notes" name="sync_notes" value={syncForm.sync_notes} onChange={(e) => setSyncForm(s => ({...s, sync_notes: e.target.value}))} className="md:col-span-2" />
           
           <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100">
             <button type="button" onClick={() => setSyncModalOpen(false)} className={`${THEME.secondary} px-4 py-2 rounded-lg text-sm font-bold`}>Cancel</button>
             <button type="submit" className={`${THEME.primary} px-6 py-2 rounded-lg text-sm font-bold`}>Confirm Sync</button>
           </div>
        </form>
      </Modal>

      {/* --- READ-ONLY DETAILS MODAL --- */}
      <Modal open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Shutdown Record Details">
        {selectedRecord && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                <span className="block text-xs text-gray-500 uppercase">Unit</span>
                <span className="font-bold text-gray-800">{selectedRecord.unit}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                <span className="block text-xs text-gray-500 uppercase">Type</span>
                <span className="font-bold text-gray-800">{selectedRecord.shutdown_type}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                 <span className="block text-xs text-gray-500 uppercase">Duration</span>
                 <span className="font-bold text-gray-800 font-mono">{selectedRecord.duration || "-"}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                 <span className="block text-xs text-gray-500 uppercase">Agency</span>
                 <span className="font-bold text-gray-800">{selectedRecord.responsible_agency || "-"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-4">
              <div className="space-y-4">
                <h4 className="font-bold text-orange-600 text-xs uppercase tracking-wide border-b border-orange-100 pb-1">Outage Info</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-400">From:</span> <span>{fmt(selectedRecord.datetime_from)}</span>
                  <span className="font-medium text-gray-400">To:</span> <span>{fmt(selectedRecord.datetime_to)}</span>
                  <span className="font-medium text-gray-400">Notif #:</span> <span>{selectedRecord.notification_no || "-"}</span>
                  <span className="font-medium text-gray-400">Incharge:</span> <span>{selectedRecord.shift_incharge || "-"}</span>
                </div>
                <div>
                   <span className={THEME.label}>Reason</span>
                   <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">{selectedRecord.reason}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-blue-600 text-xs uppercase tracking-wide border-b border-blue-100 pb-1">Sync Info</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-400">Sync Time:</span> <span>{fmt(selectedRecord.sync_datetime)}</span>
                  <span className="font-medium text-gray-400">Oil (KL):</span> <span>{selectedRecord.oil_used_kl || "-"}</span>
                  <span className="font-medium text-gray-400">Coal (T):</span> <span>{selectedRecord.coal_t || "-"}</span>
                  <span className="font-medium text-gray-400">Import %:</span> <span>{selectedRecord.import_percent || "-"}</span>
                </div>
                {selectedRecord.rca_file_path && (
                  <a href={`http://localhost:8080/${selectedRecord.rca_file_path}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-black">
                    Download RCA File
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}