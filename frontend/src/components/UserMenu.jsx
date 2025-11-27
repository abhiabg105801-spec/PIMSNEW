import React, { useState } from "react";
import ModalPortal from "./ModalPortal";
import api from "../api";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function UserMenu({ username, onLogout }) {
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
      setMsg("⚠️ Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/change-password", {
        old_password: oldPass,
        new_password: newPass,
      });

      setMsg("✅ Password updated. Logging out…");

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

      {/* USER BUTTON (Corporate minimal) */}
      <button
        onClick={() => setOpen(!open)}
        className="
          flex items-center gap-2 
          px-4 py-1.5
          border border-[#D0D0D0]
          rounded-md
          bg-white
          text-[#5A5A5A]
          font-medium text-sm
          hover:border-[#E06A1B] hover:text-[#E06A1B]
          transition-all duration-200
          shadow-sm
        "
      >
        Welcome, {username}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div
          className="
            absolute right-0 mt-2 w-48 
            bg-white shadow-lg 
            border border-[#D0D0D0] 
            rounded-md z-50 py-2
          "
        >
          <button
            onClick={() => {
              setShowModal(true);
              setOpen(false);
            }}
            className="
              w-full text-left px-4 py-2 
              text-sm text-[#505050] 
              hover:bg-[#FFF4EC] 
              hover:text-[#E06A1B]
              transition
            "
          >
            Change Password
          </button>

          <button
            onClick={onLogout}
            className="
              w-full text-left px-4 py-2 
              text-sm text-[#505050] 
              hover:bg-[#FFF4EC] 
              hover:text-[#E06A1B]
              transition
            "
          >
            Logout
          </button>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-start pt-32 z-[99999]">

            <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-xl border border-[#D0D0D0]">

              <h2 className="text-xl font-semibold text-[#5A5A5A] mb-4">
                Change Password
              </h2>

              {/* OLD PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">Old Password</label>
              <div className="relative mb-3">
                <input
                  type={showOld ? "text" : "password"}
                  className="w-full p-2 pr-12 border border-[#D0D0D0] rounded bg-[#F9F9F9] focus:border-[#E06A1B]"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                />
                <span
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-[#E06A1B]"
                >
                  {showOld ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </span>
              </div>

              {/* NEW PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">New Password</label>
              <div className="relative mb-1">
                <input
                  type={showNew ? "text" : "password"}
                  className="w-full p-2 pr-12 border border-[#D0D0D0] rounded bg-[#F9F9F9] focus:border-[#E06A1B]"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
                <span
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-[#E06A1B]"
                >
                  {showNew ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </span>
              </div>

              {/* STRENGTH */}
              {newPass && (
                <div className={`text-sm mb-3 font-medium ${strength.color}`}>
                  Password Strength: {strength.label}
                </div>
              )}

              {/* CONFIRM PASSWORD */}
              <label className="block text-sm mb-1 text-gray-600">Confirm Password</label>
              <div className="relative mb-3">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="w-full p-2 pr-12 border border-[#D0D0D0] rounded bg-[#F9F9F9] focus:border-[#E06A1B]"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
                <span
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2 cursor-pointer text-gray-500 hover:text-[#E06A1B]"
                >
                  {showConfirm ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </span>
              </div>

              {/* MESSAGE */}
              {msg && (
                <div className="text-sm text-center text-[#E06A1B] font-medium">
                  {msg}
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#E0E0E0] hover:bg-[#C8C8C8] rounded"
                >
                  Cancel
                </button>

                <button
                  disabled={loading}
                  onClick={handlePasswordChange}
                  className="
                    px-4 py-2 
                    bg-[#E06A1B] text-white rounded 
                    hover:bg-[#C95F17] 
                    shadow-sm
                  "
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
