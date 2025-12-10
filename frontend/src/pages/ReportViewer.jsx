// src/pages/DPRPage1.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_URL = "http://localhost:8080/api";

const normalizeAuthHeader = (auth) => {
  if (!auth) return localStorage.getItem("authToken") || "";
  return auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
};

export default function DPRPage1({ auth }) {
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const authHeader = useMemo(() => normalizeAuthHeader(auth), [auth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/dpr/page1`, {
        params: { date: reportDate },
        headers: { Authorization: authHeader }
      });
      setReportData(res.data.data);
    } catch (err) {
      console.error("Failed to load DPR", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportDate]);

  // Helper to safely get value
  const val = (unit, kpi, period, decimals = 2) => {
    if (!reportData || !reportData[unit] || !reportData[unit][kpi]) return "—";
    const v = reportData[unit][kpi][period];
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(decimals);
  };

  // The Header component matching the Excel file
  const TableHeader = () => (
    <thead className="bg-gray-100 text-xs font-bold text-gray-800 border-b-2 border-gray-400">
      <tr>
        <th rowSpan="2" className="px-2 py-2 border-r border-gray-300 text-left bg-gray-200 w-64">
          Important Plant Parameter
        </th>
        <th colSpan="3" className="px-2 py-1 border-r border-gray-300 text-center bg-blue-100 text-blue-900">
          UNIT - 1
        </th>
        <th colSpan="3" className="px-2 py-1 border-r border-gray-300 text-center bg-green-100 text-green-900">
          UNIT - 2
        </th>
        <th colSpan="3" className="px-2 py-1 text-center bg-orange-100 text-orange-900">
          STATION
        </th>
      </tr>
      <tr className="text-[10px] uppercase">
        {/* Unit 1 */}
        <th className="px-2 py-1 border-r border-gray-300 bg-blue-50 text-right w-20">Day</th>
        <th className="px-2 py-1 border-r border-gray-300 bg-blue-50 text-right w-20">Month</th>
        <th className="px-2 py-1 border-r border-gray-300 bg-blue-50 text-right w-20">Year</th>
        {/* Unit 2 */}
        <th className="px-2 py-1 border-r border-gray-300 bg-green-50 text-right w-20">Day</th>
        <th className="px-2 py-1 border-r border-gray-300 bg-green-50 text-right w-20">Month</th>
        <th className="px-2 py-1 border-r border-gray-300 bg-green-50 text-right w-20">Year</th>
        {/* Station */}
        <th className="px-2 py-1 border-r border-gray-300 bg-orange-50 text-right w-20">Day</th>
        <th className="px-2 py-1 border-r border-gray-300 bg-orange-50 text-right w-20">Month</th>
        <th className="px-2 py-1 bg-orange-50 text-right w-20">Year</th>
      </tr>
    </thead>
  );

  // Row Component
  const KPIRow = ({ label, kpi, unit = "", decimals = 2 }) => (
    <tr className="text-sm border-b border-gray-200 hover:bg-yellow-50 transition-colors">
      <td className="px-3 py-2 border-r border-gray-300 font-medium text-gray-700 bg-white">
        {label} <span className="text-[10px] text-gray-500 ml-1">({unit})</span>
      </td>
      {/* U1 */}
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono">{val("Unit-1", kpi, "day", decimals)}</td>
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono">{val("Unit-1", kpi, "mon", decimals)}</td>
      <td className="px-2 py-1 border-r border-gray-300 text-right font-mono">{val("Unit-1", kpi, "year", decimals)}</td>
      {/* U2 */}
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono">{val("Unit-2", kpi, "day", decimals)}</td>
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono">{val("Unit-2", kpi, "mon", decimals)}</td>
      <td className="px-2 py-1 border-r border-gray-300 text-right font-mono">{val("Unit-2", kpi, "year", decimals)}</td>
      {/* Station */}
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono font-bold bg-orange-50/30">{val("Station", kpi, "day", decimals)}</td>
      <td className="px-2 py-1 border-r border-gray-200 text-right font-mono font-bold bg-orange-50/30">{val("Station", kpi, "mon", decimals)}</td>
      <td className="px-2 py-1 text-right font-mono font-bold bg-orange-50/30">{val("Station", kpi, "year", decimals)}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6 print:p-0 print:bg-white">
      <div className="max-w-[1200px] mx-auto bg-white shadow-xl rounded-lg overflow-hidden border border-gray-300 print:shadow-none print:border-0">
        
        {/* Controls */}
        <div className="p-4 border-b bg-gray-800 text-white flex justify-between items-center print:hidden">
          <div>
            <h1 className="text-xl font-bold">DPR: Plant Performance</h1>
            <p className="text-xs text-gray-400">Page 1 Overview</p>
          </div>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={reportDate} 
              onChange={(e) => setReportDate(e.target.value)} 
              className="px-3 py-1 rounded text-gray-900 border-none outline-none"
            />
            <button onClick={fetchData} className="px-4 py-1 bg-orange-600 hover:bg-orange-500 rounded font-bold text-sm">Load</button>
            <button onClick={() => window.print()} className="px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm">Print</button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-1 print:p-4">
          
          {/* Header Texts */}
          

          {loading ? (
            <div className="text-center py-12 text-gray-500 italic">Calculating Fiscal Year Data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-400">
                <TableHeader />
                <tbody>
                  <KPIRow label="Generation" kpi="generation" unit="MU" decimals={3} />
                  <KPIRow label="PLF %" kpi="plf_percent" unit="%" decimals={2} />
                  <KPIRow label="Running Hour" kpi="running_hour" unit="Hrs" decimals={2} />
                  <KPIRow label="Plant Availability" kpi="plant_availability_percent" unit="%" decimals={2} />
                  
                  {/* Space row */}
                  <tr className="bg-gray-50"><td colSpan="10" className="py-1"></td></tr>

                  <KPIRow label="Planned Outage" kpi="planned_outage_hour" unit="Hrs" decimals={2} />
                  <KPIRow label="Planned Outage %" kpi="planned_outage_percent" unit="%" decimals={2} />
                  <KPIRow label="Forced Outage" kpi="forced_outage_hour" unit="Hrs" decimals={2} />
                  <KPIRow label="Forced Outage %" kpi="forced_outage_percent" unit="%" decimals={2} />
                  
                  {/* Space row */}
                  <tr className="bg-gray-50"><td colSpan="10" className="py-1"></td></tr>

                  <KPIRow label="Coal Consumption" kpi="coal_consumption" unit="MT" decimals={3} />
                  <KPIRow label="Sp. Coal Cons." kpi="specific_coal" unit="kg/kWh" decimals={3} />
                  <KPIRow label="Oil Consumption" kpi="ldo_consumption" unit="KL" decimals={3} />
                  <KPIRow label="Sp. Oil Cons." kpi="specific_oil" unit="ml/kWh" decimals={3} />
                  
                  {/* Space row */}
                  <tr className="bg-gray-50"><td colSpan="10" className="py-1"></td></tr>

                  <KPIRow label="Aux Power Cons." kpi="aux_power_consumption" unit="MU" decimals={3} />
                  <KPIRow label="Aux Power %" kpi="aux_power_percent" unit="%" decimals={2} />
                </tbody>
              </table>
              
              <div className="mt-8 flex justify-between text-xs text-gray-500 print:mt-4">
                 <span>System Generated Report</span>
                 <span>Fiscal Year Data Included</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}