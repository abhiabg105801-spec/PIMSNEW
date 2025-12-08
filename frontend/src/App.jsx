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
import DesignDataPage from "./pages/DesignDataPage";
import Reports from "./pages/Reports";
import LogicDiagramPage from "./pages//LogicDiagramPage";
import FloatingMessageBox from "./components/FloatingMessageBox";

import TotalizerEntry from "./pages/TotalizerEntry";

// ⭐ NEW IMPORT — Add DM Plant Page
import DMPlantPage from "./pages/dmplanttabs";

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
  <header className="relative flex items-center px-6 h-13 bg-white">

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
        <nav className="h-7 bg-[#F5F5F5] border-t border-[#D0D0D0]">
          <div className="max-w-7xl mx-auto flex items-center h-full gap-6 px-5">

            {/* ----- Generic NavLink Style ----- */}
            {[
              { to: "/TotalizerEntry", label: "125MW" },
              ...(roleId === 5 || roleId === 8 || roleId === 3|| roleId === 7|| roleId === 1|| roleId === 2
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
             <NavLink
      to="/reports"
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
      Reports
    </NavLink>
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
            {/* ------------------  Design Data ------------------ */}
            <NavLink
              to="/DesignDataPage"
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
              Design Data
            </NavLink>
             {/* ------------------  Logic Diagram ------------------ */}
            <NavLink
              to="/LogicDiagramPage"
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
              Logic 
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
          <Route path="/reports" element={<Reports auth={authHeader} /> }  />
          <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
          <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
          <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
          <Route path="/admin" element={<AdminPanel auth={authHeader} />} />

          {/* DM PLANT */}
          <Route path="/dm-plant" element={<DMPlantPage auth={authHeader} />} />
          <Route path="/dm-plant-report" element={<DMPlantReportPage />} />
          <Route path="/DesignDataPage" element={<DesignDataPage auth={authHeader} />} />
          <Route path="/LogicDiagramPage" element={<LogicDiagramPage auth={authHeader} />} />
          <Route
  path="/TotalizerEntry"
  element={<TotalizerEntry auth={authHeader} />}
/>
        </Routes>
      </main>
      <FloatingMessageBox auth={authHeader} />
      <footer className="bg-[#F5F5F5] border-t border-gray-300 mt-6">
  <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-gray-600 flex flex-col md:flex-row items-center justify-between gap-2">
    <span>© {new Date().getFullYear()} Jindal Stainless Ltd. All Rights Reserved.</span>
    <span className="text-gray-500">
      Contact: <a href="mailto:cppsupport@jsl.com" className="text-[#E06A1B] font-semibold hover:underline">
        email
      </a>
    </span>
  </div>
  <div className="h-[4px] w-full bg-[#E06A1B]"></div>
</footer>

      
    </div>
  );
}
