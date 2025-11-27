// PlantShutdownPage.jsx
// Full refactored with Tab Layout (T2), Sectioned Form (F3), Zebra Table (T2), JSL Theme

// NOTE: Replace this entire file into your project.

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format, subDays } from "date-fns";

/* -------------------------------------------------------------------------- */
/*                               helper fields                                */
/* -------------------------------------------------------------------------- */

const FormField = ({ label, id, type = "text", value, onChange, required = false, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      required={required}
      className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-[#E06A1B] focus:ring-[#E06A1B] sm:text-sm transition"
      {...props}
    />
  </div>
);

const SelectField = ({ label, id, value, onChange, required = false, children, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      required={required}
      className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-[#E06A1B] focus:ring-[#E06A1B] sm:text-sm transition"
      {...props}
    >
      {children}
    </select>
  </div>
);

const TextAreaField = ({ label, id, value, onChange, required = false, rows = 3, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      required={required}
      rows={rows}
      className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-[#E06A1B] focus:ring-[#E06A1B] sm:text-sm transition"
      {...props}
    />
  </div>
);

/* -------------------------------------------------------------------------- */
/*                             initial form state                              */
/* -------------------------------------------------------------------------- */

const initialShutdownState = {
  unit: "",
  datetime_from: "",
  datetime_to: "",
  duration: "",
  reason: "",
  responsible_agency: "",
  notification_no: "",
};

const formatDateTimeForTable = (datetimeString) => {
  if (!datetimeString) return "";
  try {
    const d = new Date(datetimeString);
    return d.toLocaleString("en-GB", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return datetimeString;
  }
};

/* -------------------------------------------------------------------------- */
/*                              main component                                 */
/* -------------------------------------------------------------------------- */

export default function PlantShutdownPage({ auth }) {
  const [activeTab, setActiveTab] = useState("form"); // form | history

  const [formData, setFormData] = useState(initialShutdownState);
  const [rcaFile, setRcaFile] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const [shutdownLogs, setShutdownLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState("");

  const [editingId, setEditingId] = useState(null);

  const today = new Date();
  const [startDate, setStartDate] = useState(format(subDays(today, 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [unitFilter, setUnitFilter] = useState("");

  const API_URL = "http://localhost:8080/api";
  const headers = { Authorization: auth };

  /* ----------------------------- fetch logs ----------------------------- */
  const fetchShutdownLogs = async () => {
    setLoadingLogs(true);
    setLogError("");

    const params = {
      start_date: startDate,
      end_date: endDate,
    };
    if (unitFilter) params.unit = unitFilter;

    try {
      const res = await axios.get(`${API_URL}/shutdowns/`, { headers, params });
      setShutdownLogs(res.data);
    } catch (err) {
      setShutdownLogs([]);
      if (err.response?.status !== 404) setLogError("Failed to fetch shutdown logs.");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchShutdownLogs();
  }, [startDate, endDate, unitFilter]);

  /* ------------------------ Auto duration calc ------------------------- */
  useEffect(() => {
    const { datetime_from, datetime_to } = formData;
    let calculated = "";

    if (datetime_from && datetime_to) {
      try {
        const s = new Date(datetime_from);
        const e = new Date(datetime_to);
        if (e > s) {
          const diff = (e - s) / 60000; // mins
          const days = Math.floor(diff / (60 * 24));
          const hours = Math.floor((diff % (60 * 24)) / 60);
          const minutes = Math.round(diff % 60);
          if (days) calculated += `${days}d `;
          if (hours) calculated += `${hours}h `;
          calculated += `${minutes}m`;
        } else {
          calculated = "Invalid";
        }
      } catch {
        calculated = "";
      }
    }

    setFormData((p) => (p.duration !== calculated ? { ...p, duration: calculated } : p));
  }, [formData.datetime_from, formData.datetime_to]);

  /* ----------------------------- Handlers ------------------------------ */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const handleStartEdit = (log) => {
    setEditingId(log.id);
    setFormData({
      unit: log.unit,
      datetime_from: log.datetime_from || "",
      datetime_to: log.datetime_to || "",
      duration: log.duration || "",
      reason: log.reason || "",
      responsible_agency: log.responsible_agency || "",
      notification_no: log.notification_no || "",
    });
    setMessage("");
    setRcaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveTab("form");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(initialShutdownState);
    setRcaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    const form = new FormData();
    Object.entries(formData).forEach(([k, v]) => form.append(k, v));
    if (rcaFile) form.append("rca_file", rcaFile);

    const isUpdating = editingId !== null;
    const url = isUpdating
      ? `${API_URL}/shutdowns/${editingId}`
      : `${API_URL}/shutdowns/`;
    const method = isUpdating ? "put" : "post";

    try {
      await axios({ method, url, data: form, headers });
      setMessage(isUpdating ? "✅ Record updated" : "✅ Record saved");
      handleCancelEdit();
      fetchShutdownLogs();
    } catch (err) {
      let detail = err.response?.data?.detail || (isUpdating ? "Error updating" : "Error saving");
      if (Array.isArray(detail)) detail = detail.map((d) => `${d.loc.pop()} - ${d.msg}`).join("; ");
      setMessage(`❌ ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setMessage("Generating PDF...");
    const params = { start_date: startDate, end_date: endDate };
    if (unitFilter) params.unit = unitFilter;

    try {
      const response = await axios.get(`${API_URL}/shutdowns/export/pdf`, {
        headers,
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Shutdown_Log_${startDate}_to_${endDate}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
      setMessage("");
    } catch (err) {
      setMessage(`❌ PDF Download Failed`);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                RENDER UI                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="max-w-7xl mx-auto my-4 p-1 bg-white rounded-lg space-y-6">
      {/* -------------------------- TABS -------------------------- */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setActiveTab("form")}
          className={`px-4 py-2 rounded-full font-semibold text-sm shadow transition
            ${activeTab === "form" ? "bg-[#E06A1B] text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
        >
          Log Shutdown
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-full font-semibold text-sm shadow transition
            ${activeTab === "history" ? "bg-[#E06A1B] text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
        >
          Shutdown History
        </button>
      </div>

      {/* ----------------------- TAB: FORM ----------------------- */}
      {activeTab === "form" && (
        <div className="p-4 bg-white rounded-lg shadow border border-[#E06A1B]/30 space-y-4">
          <h2 className="text-xl font-semibold text-center text-[#E06A1B]">
            {editingId ? "Update Shutdown Event" : "Log Plant Shutdown Event"}
          </h2>

          {message && (
            <div
              className={`p-3 text-sm text-center rounded-md shadow-sm
                ${message.startsWith("❌")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-orange-50 text-[#E06A1B] border border-[#E06A1B]/50"}`}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-2">
                Shutdown Timing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <FormField
                  label="From (Date & Time)"
                  id="datetime_from"
                  type="datetime-local"
                  value={formData.datetime_from}
                  onChange={handleChange}
                  required
                />
                <FormField
                  label="To (Date & Time)"
                  id="datetime_to"
                  type="datetime-local"
                  value={formData.datetime_to}
                  onChange={handleChange}
                />
                <SelectField
                  label="Unit"
                  id="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Unit</option>
                  <option value="Unit-1">Unit-1</option>
                  <option value="Unit-2">Unit-2</option>
                </SelectField>
                <FormField
                  label="Duration"
                  id="duration"
                  type="text"
                  value={formData.duration}
                  readOnly
                />
              </div>
            </div>

            {/* Section 2 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-2">
                Shutdown Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextAreaField
                  label="Reason for Shutdown"
                  id="reason"
                  value={formData.reason}
                  onChange={handleChange}
                />
                <FormField
                  label="Responsible Agency"
                  id="responsible_agency"
                  value={formData.responsible_agency}
                  onChange={handleChange}
                />
                <FormField
                  label="Breakdown Notification No."
                  id="notification_no"
                  value={formData.notification_no}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Section 3 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-2">
                Attachments
              </h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Upload RCA File (Optional)
                </label>
                <input
                  type="file"
                  id="rca_file"
                  name="rca_file"
                  ref={fileInputRef}
                  onChange={(e) => setRcaFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm border border-gray-300 rounded-md cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:bg-orange-50 file:text-[#E06A1B] hover:file:bg-orange-100"
                />
                {rcaFile && <p className="text-xs text-gray-500 mt-1">Selected: {rcaFile.name}</p>}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded-md text-white font-semibold shadow-md transition
                  ${submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : editingId
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-[#E06A1B] hover:bg-orange-600"}`}
                disabled={submitting}
              >
                {submitting ? "Saving..." : editingId ? "Update Record" : "Save Record"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-2 px-4 rounded-md text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300 shadow-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* --------------------- TAB: HISTORY --------------------- */}
      {activeTab === "history" && (
        <div className="p-4 bg-white rounded-lg shadow border border-[#E06A1B]/30 space-y-4">
          <h2 className="text-xl font-semibold text-center text-[#E06A1B]">
            Shutdown History
          </h2>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border border-orange-100 rounded-md bg-orange-50 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm"
              >
                <option value="">All Units</option>
                <option value="Unit-1">Unit-1</option>
                <option value="Unit-2">Unit-2</option>
              </select>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={loadingLogs}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition disabled:bg-gray-400"
            >
              ⬇ Download PDF
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-orange-200 rounded-lg">
            {loadingLogs && <p className="p-4 text-center text-orange-600">Loading logs...</p>}
            {logError && <p className="p-4 text-center text-red-500">{logError}</p>}

            {!loadingLogs && !logError && shutdownLogs.length === 0 && (
              <p className="p-4 text-center text-orange-600">No shutdown records found.</p>
            )}

            {!loadingLogs && !logError && shutdownLogs.length > 0 && (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-[#E06A1B] text-white uppercase text-xs">
                  <tr>
                    <th className="p-2.5 border-r border-white">From</th>
                    <th className="p-2.5 border-r">To</th>
                    <th className="p-2.5 border-r">Unit</th>
                    <th className="p-2.5 border-r">Duration</th>
                    <th className="p-2.5 border-r">Reason</th>
                    <th className="p-2.5 border-r">Agency</th>
                    <th className="p-2.5 border-r">Notif. No</th>
                    <th className="p-2.5 border-r">RCA</th>
                    <th className="p-2.5">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-orange-100">
                  {shutdownLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-orange-50">
                      <td className="p-2.5 border-r border-orange-200 whitespace-nowrap">
                        {formatDateTimeForTable(log.datetime_from)}
                      </td>
                      <td className="p-2.5 border-r border-orange-200 whitespace-nowrap">
                        {formatDateTimeForTable(log.datetime_to)}
                      </td>
                      <td className="p-2.5 border-r border-orange-200">{log.unit}</td>
                      <td className="p-2.5 border-r border-orange-200">{log.duration}</td>
                      <td
                        className="p-2.5 border-r border-orange-200 min-w-[150px] max-w-[200px] truncate"
                        title={log.reason}
                      >
                        {log.reason}
                      </td>
                      <td className="p-2.5 border-r border-orange-200">
                        {log.responsible_agency}
                      </td>
                      <td className="p-2.5 border-r border-orange-200">
                        {log.notification_no}
                      </td>
                      <td className="p-2.5 border-r border-orange-200 text-center">
                        {log.rca_file_path ? (
                          <a
                            href={`http://143.143.1.5:8080/${log.rca_file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#E06A1B] hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "No"
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleStartEdit(log)}
                          className="text-[#E06A1B] hover:text-orange-800 hover:underline text-xs font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
