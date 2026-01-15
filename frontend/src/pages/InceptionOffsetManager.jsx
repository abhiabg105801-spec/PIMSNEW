// InceptionOffsetManager.jsx

import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8080/api";

export default function InceptionOffsetManager({ auth }) {
  const [unit1, setUnit1] = useState({ mw_offset: "", hours_offset: "", date: "" });
  const [unit2, setUnit2] = useState({ mw_offset: "", hours_offset: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOffsets();
  }, []);

  const loadOffsets = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`${API_URL}/dpr/inception/get-offset/Unit-1`, {
          headers: { Authorization: auth },
        }),
        fetch(`${API_URL}/dpr/inception/get-offset/Unit-2`, {
          headers: { Authorization: auth },
        }),
      ]);

      const data1 = await res1.json();
      const data2 = await res2.json();

      setUnit1({
        mw_offset: data1.inception_mw_offset,
        hours_offset: data1.inception_hours_offset,
        date: data1.inception_date || "",
      });

      setUnit2({
        mw_offset: data2.inception_mw_offset,
        hours_offset: data2.inception_hours_offset,
        date: data2.inception_date || "",
      });
    } catch (err) {
      console.error("Failed to load offsets", err);
    } finally {
      setLoading(false);
    }
  };

  const saveOffset = async (unit, data) => {
    setSaving(true);
    try {
      const payload = {
        unit,
        inception_mw_offset: parseFloat(data.mw_offset) || 0,
        inception_hours_offset: parseFloat(data.hours_offset) || 0,
        inception_date: data.date || null,
      };

      await fetch(`${API_URL}/dpr/inception/update-offset`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      alert(`✅ ${unit} inception offsets saved successfully!`);
    } catch (err) {
      console.error("Failed to save", err);
      alert(`❌ Failed to save ${unit} offsets`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Inception Offset Management
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Set hardcoded offset values for generation and running hours from before the system was implemented.
      </p>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Unit-1 */}
          <div className="border-2 border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-blue-700">Unit-1</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MW Offset (MWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unit1.mw_offset}
                  onChange={(e) => setUnit1({ ...unit1, mw_offset: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Running Hours Offset
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unit1.hours_offset}
                  onChange={(e) => setUnit1({ ...unit1, hours_offset: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inception Date (Optional)
                </label>
                <input
                  type="date"
                  value={unit1.date}
                  onChange={(e) => setUnit1({ ...unit1, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => saveOffset("Unit-1", unit1)}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Unit-1"}
            </button>
          </div>

          {/* Unit-2 */}
          <div className="border-2 border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-green-700">Unit-2</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MW Offset (MWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unit2.mw_offset}
                  onChange={(e) => setUnit2({ ...unit2, mw_offset: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Running Hours Offset
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unit2.hours_offset}
                  onChange={(e) => setUnit2({ ...unit2, hours_offset: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inception Date (Optional)
                </label>
                <input
                  type="date"
                  value={unit2.date}
                  onChange={(e) => setUnit2({ ...unit2, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <button
              onClick={() => saveOffset("Unit-2", unit2)}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Unit-2"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}