import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import DataEntryPage from "./pages/DataEntryPage";
import ReportViewer from "./pages/ReportViewer";
import PlantShutdownPage from "./pages/PlantShutdownPage";
import KpiChartsPage from "./pages/KpiChartsPage";
import KpiRangeViewer from "./pages/KpiRangeViewer";
import AdminPanel from "./pages/AdminPanel";
import UserMenu from "./components/UserMenu";
import DMPlantReportPage from "./pages/DMPlantReportPage";

// ⭐ NEW IMPORT — Add DM Plant Page
import DMPlantPage from "./pages/DMPlantPage";

function decodeJWT(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function App() {
  const [authHeader, setAuthHeader] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("authToken");
    if (saved) setAuthHeader(`Bearer ${saved}`);
  }, []);

  const handleLogin = (token) => {
    const jwt = token.replace("Bearer ", "");
    localStorage.setItem("authToken", jwt);
    setAuthHeader(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthHeader(null);
  };

  if (!authHeader) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Layout authHeader={authHeader} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

function Layout({ authHeader, onLogout }) {
  const decoded = decodeJWT(authHeader.replace("Bearer ", ""));
  const username = decoded?.sub || "User";
  const roleId = decoded?.role_id || null;

  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const highlightReports =
    location.pathname === "/report" ||
    location.pathname === "/kpi-data";

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ------------------ HEADER ------------------ */}
      {/* ─────────────────────────────────────────────────────────── */}
{/*        JSL – CORPORATE HEADER (FULLY BRANDED VERSION)       */}
{/* ─────────────────────────────────────────────────────────── */}
<div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)]">

  {/* TOP STEEL BAR */}
 

  {/* MAIN HEADER PANEL */}
  <header className="relative flex items-center px-10 h-16 bg-white">

    {/* LEFT — JSL LOGO */}
    <div className="flex items-center">
      <img src="/jsl-logo.png" className="h-14 w-auto" alt="JSL Logo" />
    </div>

    {/* CENTER — TITLE */}
    <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
      <span className="text-[32px] font-bold tracking-wide text-[#8D8D8D]">
        <span className="text-[#E06A1B] font-extrabold">2×125 MW CPP –</span> PIMS
      </span>
    </div>

    {/* RIGHT — USER MENU */}
    <div className="ml-auto">
      <UserMenu username={username} onLogout={onLogout} />
    </div>

  </header>

  {/* BOTTOM CORPORATE ORANGE BAR[#E06A1B] */}
  <div className="h-[4px] w-full bg-[#8D8D8D]"></div>

  {/* SLIM SHADOW SEPARATOR FOR DEPTH */}





        {/* ------------------ NAVIGATION ------------------ */}
        <nav className="h-12 bg-[#F5F5F5] border-t border-[#D0D0D0]">
          <div className="max-w-7xl mx-auto flex items-center h-full gap-10 px-10">

            {/* ----- Generic NavLink Style ----- */}
            {[
              { to: "/entry", label: "Data Entry" },
              ...(roleId === 5 || roleId === 8
                ? [{ to: "/dm-plant", label: "DM Plant" }]
                : []),
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `
                    relative px-3 h-full flex items-center 
                    text-sm font-semibold uppercase tracking-wider

                    ${isActive
                      ? "text-[#E06A1B] after:w-full"
                      : "text-[#555] hover:text-[#E06A1B] hover:after:w-full"}

                    after:absolute after:bottom-0 after:left-0 after:h-[3px]
                    after:bg-[#E06A1B] after:transition-all after:duration-300 after:w-0
                  `
                }
              >
                {item.label}
              </NavLink>
            ))}

            {/* ------------------ Reports Dropdown ------------------ */}
            <div
  className="relative h-full group"
>
  {/* Dropdown Trigger */}
  <div
    onMouseEnter={() => setIsOpen(true)}
    className={`relative px-3 h-full flex items-center text-sm font-semibold uppercase
      ${highlightReports ? "text-[#E06A1B]" : "text-[#555] hover:text-[#E06A1B]"}
    `}
  >
    Reports ▾
  </div>

  {/* Dropdown Panel */}
  {isOpen && (
    <div
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      className="
        absolute top-full left-0 mt-1 bg-white 
        border border-[#C9C9C9] rounded-md 
        shadow-[0_3px_12px_rgba(0,0,0,0.15)]
        w-48 animate-dropdown z-50
      "
    >
      <NavLink
        to="/report"
        className={({ isActive }) =>
          `block px-4 py-2 text-sm font-medium
           ${isActive
             ? "bg-[#FFF4EC] text-[#E06A1B]"
             : "text-[#555] hover:bg-[#F7F7F7]"}`}
      >
        Daily Report
      </NavLink>

      <NavLink
        to="/kpi-data"
        className={({ isActive }) =>
          `block px-4 py-2 text-sm font-medium
           ${isActive
             ? "bg-[#FFF4EC] text-[#E06A1B]"
             : "text-[#555] hover:bg-[#F7F7F7]"}`}
      >
        KPI Data Viewer
      </NavLink>
    </div>
  )}
</div>
            {/* ------------------ Shutdown ------------------ */}
            <NavLink
              to="/shutdowns"
              className={({ isActive }) =>
                `
                  relative px-3 h-full flex items-center text-sm font-semibold uppercase tracking-wider
                  ${isActive
                    ? "text-[#E06A1B] after:w-full"
                    : "text-[#555] hover:text-[#E06A1B] hover:after:w-full"}
                  after:absolute after:bottom-0 after:left-0 after:h-[3px]
                  after:bg-[#E06A1B] after:transition-all after:duration-300 after:w-0
                `
              }
            >
              Shutdown Log
            </NavLink>

            {/* ------------------ KPI Charts ------------------ */}
            <NavLink
              to="/charts"
              className={({ isActive }) =>
                `
                  relative px-3 h-full flex items-center text-sm font-semibold uppercase tracking-wider
                  ${isActive
                    ? "text-[#E06A1B] after:w-full"
                    : "text-[#555] hover:text-[#E06A1B] hover:after:w-full"}
                  after:absolute after:bottom-0 after:left-0 after:h-[3px]
                  after:bg-[#E06A1B] after:transition-all after:duration-300 after:w-0
                `
              }
            >
              KPI Charts
            </NavLink>

            {/* ------------------ Admin Panel ------------------ */}
            {username === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `
                    relative px-3 h-full flex items-center text-sm font-semibold uppercase tracking-wider
                    ${isActive
                      ? "text-[#E06A1B] after:w-full"
                      : "text-[#555] hover:text-[#E06A1B] hover:after:w-full"}
                    after:absolute after:bottom-0 after:left-0 after:h-[3px]
                    after:bg-[#E06A1B] after:transition-all after:duration-300 after:w-0
                  `
                }
              >
                Admin Panel
              </NavLink>
            )}
          </div>
        </nav>
      </div>

      {/* ------------------ PAGE CONTENT ------------------ */}
      <main className="flex-1 bg-white pt-32 px-6 pb-6">
        <Routes>
          <Route path="/" element={<Navigate to="/entry" />} />
          <Route path="/entry" element={<DataEntryPage auth={authHeader} />} />
          <Route path="/report" element={<ReportViewer auth={authHeader} />} />
          <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
          <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
          <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
          <Route path="/admin" element={<AdminPanel auth={authHeader} />} />

          {/* DM PLANT */}
          <Route path="/dm-plant" element={<DMPlantPage auth={authHeader} />} />
          <Route path="/dm-plant-report" element={<DMPlantReportPage />} />
        </Routes>
      </main>

      {/* Dropdown animation */}
      <style>{`
        @keyframes dropdown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
          animation: dropdown 0.18s ease-out;
        }
      `}</style>
    </div>
  );
}
