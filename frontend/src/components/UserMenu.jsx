import React, { useState } from "react";
import ModalPortal from "./ModalPortal";
import api from "../api";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";   // ✅ NEW ICONS

export default function UserMenu({ username, authHeader, onLogout }) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const passwordStrength = (pass) => {
    if (!pass) return { label: "", color: "" };

    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { label: "Weak", color: "text-red-600" };
    if (score === 2) return { label: "Medium", color: "text-yellow-600" };
    return { label: "Strong", color: "text-green-600" };
  };

  const strength = passwordStrength(newPass);

  const handlePasswordChange = async () => {
    setMsg("");

    if (!oldPass || !newPass || !confirmPass) {
      setMsg("⚠️ All fields are required.");
      return;
    }
    if (newPass !== confirmPass) {
      setMsg("⚠️ New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/auth/change-password", {
        old_password: oldPass,
        new_password: newPass,
      });

      setMsg("✅ Password changed successfully. Logging out...");

      setTimeout(() => {
        setShowModal(false);
        onLogout();
      }, 1200);

    } catch (e) {
      setMsg(`❌ ${e.response?.data?.detail || "Password change failed"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* USER BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 
                   text-white rounded-md text-sm font-semibold shadow border border-orange-800"
      >
        <span className="material-icons text-white text-lg">Welcome</span>
        {username}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white shadow-xl border border-orange-200 rounded-md z-50 py-2">
          <button
            onClick={() => {
              setShowModal(true);
              setOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600"
          >
            Change Password
          </button>

          <button
            onClick={onLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600"
          >
            Logout
          </button>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start pt-32 z-[99999]">

            <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-xl border border-orange-300">

              <h2 className="text-xl font-bold text-gray-800 mb-4">Change Password</h2>

              {/* OLD PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">Old Password</label>
              <div className="relative mb-3">
                <input
                  type={showOld ? "text" : "password"}
                  className="w-full p-2 pr-12 border rounded bg-gray-50"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                />

                <span
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-orange-600"
                >
                  {showOld ? (
                    <EyeSlashIcon className="w-6 h-6" />
                  ) : (
                    <EyeIcon className="w-6 h-6" />
                  )}
                </span>
              </div>

              {/* NEW PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">New Password</label>
              <div className="relative mb-1">
                <input
                  type={showNew ? "text" : "password"}
                  className="w-full p-2 pr-12 border rounded bg-gray-50"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />

                <span
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-orange-600"
                >
                  {showNew ? (
                    <EyeSlashIcon className="w-6 h-6" />
                  ) : (
                    <EyeIcon className="w-6 h-6" />
                  )}
                </span>
              </div>

              {/* STRENGTH */}
              {newPass && (
                <div className={`text-sm mb-3 font-semibold ${strength.color}`}>
                  Password Strength: {strength.label}
                </div>
              )}

              {/* CONFIRM PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">Confirm New Password</label>
              <div className="relative mb-3">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="w-full p-2 pr-12 border rounded bg-gray-50"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />

                <span
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-orange-600"
                >
                  {showConfirm ? (
                    <EyeSlashIcon className="w-6 h-6" />
                  ) : (
                    <EyeIcon className="w-6 h-6" />
                  )}
                </span>
              </div>

              {/* MESSAGE */}
              {msg && (
                <div className="text-sm mt-3 mb-2 text-center text-orange-700 font-medium">
                  {msg}
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
                >
                  Cancel
                </button>

                <button
                  disabled={loading}
                  onClick={handlePasswordChange}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded shadow"
                >
                  {loading ? "Saving..." : "Change Password"}
                </button>
              </div>

            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
