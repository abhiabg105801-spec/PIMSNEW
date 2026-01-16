// KPIConfigViewer.jsx

import React, { useEffect, useState } from "react";

export default function KPIConfigViewer({ authHeader }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/admin/kpis/config", {
        headers: { Authorization: authHeader },
      });
      const data = await response.json();
      setConfigs(data.kpis || []);
    } catch (err) {
      console.error("Failed to load configs", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredConfigs = configs.filter((c) =>
    c.display_name.toLowerCase().includes(filter.toLowerCase()) ||
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  const getAggBadgeColor = (agg) => {
    switch (agg) {
      case "sum": return "bg-blue-100 text-blue-800";
      case "average": return "bg-green-100 text-green-800";
      case "weighted_avg": return "bg-purple-100 text-purple-800";
      case "max": return "bg-red-100 text-red-800";
      case "min": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading KPI configurations...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">KPI Configuration</h1>
        <p className="text-gray-600">Configure how KPIs are aggregated for day/month/year periods</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search KPIs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">KPI Name</th>
              <th className="px-4 py-3 text-left font-semibold">Unit</th>
              <th className="px-4 py-3 text-center font-semibold">Day Agg</th>
              <th className="px-4 py-3 text-center font-semibold">Month Agg</th>
              <th className="px-4 py-3 text-center font-semibold">Year Agg</th>
              <th className="px-4 py-3 text-center font-semibold">Weight By</th>
              <th className="px-4 py-3 text-center font-semibold">Decimals</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredConfigs.map((config) => (
              <tr key={config.name} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{config.display_name}</div>
                  <div className="text-xs text-gray-500">{config.name}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{config.unit}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getAggBadgeColor(config.day_aggregation)}`}>
                    {config.day_aggregation}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getAggBadgeColor(config.month_aggregation)}`}>
                    {config.month_aggregation}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getAggBadgeColor(config.year_aggregation)}`}>
                    {config.year_aggregation}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {config.weight_by || "—"}
                </td>
                <td className="px-4 py-3 text-center font-mono">
                  {config.decimals}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold mb-2">Aggregation Types:</h3>
        <ul className="text-sm space-y-1">
          <li><span className="font-mono bg-blue-100 px-2 py-0.5 rounded">sum</span> - Add all values</li>
          <li><span className="font-mono bg-green-100 px-2 py-0.5 rounded">average</span> - Simple average</li>
          <li><span className="font-mono bg-purple-100 px-2 py-0.5 rounded">weighted_avg</span> - Weighted average (by generation, coal, etc.)</li>
          <li><span className="font-mono bg-red-100 px-2 py-0.5 rounded">max</span> - Maximum value</li>
          <li><span className="font-mono bg-yellow-100 px-2 py-0.5 rounded">min</span> - Minimum value</li>
        </ul>
      </div>
    </div>
  );
}