import React, { useState } from "react";
import DailyReport from "./ReportViewer";
import KPIViewer from "./KpiRangeViewer";

export default function Reports({ auth }) {
  const [activeTab, setActiveTab] = useState("daily");

  return (
    <div className="p-1">
      

      {/* Tabs */}
      <div className="border-b border-gray-300 mb-4 flex gap-6">
        <button
          className={`pb-2 ${activeTab === "daily" ? "border-b-2 border-orange-500 font-semibold" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          Daily Report
        </button>

        <button
          className={`pb-2 ${activeTab === "kpi" ? "border-b-2 border-orange-500 font-semibold" : ""}`}
          onClick={() => setActiveTab("kpi")}
        >
          KPI Data Viewer
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "daily" && <DailyReport auth={auth} />}
        {activeTab === "kpi" && <KPIViewer auth={auth} />}
      </div>
    </div>
  );
}
