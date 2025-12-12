import React, { useState, useEffect, useRef } from "react";
import ModalPortal from "./ModalPortal";
import api from "../api";
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ChevronDownIcon, 
  ArrowRightOnRectangleIcon, 
  KeyIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

export default function UserMenu({ username, onLogout }) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const menuRef = useRef(null);

  // --- FORM STATE ---
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", msg: "" });

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };
  const strengthScore = getStrength(newPass);

  const resetForm = () => {
    setOldPass(""); setNewPass(""); setConfirmPass("");
    setStatus({ type: "", msg: "" }); setShowModal(false);
  };

  const handlePasswordChange = async () => {
    setStatus({ type: "", msg: "" });
    if (!oldPass || !newPass || !confirmPass) {
      setStatus({ type: "error", msg: "All fields are required." }); return;
    }
    if (newPass !== confirmPass) {
      setStatus({ type: "error", msg: "New passwords do not match." }); return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/change-password", { old_password: oldPass, new_password: newPass });
      setStatus({ type: "success", msg: "Updated! Logging out..." });
      setTimeout(() => { resetForm(); onLogout(); }, 1500);
    } catch (e) {
      setStatus({ type: "error", msg: e.response?.data?.detail || "Failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      
      {/* --- COMPACT TRIGGER BUTTON --- */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          group flex items-center gap-2 pr-2 pl-1 py-1 rounded-full
          transition-all duration-200 ease-in-out border
          ${open 
            ? "bg-orange-50 border-orange-200 shadow-sm ring-1 ring-orange-100" 
            : "bg-white border-slate-200 hover:border-orange-300 hover:bg-slate-50 shadow-sm"
          }
        `}
      >
        {/* Smaller Avatar (w-6 h-6) */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          {username ? username.charAt(0).toUpperCase() : "U"}
        </div>
        
        {/* Text */}
        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 hidden sm:block">
          {username}
        </span>
        
        {/* Chevron */}
        <ChevronDownIcon 
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-orange-500" : ""}`} 
        />
      </button>

      {/* --- COMPACT DROPDOWN --- */}
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-50 bg-slate-50/50">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Account</p>
            <p className="text-xs font-semibold text-slate-700 truncate">{username}</p>
          </div>

          {/* Items */}
          <div className="p-1">
            <button
              onClick={() => { setShowModal(true); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-600 rounded hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-2 group"
            >
              <KeyIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-500" />
              Change Password
            </button>

            <button
              onClick={onLogout}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-600 rounded hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2 group"
            >
              <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL (Unchanged Logic, Same Style) --- */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => !loading && resetForm()} />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
              
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-base font-semibold text-slate-800">Update Security</h2>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5" /></button>
              </div>

              <div className="p-5 space-y-3">
                {status.msg && (
                  <div className={`p-2.5 rounded text-xs flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                     <span>{status.msg}</span>
                  </div>
                )}
                <PasswordField label="Current Password" value={oldPass} onChange={setOldPass} show={showOld} toggle={() => setShowOld(!showOld)} disabled={loading} />
                <div>
                  <PasswordField label="New Password" value={newPass} onChange={setNewPass} show={showNew} toggle={() => setShowNew(!showNew)} disabled={loading} />
                  {newPass && (
                    <div className="mt-1.5 flex gap-1 h-1">
                      {[1, 2, 3, 4].map((l) => (
                        <div key={l} className={`flex-1 rounded-full ${strengthScore >= l ? (strengthScore < 2 ? 'bg-red-500' : strengthScore < 4 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-100'}`} />
                      ))}
                    </div>
                  )}
                </div>
                <PasswordField label="Confirm Password" value={confirmPass} onChange={setConfirmPass} show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} disabled={loading} error={confirmPass && newPass !== confirmPass} />
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/50 rounded" disabled={loading}>Cancel</button>
                <button onClick={handlePasswordChange} disabled={loading} className="px-4 py-1.5 text-xs font-medium text-white rounded bg-orange-600 hover:bg-orange-700 shadow-sm disabled:opacity-70">
                  {loading ? "Updating..." : "Save Changes"}
                </button>
              </div>

            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

// Compact Input Field
function PasswordField({ label, value, onChange, show, toggle, disabled, error }) {
  return (
    <div className="relative group">
      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full pl-3 pr-9 py-2 bg-white border rounded text-sm text-slate-800 outline-none transition-all ${error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-orange-500"}`}
        />
        <button type="button" onClick={toggle} tabIndex="-1" className="absolute right-2.5 top-2 text-slate-400 hover:text-orange-600">
          {show ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}