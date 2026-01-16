// KPIOffsetList.jsx

import React, { useState } from "react";

const API_URL = "http://localhost:8080/api";

export default function KPIOffsetList({ offsets, authHeader, onDelete }) {
  const [filter, setFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");

  const filteredOffsets = offsets.filter((offset) => {
    const matchesSearch =
      offset.kpi_name.toLowerCase().includes(filter.toLowerCase()) ||
      offset.plant_name.toLowerCase().includes(filter.toLowerCase());
    
    const matchesPeriod = periodFilter === "all" || offset.period_type === periodFilter;
    const matchesPlant = plantFilter === "all" || offset.plant_name === plantFilter;

    return matchesSearch && matchesPeriod && matchesPlant;
  });

  const handleDelete = async (offsetId) => {
    if (!confirm("Are you sure you want to delete this offset?")) return;

    try {
      const response = await fetch(`${API_URL}/admin/kpi-offsets/${offsetId}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        onDelete();
      } else {
        alert("Failed to delete offset");
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Group offsets by period
  const groupedOffsets = filteredOffsets.reduce((acc, offset) => {
    const key = `${offset.period_type}-${offset.period_start_date}`;
    if (!acc[key]) {
      acc[key] = {
        period_type: offset.period_type,
        period_start_date: offset.period_start_date,
        period_end_date: offset.period_end_date,
        offsets: [],
      };
    }
    acc[key].offsets.push(offset);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">All KPI Offsets</h2>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Search</label>
          <input
            type="text"
            placeholder="Search KPI or Plant..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Period Type</label>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 outline-none"
          >
            <option value="all">All Periods</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Plant</label>
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 outline-none"
          >
            <option value="all">All Plants</option>
            <option value="Unit-1">Unit-1</option>
            <option value="Unit-2">Unit-2</option>
            <option value="Station">Station</option>
          </select>
        </div>
      </div>

      {/* Grouped Offsets */}
      {Object.keys(groupedOffsets).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No offsets found
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedOffsets).map((group, idx) => (
            <div key={idx} className="border-2 border-gray-200 rounded-lg overflow-hidden">
              {/* Group Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-lg uppercase">
                      {group.period_type} Offset
                    </span>
                    <span className="ml-4 text-sm opacity-90">
                      {new Date(group.period_start_date).toLocaleDateString("en-IN")} to{" "}
                      {new Date(group.period_end_date).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                    {group.offsets.length} KPIs
                  </span>
                </div>
              </div>

              {/* Offsets Table */}
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Plant</th>
                    <th className="px-4 py-3 text-left font-semibold">KPI Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Offset Value</th>
                    <th className="px-4 py-3 text-left font-semibold">Source</th>
                    <th className="px-4 py-3 text-center font-semibold">Configured By</th>
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {group.offsets.map((offset) => (
                    <tr key={offset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                          {offset.plant_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{offset.kpi_name}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-orange-600">
                        {offset.offset_value.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {offset.source || "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <div className="font-semibold">{offset.configured_by}</div>
                        <div className="text-gray-500">
                          {new Date(offset.configured_at).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(offset.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}