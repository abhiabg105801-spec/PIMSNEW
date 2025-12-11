import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";

// --- Configuration ---
const API_BASE_URL = "http://localhost:8080";
const API_URL = `${API_BASE_URL}/api/shutdowns`;

// --- Icons ---
const Icons = {
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Minus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>,
  Edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Sync: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Clock: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

// --- Compact Theme ---
const THEME = {
  primary: "bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all text-xs font-bold uppercase tracking-wider",
  secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all text-xs font-bold uppercase",
  input: "w-full bg-white border border-gray-300 text-gray-800 text-sm rounded px-2.5 py-1.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-gray-400 disabled:bg-gray-100",
  label: "block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5",
  card: "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden",
  tableHeader: "px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200",
  tableCell: "px-4 py-2 text-sm border-b border-gray-100 text-gray-700",
};

/* ---------------------- Shared UI Components ---------------------- */
const Toast = ({ show, type = "success", message }) => {
  if (!show) return null;
  return (
    <div className={`fixed top-6 right-6 px-4 py-2.5 rounded shadow-lg text-white text-sm font-medium flex items-center gap-3 z-[60] animate-fadeIn ${type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
      {type === "error" ? "!" : <Icons.Check />} {message}
    </div>
  );
};

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className={`${THEME.card} w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col animate-scaleIn shadow-xl`}>
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-l-4 border-orange-500 pl-2">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><Icons.Close /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const SectionTitle = ({ label }) => (
  <div className="flex items-center gap-2 mb-2 mt-1">
    <div className="h-px bg-gray-200 flex-1"></div>
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    <div className="h-px bg-gray-200 flex-1"></div>
  </div>
);

const CompactInput = ({ label, className = "", ...props }) => (
  <div className={className}>
    <label className={THEME.label}>{label} {props.required && <span className="text-orange-600">*</span>}</label>
    <input className={THEME.input} {...props} />
  </div>
);

const CompactSelect = ({ label, children, className = "", ...props }) => (
  <div className={className}>
    <label className={THEME.label}>{label} {props.required && <span className="text-orange-600">*</span>}</label>
    <select className={THEME.input} {...props}>{children}</select>
  </div>
);

const CompactTextArea = ({ label, className = "", ...props }) => (
  <div className={className}>
    <label className={THEME.label}>{label}</label>
    <textarea className={`${THEME.input} resize-none`} rows={2} {...props} />
  </div>
);

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function ShutdownLogPage({ auth }) {
  const api = useMemo(() => axios.create({ baseURL: API_URL, headers: { Authorization: auth } }), [auth]);

  // State
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [formOpen, setFormOpen] = useState(true); // Toggle form visibility
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // Modals
  const [syncModal, setSyncModal] = useState({ open: false, record: null });
  const [detailModal, setDetailModal] = useState({ open: false, record: null });

  // Forms
  const emptyShutdown = {
    unit: "Unit-1", shutdown_type: "Forced Outage", datetime_from: "", responsible_agency: "", 
    reason: "", remarks: "", shift_incharge: "", pretrip_status: "", first_cause: "",
    action_taken: "", restoration_sequence: "", notification_no: "", why_why_done: false
  };
  const [formData, setFormData] = useState(emptyShutdown);
  const [editId, setEditId] = useState(null);
  const fileInputRef = useRef(null);
  const [rcaFile, setRcaFile] = useState(null);

  const emptySync = { 
    sync_datetime: "", sync_shift_incharge: "", oil_used_kl: "", coal_t: "", 
    oil_stabilization_kl: "", import_percent: "", sync_notes: "" 
  };
  const [syncData, setSyncData] = useState(emptySync);

  // Helpers
  const notify = (msg, type="success") => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };
  const normalizeDT = (s) => (s && s.length === 16 ? s + ":00" : s);
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }) : "-";

  // Actions
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/latest");
      setHistory(res.data || []);
    } catch { notify("Failed to load history", "error"); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const handleShutdownSubmit = async (e) => {
    e.preventDefault();
    if(!formData.datetime_from) return notify("Date required", "error");
    
    const fd = new FormData();
    Object.entries(formData).forEach(([k,v]) => fd.append(k, k === "datetime_from" ? normalizeDT(v) : v));
    if(rcaFile) fd.append("rca_file", rcaFile);

    try {
      if(editId) await api.put(`/${editId}`, fd);
      else await api.post("/", fd);
      
      notify(editId ? "Record Updated" : "Record Logged");
      setFormData(emptyShutdown);
      setEditId(null);
      setRcaFile(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      loadData();
    } catch(err) { notify(err.response?.data?.detail || "Error", "error"); }
  };

  const handleSyncSubmit = async (e) => {
    e.preventDefault();
    if(new Date(syncData.sync_datetime) <= new Date(syncModal.record.datetime_from)) 
      return notify("Sync time must be after outage start", "error");

    const fd = new FormData();
    fd.append("sync_datetime", normalizeDT(syncData.sync_datetime));
    Object.entries(syncData).forEach(([k, v]) => k !== "sync_datetime" && v && fd.append(k, v));

    try {
      await api.put(`/${syncModal.record.id}/sync`, fd);
      notify("Unit Synced");
      setSyncModal({ open: false, record: null });
      loadData();
    } catch { notify("Sync Failed", "error"); }
  };

  const startEdit = (rec) => {
    setFormData({ ...emptyShutdown, ...rec, datetime_from: rec.datetime_from?.slice(0, 16) || "" });
    setEditId(rec.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startSync = (rec) => {
    setSyncData({ 
      ...emptySync, ...rec, 
      sync_datetime: rec.sync_datetime?.slice(0, 16) || "",
      sync_shift_incharge: rec.sync_shift_incharge || rec.shift_incharge || "" 
    });
    setSyncModal({ open: true, record: rec });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <Toast {...toast} />

      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* --- HEADER --- */}
        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-md text-orange-600"><Icons.Clock /></div>
             <div>
               <h1 className="text-lg font-bold text-gray-900 leading-none">Shutdown Log</h1>
               <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mt-0.5">Plant Availability & Outage Tracking</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setFormData(emptyShutdown); setEditId(null); }} className={`${THEME.secondary} px-3 py-1.5 rounded`}>New Entry</button>
            <button onClick={loadData} className={`${THEME.secondary} px-3 py-1.5 rounded flex items-center gap-1`}><Icons.Refresh /> Refresh</button>
          </div>
        </div>

        {/* --- LOG ENTRY FORM (Collapsible) --- */}
        <div className={`${THEME.card} border-t-4 ${editId ? "border-t-blue-500" : "border-t-orange-500"}`}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => setFormOpen(!formOpen)}>
             <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                {editId ? "✏️ Editing Record" : "📝 Log New Outage"}
             </span>
             <button className="text-gray-400 hover:text-gray-600">{formOpen ? <Icons.Minus /> : <Icons.Plus />}</button>
          </div>
          
          {formOpen && (
            <form onSubmit={handleShutdownSubmit} className="p-5 animate-fadeIn">
              <div className="grid grid-cols-12 gap-4">
                
                {/* Zone 1: Identity */}
                <div className="col-span-12 md:col-span-2 space-y-3">
                  <CompactSelect label="Unit" name="unit" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} required>
                    <option value="Unit-1">Unit-1</option>
                    <option value="Unit-2">Unit-2</option>
                  </CompactSelect>
                  <CompactSelect label="Type" name="shutdown_type" value={formData.shutdown_type} onChange={e => setFormData({...formData, shutdown_type: e.target.value})}>
                    <option value="Forced Outage">Forced Outage</option>
                    <option value="Planned Outage">Planned Outage</option>
                    <option value="Strategic Outage">Strategic Outage</option>
                  </CompactSelect>
                </div>

                {/* Zone 2: Timing & Admin */}
                <div className="col-span-12 md:col-span-4 space-y-3">
                  <CompactInput type="datetime-local" label="Outage Start" value={formData.datetime_from} onChange={e => setFormData({...formData, datetime_from: e.target.value})} required />
                  <div className="grid grid-cols-2 gap-3">
                    <CompactInput label="Notif No." value={formData.notification_no} onChange={e => setFormData({...formData, notification_no: e.target.value})} />
                    <CompactInput label="Incharge" value={formData.shift_incharge} onChange={e => setFormData({...formData, shift_incharge: e.target.value})} />
                  </div>
                </div>

                {/* Zone 3: Technical Details */}
                <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-3">
                  <CompactInput label="Pre-Trip Status" value={formData.pretrip_status} onChange={e => setFormData({...formData, pretrip_status: e.target.value})} />
                  <CompactInput label="First Cause" value={formData.first_cause} onChange={e => setFormData({...formData, first_cause: e.target.value})} />
                  <CompactInput label="Agency" value={formData.responsible_agency} onChange={e => setFormData({...formData, responsible_agency: e.target.value})} />
                  <CompactInput label="Action Taken" value={formData.action_taken} onChange={e => setFormData({...formData, action_taken: e.target.value})} />
                </div>

                <div className="col-span-12"><div className="border-t border-gray-100 my-1"></div></div>

                {/* Zone 4: Long Text */}
                <div className="col-span-12 md:col-span-6 space-y-3">
                  <CompactTextArea label="Reason for Outage" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-3">
                  <CompactTextArea label="Remarks / Observations" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} />
                </div>
                
                {/* Footer Controls */}
                <div className="col-span-12 flex items-center justify-between pt-2">
                   <div className="flex items-center gap-4 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.why_why_done} onChange={e => setFormData({...formData, why_why_done: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500" />
                        <span className="text-[11px] font-bold text-gray-600 uppercase">RCA Done</span>
                      </label>
                      <div className="h-4 w-px bg-gray-300"></div>
                      <input type="file" ref={fileInputRef} onChange={e => setRcaFile(e.target.files[0])} className="text-[10px] text-gray-500 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-gray-200 hover:file:bg-gray-300" />
                   </div>
                   
                   <div className="flex gap-2">
                     {editId && <button type="button" onClick={() => {setEditId(null); setFormData(emptyShutdown);}} className="text-xs text-red-500 underline hover:text-red-700">Cancel Edit</button>}
                     <button type="submit" className={`${THEME.primary} px-6 py-2 rounded`}>
                       {editId ? "Update Log" : "Save Log"}
                     </button>
                   </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* --- DATA TABLE --- */}
        <div className={THEME.card}>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr>
                  <th className="w-1 bg-gray-50 border-b border-gray-200"></th>
                  <th className={THEME.tableHeader}>Status</th>
                  <th className={THEME.tableHeader}>Unit / Type</th>
                  <th className={THEME.tableHeader}>Timeline</th>
                  <th className={THEME.tableHeader}>Duration</th>
                  <th className={THEME.tableHeader}>Reason</th>
                  <th className={`${THEME.tableHeader} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="p-8 text-center text-xs text-gray-400 font-medium">Loading Data...</td></tr> : 
                 history.length === 0 ? <tr><td colSpan="7" className="p-8 text-center text-xs text-gray-400 font-medium">No records found.</td></tr> :
                 history.map(row => (
                  <tr key={row.id} className="hover:bg-orange-50/30 group transition-colors cursor-default">
                    <td className={`w-1 ${row.datetime_to ? 'bg-emerald-500' : 'bg-red-500'}`}></td>
                    <td className={THEME.tableCell}>
                      {row.datetime_to ? 
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">Synced</span> : 
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase animate-pulse">Open</span>
                      }
                    </td>
                    <td className={THEME.tableCell}>
                      <div className="font-bold text-gray-800">{row.unit}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{row.shutdown_type}</div>
                    </td>
                    <td className={THEME.tableCell}>
                      <div className="font-mono text-xs text-gray-600">{fmt(row.datetime_from)}</div>
                      {row.datetime_to && <div className="font-mono text-[10px] text-gray-400">to {fmt(row.datetime_to)}</div>}
                    </td>
                    <td className={THEME.tableCell}>
                      <span className="font-mono font-medium">{row.duration || "-"}</span>
                    </td>
                    <td className={THEME.tableCell}>
                       <div className="truncate max-w-[200px]" title={row.reason}>{row.reason || "-"}</div>
                    </td>
                    <td className={`${THEME.tableCell} text-right`}>
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100">
                        <button onClick={() => { setDetailModal({open:true, record:row}) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="View Details"><Icons.Plus /></button>
                        <button onClick={() => startEdit(row)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Edit"><Icons.Edit /></button>
                        <button onClick={() => startSync(row)} className={`p-1.5 rounded ${row.datetime_to ? 'text-emerald-600 hover:bg-emerald-50' : 'text-orange-600 hover:bg-orange-50'}`} title="Sync"><Icons.Sync /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* SYNC MODAL */}
      <Modal open={syncModal.open} onClose={() => setSyncModal({open:false, record:null})} title="Update Synchronization">
        <form onSubmit={handleSyncSubmit} className="space-y-4">
          <CompactInput type="datetime-local" label="Sync Date & Time" value={syncData.sync_datetime} onChange={e => setSyncData({...syncData, sync_datetime: e.target.value})} required />
          <SectionTitle label="Consumption Data" />
          <div className="grid grid-cols-2 gap-4">
            <CompactInput label="Oil Used (KL)" type="number" value={syncData.oil_used_kl} onChange={e => setSyncData({...syncData, oil_used_kl: e.target.value})} />
            <CompactInput label="Coal Used (T)" type="number" value={syncData.coal_t} onChange={e => setSyncData({...syncData, coal_t: e.target.value})} />
            <CompactInput label="Oil Stab (KL)" type="number" value={syncData.oil_stabilization_kl} onChange={e => setSyncData({...syncData, oil_stabilization_kl: e.target.value})} />
            <CompactInput label="Import (%)" type="number" value={syncData.import_percent} onChange={e => setSyncData({...syncData, import_percent: e.target.value})} />
          </div>
          <CompactInput label="Sync Incharge" value={syncData.sync_shift_incharge} onChange={e => setSyncData({...syncData, sync_shift_incharge: e.target.value})} />
          <CompactTextArea label="Sync Notes" value={syncData.sync_notes} onChange={e => setSyncData({...syncData, sync_notes: e.target.value})} />
          
          <div className="pt-2 flex justify-end gap-2">
            <button type="submit" className={`${THEME.primary} px-6 py-2 rounded`}>Save & Sync</button>
          </div>
        </form>
      </Modal>

      {/* DETAILS MODAL */}
      <Modal open={detailModal.open} onClose={() => setDetailModal({open:false, record:null})} title="Record Details">
        {detailModal.record && (
          <div className="space-y-6 text-sm">
            <div className="flex justify-between items-start bg-gray-50 p-3 rounded border border-gray-100">
               <div>
                 <div className="text-[10px] font-bold text-gray-500 uppercase">Unit & Type</div>
                 <div className="font-bold text-lg text-gray-800">{detailModal.record.unit} <span className="text-gray-400 font-normal">|</span> {detailModal.record.shutdown_type}</div>
               </div>
               <div className="text-right">
                 <div className="text-[10px] font-bold text-gray-500 uppercase">Total Duration</div>
                 <div className="font-mono font-bold text-lg text-orange-600">{detailModal.record.duration || "Ongoing"}</div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                 <div className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-1 mb-2">Timeline</div>
                 <div className="flex justify-between"><span className="text-gray-500">Trip:</span> <span className="font-mono">{fmt(detailModal.record.datetime_from)}</span></div>
                 <div className="flex justify-between"><span className="text-gray-500">Sync:</span> <span className="font-mono">{fmt(detailModal.record.sync_datetime)}</span></div>
              </div>
              <div className="space-y-1">
                 <div className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-1 mb-2">Personnel</div>
                 <div className="flex justify-between"><span className="text-gray-500">Agency:</span> <span>{detailModal.record.responsible_agency || "-"}</span></div>
                 <div className="flex justify-between"><span className="text-gray-500">Incharge:</span> <span>{detailModal.record.shift_incharge || "-"}</span></div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Reason</div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 text-gray-700">{detailModal.record.reason}</div>
            </div>

            {detailModal.record.rca_file_path && (
               <a href={`${API_BASE_URL}/${detailModal.record.rca_file_path}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-xs font-bold uppercase mt-2">
                 <Icons.Download /> Download RCA Document
               </a>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
}