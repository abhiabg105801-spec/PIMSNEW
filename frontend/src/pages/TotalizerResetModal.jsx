// TotalizerResetModal.jsx

import React, { useState } from "react";

export default function TotalizerResetModal({ totalizer, onClose, onReset, authHeader }) {
  const [resetDate, setResetDate] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [oldMeterReading, setOldMeterReading] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!resetDate || !baselineValue || !reason) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("http://localhost:8080/api/admin/totalizers/reset", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          totalizer_id: totalizer.id,
          reset_date: resetDate,
          baseline_value: parseFloat(baselineValue),
          reason,
          notes,
          old_meter_final_reading: oldMeterReading ? parseFloat(oldMeterReading) : null,
        }),
      });

      if (response.ok) {
        alert("✅ Totalizer reset configured successfully");
        onReset();
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Reset failed: ${error.detail}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Reset Totalizer</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Totalizer</label>
            <div className="px-3 py-2 bg-gray-100 rounded">{totalizer.display_name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reset Date *</label>
            <input
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Date when new meter starts (readings will use baseline from this date)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Baseline Value (Previous Day Reading) *</label>
            <input
              type="number"
              step="0.001"
              value={baselineValue}
              onChange={(e) => setBaselineValue(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500"
              placeholder="0.000"
            />
            <p className="text-xs text-gray-500 mt-1">
              This value will be used as "yesterday's reading" for difference calculation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Old Meter Final Reading</label>
            <input
              type="number"
              step="0.001"
              value={oldMeterReading}
              onChange={(e) => setOldMeterReading(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500"
              placeholder="Optional - for audit trail"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select reason...</option>
              <option value="Meter Replacement">Meter Replacement</option>
              <option value="Meter Reset">Meter Reset</option>
              <option value="Calibration">Calibration</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500"
              rows="3"
              placeholder="Additional details..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? "Configuring..." : "Configure Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}