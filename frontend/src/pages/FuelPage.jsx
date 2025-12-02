import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

export default function FuelPage({ auth, date, roleId, activeTab }) {
  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });

  // Form States
  const [fuelType, setFuelType] = useState("LDO");
  const [receipt, setReceipt] = useState("");
  const [usage, setUsage] = useState("");
  const [remarks, setRemarks] = useState("");

  // Opening stock (only first time)
  const [openingStock, setOpeningStock] = useState(null);

  // Reports
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [last5, setLast5] = useState([]);

  const [message, setMessage] = useState("");

  // ---------------------------------------------------
  // LOAD REPORTS + OPENING STOCK ONLY WHEN TAB ACTIVE
  // ---------------------------------------------------

  const loadReports = useCallback(async () => {
    try {
      const d = new Date(date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();

      const [day, mon, yr, last] = await Promise.all([
        api.get(`/fuel/daily/${fuelType}/${date}`),
        api.get(`/fuel/monthly/${fuelType}/${year}/${month}`),
        api.get(`/fuel/yearly/${fuelType}/${year}`),
        api.get(`/fuel/last5/${fuelType}`),
      ]);

      setDaily(day.data);
      setMonthly(mon.data);
      setYearly(yr.data);
      setLast5(last.data);

      // opening stock logic
      if (day.data.opening_stock !== undefined) {
        setOpeningStock(day.data.opening_stock);
      } else {
        setOpeningStock(null);  // first time
      }

    } catch (err) {
      console.error("LOAD FAILED:", err);
    }
  }, [api, fuelType, date]);

  useEffect(() => {
    if (activeTab === "Fuel") {
      loadReports();
    }
  }, [activeTab, fuelType, date, loadReports]);

  // ---------------------------------------------------
  // CREATE ENTRY
  // ---------------------------------------------------

  const submitFuel = async () => {
    try {
      const payload = {
        tx_date: date,
        fuel_type: fuelType,
        opening_stock: openingStock,   // only if null in DB
        receipt: Number(receipt) || 0,
        usage: Number(usage) || 0,
        remarks,
      };

      await api.post("/fuel/", payload);

      setMessage("✅ Entry Saved");
      setReceipt("");
      setUsage("");
      setRemarks("");

      loadReports();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to save entry");
    }
  };

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <div className="p-5">

      <h2 className="text-xl font-semibold mb-4">
        Fuel Inventory — {fuelType}
      </h2>

      {message && (
        <div className={`p-2 mb-4 rounded ${message.startsWith("❌")
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700"
          }`}>
          {message}
        </div>
      )}

      {/* Fuel Type */}
      <div className="bg-gray-50 p-3 border rounded w-48 mb-6">
        <label className="text-xs text-gray-500">Fuel Type</label>
        <select
          className="w-full mt-1 p-2 border rounded"
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
        >
          <option value="LDO">LDO</option>
          <option value="HSD">HSD</option>
        </select>
      </div>

      {/* FIRST TIME OPENING STOCK */}
      {openingStock === null && (
        <div className="p-4 mb-6 border rounded bg-yellow-50">
          <h3 className="font-semibold text-yellow-700 mb-2">
            Enter Opening Stock (First Time)
          </h3>

          <input
            type="number"
            className="p-2 border rounded w-40"
            value={openingStock === null ? "" : openingStock}
            onChange={(e) => setOpeningStock(Number(e.target.value))}
          />
        </div>
      )}

      {/* TRANSACTION ENTRY */}
      <h3 className="text-lg font-semibold mb-2">New Entry</h3>

      <div className="flex gap-4 mb-4">

        <div>
          <label className="text-xs text-gray-500">Receipt (+)</label>
          <input
            type="number"
            className="p-2 border rounded w-32"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Usage (–)</label>
          <input
            type="number"
            className="p-2 border rounded w-32"
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Remarks</label>
          <input
            type="text"
            className="p-2 border rounded w-48"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <button
          onClick={submitFuel}
          className="px-4 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700"
        >
          Submit
        </button>
      </div>

      {/* DASHBOARD */}
      {daily && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="p-4 border rounded bg-white">
            <h4 className="text-sm text-gray-500">Opening</h4>
            <div className="text-2xl font-semibold">{daily.opening_stock}</div>
          </div>

          <div className="p-4 border rounded bg-white">
            <h4 className="text-sm text-gray-500">Closing</h4>
            <div className="text-2xl font-semibold">{daily.closing_stock}</div>
          </div>

          <div className="p-4 border rounded bg-white">
            <h4 className="text-sm text-gray-500">Today R / U</h4>
            <div className="text-lg">
              R: {daily.receipt} | U: {daily.usage}
            </div>
          </div>
        </div>
      )}

      {/* LAST 5 */}
      <h3 className="text-lg mt-10 mb-2 font-semibold">Last 5 Entries</h3>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="border p-2">Date</th>
            <th className="border p-2">Opening</th>
            <th className="border p-2">R</th>
            <th className="border p-2">U</th>
            <th className="border p-2">Closing</th>
            <th className="border p-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {last5.map((row) => (
            <tr key={row.id}>
              <td className="border p-2">{row.tx_date}</td>
              <td className="border p-2">{row.opening_stock}</td>
              <td className="border p-2">{row.receipt}</td>
              <td className="border p-2">{row.usage}</td>
              <td className="border p-2">{row.closing_stock}</td>
              <td className="border p-2">{row.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
