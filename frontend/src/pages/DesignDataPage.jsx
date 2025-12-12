// DesignDataPage.jsx (Shutdown Theme Applied)
// Vite + React + JWT Auth (auth passed as prop)

import React, { useState } from "react";
import axios from "axios";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

// ------------------------------ JSL THEME COLORS ------------------------------
const ORANGE = "#E06A1B";
const DARK = "#2E2E2E";
const GREY = "#E0E0E0";
const LIGHT = "#F7F7F7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";

// ------------------------------ IMPORT DESIGN DATA ------------------------------
import {
  flowData,
  temperatureData,
  pressureData,
  gasVelocitiesData,
  draftsData,
  fuelData,
  millPerformanceData,
  gasAnalysisData,
  ambientData,
  heatBalanceData,
  heatRateCharts,
  outputCharts,
} from "../config/designPageData.js";

// ------------------------------ SECTION TITLE ------------------------------
const SectionTitle = ({ title }) => (
  <h2
    className="text-xl font-semibold text-center py-2"
    style={{
      color: ORANGE,
      borderBottom: `3px solid ${ORANGE}`,
      marginBottom: "15px",
    }}
  >
    {title}
  </h2>
);

// ------------------------------ TABS ------------------------------
const TABS = [
  { id: "flow", label: "Flow", data: flowData },
  { id: "temp", label: "Temperature", data: temperatureData },
  { id: "pressure", label: "Pressure", data: pressureData },
  { id: "drafts", label: "Drafts", data: draftsData },
  { id: "mill", label: "Mill Performance", data: millPerformanceData },
  { id: "gas", label: "Gas Analysis", data: gasAnalysisData },
  { id: "vel", label: "Gas Velocities", data: gasVelocitiesData },
  { id: "heat", label: "Heat Balance", data: heatBalanceData },
  { id: "heat-rate", label: "Heat Rate Curves" },
  { id: "output-correction", label: "Output Curves" },
];

// ------------------------------ DATA TABLE (Shutdown Theme) ------------------------------
const DataTable = ({ title, headers, rows }) => (
  <div
    className="rounded-lg shadow p-4 mb-6"
    style={{
      background: WHITE,
      border: `2px solid ${ORANGE}`,
    }}
  >
    <h3
      className="text-lg font-bold mb-3 text-center"
      style={{ color: ORANGE }}
    >
      {title}
    </h3>

    <div className="overflow-x-auto">
      <table
        className="w-full text-sm rounded border"
        style={{ borderColor: ORANGE }}
      >
        {/* HEADER */}
        <thead>
          <tr
            style={{
              background: ORANGE,
              color: WHITE,
            }}
          >
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="p-2 border-r text-center"
                style={{ borderColor: WHITE, fontWeight: 700 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="divide-y" style={{ divideColor: ORANGE }}>
          {rows.map((row, i) => {
            if (row.category) {
              return (
                <tr key={i} style={{ background: "#FFF4E6" }}>
                  <td
                    colSpan={headers.length}
                    className="p-2 font-bold text-left"
                    style={{ color: ORANGE }}
                  >
                    {row.category}
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={i}
                className="hover:bg-orange-50"
                style={{
                  background: i % 2 === 0 ? WHITE : "#FAFAFA",
                }}
              >
                {row.map((cell, j) => (
                  <td key={j} className="p-2 border-r text-center">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ------------------------------ CHART (Shutdown Theme – Grey + Orange) ------------------------------
const CorrectionCurveChart = ({
  title,
  subtitle,
  xAxisName,
  yAxisName,
  data,
}) => {
  const option = {
    backgroundColor: WHITE,
    textStyle: { fontFamily: "sans-serif" },

    title: {
      text: title,
      subtext: subtitle,
      left: "center",
      textStyle: { color: BLACK, fontSize: 18, fontWeight: 700 },
      subtextStyle: { color: DARK, fontSize: 14 },
    },

    tooltip: {
      trigger: "axis",
      backgroundColor: ORANGE,
      borderColor: BLACK,
      textStyle: { color: WHITE, fontWeight: "bold" },
    },

    grid: { left: "10%", right: "6%", bottom: "18%" },

    xAxis: {
      name: xAxisName,
      type: "value",
      nameLocation: "middle",
      nameGap: 35,
      axisLine: { lineStyle: { color: DARK, width: 2 } },
      axisLabel: { fontSize: 12, color: DARK },
      splitLine: { lineStyle: { color: "#CCC", type: "dashed" } },
    },

    yAxis: {
      name: yAxisName,
      type: "value",
      nameLocation: "middle",
      nameGap: 50,
      axisLine: { lineStyle: { color: DARK, width: 2 } },
      axisLabel: { fontSize: 12, color: DARK },
      splitLine: { lineStyle: { color: "#CCC", type: "dashed" } },
    },

    series: [
      {
        type: "line",
        smooth: true,
        data,
        lineStyle: { color: ORANGE, width: 3 },
        itemStyle: { color: DARK },
      },
    ],
  };

  return (
    <div
      className="rounded-lg shadow p-3"
      style={{ border: `2px solid ${ORANGE}`, background: WHITE }}
    >
      <ReactECharts option={option} style={{ height: 350 }} />
    </div>
  );
};
// ------------------------------ MAIN PAGE ------------------------------
// ------------------------------ MAIN PAGE (Sidebar Layout) ------------------------------
export default function DesignDataPage({ auth }) {
  const [activeTab, setActiveTab] = useState("flow");

  const api = axios.create({
    baseURL: "http://localhost:8080/design-data",
    headers: { Authorization: auth },
  });

  return (
    <div
      className="max-w-7xl mx-auto my-4 p-4 rounded-lg"
      style={{ background: WHITE }}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* ------------------------------ SIDEBAR ------------------------------ */}
        <div
          className="col-span-3 p-4 rounded-lg shadow border"
          style={{
            background: WHITE,
            borderColor: ORANGE,
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <h3
            className="text-lg font-bold mb-3 text-center"
            style={{ color: ORANGE }}
          >
            Sections
          </h3>

          <div className="flex flex-col gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold shadow transition text-left
                ${
                  activeTab === t.id
                    ? "bg-[#E06A1B] text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------ CONTENT AREA ------------------------------ */}
        <div className="col-span-9">
          {/* DATA TABLES */}
          {TABS.filter((t) => t.id === activeTab && t.data).map((t) => (
            <DataTable
              key={t.id}
              title={t.data.title}
              headers={t.data.headers}
              rows={t.data.rows}
            />
          ))}

          {/* HEAT RATE CURVES */}
          {activeTab === "heat-rate" && (
            <div>
              <SectionTitle title="Heat Rate Correction Curves" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {heatRateCharts.map((chart, i) => (
                  <CorrectionCurveChart key={i} {...chart} />
                ))}
              </div>
            </div>
          )}

          {/* OUTPUT CORRECTION CURVES */}
          {activeTab === "output-correction" && (
            <div>
              <SectionTitle title="Output Correction Curves" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {outputCharts.map((chart, i) => (
                  <CorrectionCurveChart key={i} {...chart} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

