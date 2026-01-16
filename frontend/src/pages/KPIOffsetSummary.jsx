// KPIOffsetSummary.jsx

import React from "react";

export default function KPIOffsetSummary({ offsets }) {
  // Group by period
  const periods = offsets.reduce((acc, offset) => {
    const key = `${offset.period_type}-${offset.period_start_date}`;
    if (!acc[key]) {
      acc[key] = {
        period_type: offset.period_type,
        period_start_date: offset.period_start_date,
        period_end_date: offset.period_end_date,
        count: 0,
        plants: new Set(),
      };
    }
    acc[key].count++;
    acc[key].plants.add(offset.plant_name);
    return acc;
  }, {});

  // Statistics
  const stats = {
    total: offsets.length,
    months: Object.values(periods).filter((p) => p.period_type === "month").length,
    years: Object.values(periods).filter((p) => p.period_type === "year").length,
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold mb-2">{stats.total}</div>
          <div className="text-blue-100">Total KPI Offsets</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold mb-2">{stats.months}</div>
          <div className="text-green-100">Month Periods</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold mb-2">{stats.years}</div>
          <div className="text-purple-100">Year Periods</div>
        </div>
      </div>

      {/* Period Summary */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Configured Periods</h2>

        {Object.keys(periods).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-500 text-lg">No offsets configured yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Click "Import Offsets" to add historical data
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {Object.values(periods).map((period, idx) => (
              <div
                key={idx}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-orange-400 transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        period.period_type === "month"
                          ? "bg-green-100 text-green-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {period.period_type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">{period.count}</div>
                    <div className="text-xs text-gray-500">KPIs</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700">Period:</span>
                    <span className="text-gray-600">
                      {new Date(period.period_start_date).toLocaleDateString("en-IN")} →{" "}
                      {new Date(period.period_end_date).toLocaleDateString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700">Plants:</span>
                    <div className="flex gap-1">
                      {Array.from(period.plants).map((plant) => (
                        <span
                          key={plant}
                          className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold"
                        >
                          {plant}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-3 text-lg">ℹ️ About KPI Offsets</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Why do we need offsets?</strong> When the system goes live mid-month or mid-year,
            we need historical data from the beginning of that period to calculate accurate monthly/yearly totals.
          </p>
          <p>
            <strong>Example:</strong> If system goes live on June 15, we need June 1-14 data as offsets
            so that "June Total" includes the full month.
          </p>
          <p>
            <strong>How it works:</strong> Month/Year totals = System data + Offset value
          </p>
        </div>
      </div>
    </div>
  );
}